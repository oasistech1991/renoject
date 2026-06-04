
CREATE TABLE public.hmo_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  label text NOT NULL,
  location text,
  inputs jsonb NOT NULL,
  result jsonb NOT NULL,
  thumbnail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hmo_analyses TO anon, authenticated;
GRANT ALL ON public.hmo_analyses TO service_role;

ALTER TABLE public.hmo_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read hmo_analyses"   ON public.hmo_analyses FOR SELECT USING (true);
CREATE POLICY "Public can insert hmo_analyses" ON public.hmo_analyses FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update hmo_analyses" ON public.hmo_analyses FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete hmo_analyses" ON public.hmo_analyses FOR DELETE USING (true);

CREATE INDEX hmo_analyses_property_id_idx ON public.hmo_analyses(property_id);

CREATE TRIGGER hmo_analyses_set_updated_at
  BEFORE UPDATE ON public.hmo_analyses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
