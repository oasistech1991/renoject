
-- Extend client profiles with Facebook-style fields and investment preferences
ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS headline text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS preferred_areas text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_deal_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS budget_min numeric,
  ADD COLUMN IF NOT EXISTS budget_max numeric;

-- Cache geocoded coordinates on properties
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz,
  ADD COLUMN IF NOT EXISTS geocoded_address text;

-- Allow admins to view any client profile (in addition to existing self-only policy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'client_profiles' AND policyname = 'Admins can view all client profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can view all client profiles" ON public.client_profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''::app_role))';
  END IF;
END $$;
