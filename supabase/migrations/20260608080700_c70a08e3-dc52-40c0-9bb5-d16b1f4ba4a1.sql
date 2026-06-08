DROP POLICY IF EXISTS "Public read tokens" ON public.tokens;
CREATE POLICY "Authenticated read tokens" ON public.tokens FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read fractions" ON public.token_fractions;
CREATE POLICY "Authenticated read fractions" ON public.token_fractions FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.tokens FROM anon;
REVOKE SELECT ON public.token_fractions FROM anon;