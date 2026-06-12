
-- Settings (one row per user)
CREATE TABLE public.portfolio_capital_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  starting_capital numeric NOT NULL DEFAULT 0,
  starting_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_capital_settings TO authenticated;
GRANT ALL ON public.portfolio_capital_settings TO service_role;

ALTER TABLE public.portfolio_capital_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own capital settings"
  ON public.portfolio_capital_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_portfolio_capital_settings_updated_at
  BEFORE UPDATE ON public.portfolio_capital_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Injections (many per user)
CREATE TABLE public.portfolio_capital_injections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_capital_injections TO authenticated;
GRANT ALL ON public.portfolio_capital_injections TO service_role;

ALTER TABLE public.portfolio_capital_injections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own capital injections"
  ON public.portfolio_capital_injections
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX portfolio_capital_injections_user_date_idx
  ON public.portfolio_capital_injections (user_id, date);

CREATE TRIGGER set_portfolio_capital_injections_updated_at
  BEFORE UPDATE ON public.portfolio_capital_injections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
