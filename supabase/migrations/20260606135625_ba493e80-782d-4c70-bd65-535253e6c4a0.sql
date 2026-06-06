
-- tradesmen
DROP POLICY IF EXISTS "Public can read tradesmen" ON public.tradesmen;
DROP POLICY IF EXISTS "Public can insert tradesmen" ON public.tradesmen;
DROP POLICY IF EXISTS "Public can update tradesmen" ON public.tradesmen;
DROP POLICY IF EXISTS "Public can delete tradesmen" ON public.tradesmen;

CREATE POLICY "Authenticated read tradesmen" ON public.tradesmen
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert tradesmen" ON public.tradesmen
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update tradesmen" ON public.tradesmen
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete tradesmen" ON public.tradesmen
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

REVOKE ALL ON public.tradesmen FROM anon;

-- tradesmen_candidates
DROP POLICY IF EXISTS "Anyone can view candidates" ON public.tradesmen_candidates;
DROP POLICY IF EXISTS "Anyone can insert candidates" ON public.tradesmen_candidates;
DROP POLICY IF EXISTS "Anyone can update candidates" ON public.tradesmen_candidates;
DROP POLICY IF EXISTS "Anyone can delete candidates" ON public.tradesmen_candidates;

CREATE POLICY "Authenticated read candidates" ON public.tradesmen_candidates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert candidates" ON public.tradesmen_candidates
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update candidates" ON public.tradesmen_candidates
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete candidates" ON public.tradesmen_candidates
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

REVOKE ALL ON public.tradesmen_candidates FROM anon;

-- token_holdings
DROP POLICY IF EXISTS "Public read holdings" ON public.token_holdings;
CREATE POLICY "Authenticated read holdings" ON public.token_holdings
  FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.token_holdings FROM anon;

-- token_transfers
DROP POLICY IF EXISTS "Public read transfers" ON public.token_transfers;
CREATE POLICY "Authenticated read transfers" ON public.token_transfers
  FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.token_transfers FROM anon;
