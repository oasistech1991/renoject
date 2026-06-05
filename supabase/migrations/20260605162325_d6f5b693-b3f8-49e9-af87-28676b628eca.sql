CREATE TABLE public.tradesmen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  email TEXT,
  area_covered TEXT,
  specialities TEXT[] NOT NULL DEFAULT '{}',
  day_rate NUMERIC,
  call_out_fee NUMERIC,
  lead_time_days INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tradesmen TO authenticated;
GRANT ALL ON public.tradesmen TO service_role;

ALTER TABLE public.tradesmen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all tradesmen"
  ON public.tradesmen FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert tradesmen"
  ON public.tradesmen FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update tradesmen"
  ON public.tradesmen FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete tradesmen"
  ON public.tradesmen FOR DELETE TO authenticated USING (true);

CREATE TRIGGER tradesmen_set_updated_at
  BEFORE UPDATE ON public.tradesmen
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX tradesmen_specialities_idx ON public.tradesmen USING GIN (specialities);