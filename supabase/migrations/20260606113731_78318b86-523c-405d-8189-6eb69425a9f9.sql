CREATE TABLE public.tradesmen_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID,
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  email TEXT,
  area_covered TEXT,
  website TEXT,
  specialities TEXT[] NOT NULL DEFAULT '{}',
  sources JSONB NOT NULL DEFAULT '{}'::jsonb,
  rating NUMERIC,
  review_count INTEGER,
  social_presence_score INTEGER,
  sense_check JSONB,
  score NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  search_query TEXT,
  searched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_tradesman_id UUID REFERENCES public.tradesmen(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tradesmen_candidates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tradesmen_candidates TO anon;
GRANT ALL ON public.tradesmen_candidates TO service_role;

ALTER TABLE public.tradesmen_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view candidates" ON public.tradesmen_candidates FOR SELECT USING (true);
CREATE POLICY "Anyone can insert candidates" ON public.tradesmen_candidates FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update candidates" ON public.tradesmen_candidates FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete candidates" ON public.tradesmen_candidates FOR DELETE USING (true);

CREATE INDEX idx_tradesmen_candidates_status ON public.tradesmen_candidates(status);
CREATE INDEX idx_tradesmen_candidates_searched_at ON public.tradesmen_candidates(searched_at DESC);

CREATE TRIGGER set_tradesmen_candidates_updated_at
  BEFORE UPDATE ON public.tradesmen_candidates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();