-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'expert', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Saved searches
CREATE TABLE public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches TO authenticated;
GRANT ALL ON public.saved_searches TO service_role;

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own saved searches" ON public.saved_searches
  FOR ALL TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_saved_searches_updated_at
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Market watchlist
CREATE TABLE public.market_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_watchlist TO authenticated;
GRANT ALL ON public.market_watchlist TO service_role;

ALTER TABLE public.market_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own watchlist" ON public.market_watchlist
  FOR ALL TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Expert reviews
CREATE TABLE public.expert_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_snapshot jsonb NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending_payment',
  fee_pence integer NOT NULL DEFAULT 4900,
  stripe_session_id text,
  expert_notes text,
  deliverable_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('pending_payment','paid','in_review','delivered','cancelled'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_reviews TO authenticated;
GRANT ALL ON public.expert_reviews TO service_role;

ALTER TABLE public.expert_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own reviews read" ON public.expert_reviews
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'expert') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Own reviews insert" ON public.expert_reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Experts update reviews" ON public.expert_reviews
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'expert') OR public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id)
  WITH CHECK (public.has_role(auth.uid(), 'expert') OR public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

CREATE TRIGGER set_expert_reviews_updated_at
  BEFORE UPDATE ON public.expert_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();