
CREATE TABLE public.portfolio_timeline_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  purchase_date date,
  refi_month_offset integer,
  assigned_to_property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planned',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, property_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_timeline_entries TO authenticated;
GRANT ALL ON public.portfolio_timeline_entries TO service_role;

ALTER TABLE public.portfolio_timeline_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own timeline" ON public.portfolio_timeline_entries
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Insert own timeline" ON public.portfolio_timeline_entries
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own timeline" ON public.portfolio_timeline_entries
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own timeline" ON public.portfolio_timeline_entries
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER set_portfolio_timeline_updated_at
  BEFORE UPDATE ON public.portfolio_timeline_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_portfolio_timeline_user ON public.portfolio_timeline_entries(user_id);
CREATE INDEX idx_portfolio_timeline_property ON public.portfolio_timeline_entries(property_id);
