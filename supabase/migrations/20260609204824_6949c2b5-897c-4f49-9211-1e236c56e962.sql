
DROP POLICY IF EXISTS "Authenticated write tokens"   ON public.tokens;
DROP POLICY IF EXISTS "Authenticated update tokens"  ON public.tokens;
DROP POLICY IF EXISTS "Authenticated delete tokens"  ON public.tokens;
CREATE POLICY "Admins write tokens"  ON public.tokens FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update tokens" ON public.tokens FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete tokens" ON public.tokens FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated write fractions"  ON public.token_fractions;
DROP POLICY IF EXISTS "Authenticated update fractions" ON public.token_fractions;
DROP POLICY IF EXISTS "Authenticated delete fractions" ON public.token_fractions;
CREATE POLICY "Admins write fractions"  ON public.token_fractions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update fractions" ON public.token_fractions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete fractions" ON public.token_fractions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated write holdings"  ON public.token_holdings;
DROP POLICY IF EXISTS "Authenticated update holdings" ON public.token_holdings;
DROP POLICY IF EXISTS "Authenticated delete holdings" ON public.token_holdings;
CREATE POLICY "Admins write holdings"  ON public.token_holdings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update holdings" ON public.token_holdings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete holdings" ON public.token_holdings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated write transfers" ON public.token_transfers;
CREATE POLICY "Admins write transfers" ON public.token_transfers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Experts update reviews" ON public.expert_reviews;
CREATE POLICY "Experts update reviews" ON public.expert_reviews FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'expert'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'expert'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete reviews" ON public.expert_reviews FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated read tradesmen"   ON public.tradesmen;
DROP POLICY IF EXISTS "Authenticated insert tradesmen" ON public.tradesmen;
DROP POLICY IF EXISTS "Authenticated update tradesmen" ON public.tradesmen;
DROP POLICY IF EXISTS "Authenticated delete tradesmen" ON public.tradesmen;
CREATE POLICY "Read own tradesmen"   ON public.tradesmen FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Insert own tradesmen" ON public.tradesmen FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Update own tradesmen" ON public.tradesmen FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Delete own tradesmen" ON public.tradesmen FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated read candidates"   ON public.tradesmen_candidates;
DROP POLICY IF EXISTS "Authenticated insert candidates" ON public.tradesmen_candidates;
DROP POLICY IF EXISTS "Authenticated update candidates" ON public.tradesmen_candidates;
DROP POLICY IF EXISTS "Authenticated delete candidates" ON public.tradesmen_candidates;
CREATE POLICY "Read own candidates"   ON public.tradesmen_candidates FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Insert own candidates" ON public.tradesmen_candidates FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Update own candidates" ON public.tradesmen_candidates FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Delete own candidates" ON public.tradesmen_candidates FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
