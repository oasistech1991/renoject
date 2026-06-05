
-- =========================================================
-- properties: keep public read, restrict writes to authenticated
-- =========================================================
DROP POLICY IF EXISTS "Public can insert properties" ON public.properties;
DROP POLICY IF EXISTS "Public can update properties" ON public.properties;
DROP POLICY IF EXISTS "Public can delete properties" ON public.properties;

CREATE POLICY "Authenticated can insert properties"
  ON public.properties FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated can update properties"
  ON public.properties FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete properties"
  ON public.properties FOR DELETE TO authenticated
  USING (true);

-- =========================================================
-- hmo_analyses
-- =========================================================
DROP POLICY IF EXISTS "Public can insert hmo_analyses" ON public.hmo_analyses;
DROP POLICY IF EXISTS "Public can update hmo_analyses" ON public.hmo_analyses;
DROP POLICY IF EXISTS "Public can delete hmo_analyses" ON public.hmo_analyses;

CREATE POLICY "Authenticated can insert hmo_analyses"
  ON public.hmo_analyses FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated can update hmo_analyses"
  ON public.hmo_analyses FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete hmo_analyses"
  ON public.hmo_analyses FOR DELETE TO authenticated
  USING (true);

-- =========================================================
-- property_media
-- =========================================================
DROP POLICY IF EXISTS "Public can insert property_media" ON public.property_media;
DROP POLICY IF EXISTS "Public can update property_media" ON public.property_media;
DROP POLICY IF EXISTS "Public can delete property_media" ON public.property_media;

CREATE POLICY "Authenticated can insert property_media"
  ON public.property_media FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated can update property_media"
  ON public.property_media FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete property_media"
  ON public.property_media FOR DELETE TO authenticated
  USING (true);

-- =========================================================
-- tokens
-- =========================================================
DROP POLICY IF EXISTS "Public write tokens" ON public.tokens;
DROP POLICY IF EXISTS "Public update tokens" ON public.tokens;
DROP POLICY IF EXISTS "Public delete tokens" ON public.tokens;

CREATE POLICY "Authenticated write tokens"
  ON public.tokens FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated update tokens"
  ON public.tokens FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete tokens"
  ON public.tokens FOR DELETE TO authenticated
  USING (true);

-- =========================================================
-- token_fractions
-- =========================================================
DROP POLICY IF EXISTS "Public write fractions" ON public.token_fractions;
DROP POLICY IF EXISTS "Public update fractions" ON public.token_fractions;
DROP POLICY IF EXISTS "Public delete fractions" ON public.token_fractions;

CREATE POLICY "Authenticated write fractions"
  ON public.token_fractions FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated update fractions"
  ON public.token_fractions FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete fractions"
  ON public.token_fractions FOR DELETE TO authenticated
  USING (true);

-- =========================================================
-- token_holdings
-- =========================================================
DROP POLICY IF EXISTS "Public write holdings" ON public.token_holdings;
DROP POLICY IF EXISTS "Public update holdings" ON public.token_holdings;
DROP POLICY IF EXISTS "Public delete holdings" ON public.token_holdings;

CREATE POLICY "Authenticated write holdings"
  ON public.token_holdings FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated update holdings"
  ON public.token_holdings FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete holdings"
  ON public.token_holdings FOR DELETE TO authenticated
  USING (true);

-- =========================================================
-- token_transfers
-- =========================================================
DROP POLICY IF EXISTS "Public write transfers" ON public.token_transfers;

CREATE POLICY "Authenticated write transfers"
  ON public.token_transfers FOR INSERT TO authenticated
  WITH CHECK (true);

-- =========================================================
-- storage.objects: property-media bucket — public read, authed writes
-- =========================================================
DROP POLICY IF EXISTS "Public can upload property-media objects" ON storage.objects;
DROP POLICY IF EXISTS "Public can update property-media objects" ON storage.objects;
DROP POLICY IF EXISTS "Public can delete property-media objects" ON storage.objects;

CREATE POLICY "Authenticated can upload property-media objects"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'property-media');
CREATE POLICY "Authenticated can update property-media objects"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'property-media')
  WITH CHECK (bucket_id = 'property-media');
CREATE POLICY "Authenticated can delete property-media objects"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'property-media');

-- =========================================================
-- user_roles: restrictive policy blocking non-admin self-grant
-- =========================================================
CREATE POLICY "Block non-admin role inserts"
  ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block non-admin role updates"
  ON public.user_roles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block non-admin role deletes"
  ON public.user_roles AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
