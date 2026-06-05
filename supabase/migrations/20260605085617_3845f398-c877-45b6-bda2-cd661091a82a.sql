
-- Tokenization tables for the Tokenize demo tab
CREATE TABLE public.tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  chain text NOT NULL DEFAULT 'base-sim',
  owner_wallet text NOT NULL,
  minted_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tokens TO anon, authenticated;
GRANT ALL ON public.tokens TO service_role;
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read tokens" ON public.tokens FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public write tokens" ON public.tokens FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update tokens" ON public.tokens FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete tokens" ON public.tokens FOR DELETE TO anon, authenticated USING (true);
CREATE TRIGGER tokens_updated BEFORE UPDATE ON public.tokens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.token_fractions (
  token_id uuid PRIMARY KEY REFERENCES public.tokens(id) ON DELETE CASCADE,
  total_supply integer NOT NULL CHECK (total_supply > 0),
  price_per_share_pence integer NOT NULL CHECK (price_per_share_pence >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.token_fractions TO anon, authenticated;
GRANT ALL ON public.token_fractions TO service_role;
ALTER TABLE public.token_fractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read fractions" ON public.token_fractions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public write fractions" ON public.token_fractions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update fractions" ON public.token_fractions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete fractions" ON public.token_fractions FOR DELETE TO anon, authenticated USING (true);
CREATE TRIGGER token_fractions_updated BEFORE UPDATE ON public.token_fractions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.token_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  holder text NOT NULL,
  shares integer NOT NULL CHECK (shares >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token_id, holder)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.token_holdings TO anon, authenticated;
GRANT ALL ON public.token_holdings TO service_role;
ALTER TABLE public.token_holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read holdings" ON public.token_holdings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public write holdings" ON public.token_holdings FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update holdings" ON public.token_holdings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete holdings" ON public.token_holdings FOR DELETE TO anon, authenticated USING (true);
CREATE TRIGGER token_holdings_updated BEFORE UPDATE ON public.token_holdings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.token_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('mint','whole','shares')),
  from_party text,
  to_party text NOT NULL,
  amount integer NOT NULL DEFAULT 1,
  tx_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.token_transfers TO anon, authenticated;
GRANT ALL ON public.token_transfers TO service_role;
ALTER TABLE public.token_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read transfers" ON public.token_transfers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public write transfers" ON public.token_transfers FOR INSERT TO anon, authenticated WITH CHECK (true);
