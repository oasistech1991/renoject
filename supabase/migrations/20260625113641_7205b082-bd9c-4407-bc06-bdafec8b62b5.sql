
ALTER TABLE public.feed_posts
  ADD COLUMN IF NOT EXISTS is_upcoming BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS feed_posts_upcoming_idx
  ON public.feed_posts (is_upcoming, created_at DESC);

ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS available_capital NUMERIC,
  ADD COLUMN IF NOT EXISTS capital_notes TEXT,
  ADD COLUMN IF NOT EXISTS capital_updated_at TIMESTAMPTZ;

-- Allow admins to read all client profiles for the team dashboard
DROP POLICY IF EXISTS "Admins can read all client profiles" ON public.client_profiles;
CREATE POLICY "Admins can read all client profiles"
  ON public.client_profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
