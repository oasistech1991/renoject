CREATE TABLE public.legal_source_cache (
  title TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.legal_source_cache TO service_role;

ALTER TABLE public.legal_source_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read legal source cache"
  ON public.legal_source_cache
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));