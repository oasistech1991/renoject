
DROP POLICY IF EXISTS "Public can read properties" ON public.properties;
CREATE POLICY "Authenticated can read properties" ON public.properties FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public can read hmo_analyses" ON public.hmo_analyses;
CREATE POLICY "Authenticated can read hmo_analyses" ON public.hmo_analyses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public can read property_media" ON public.property_media;
CREATE POLICY "Authenticated can read property_media" ON public.property_media FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.properties FROM anon;
REVOKE SELECT ON public.hmo_analyses FROM anon;
REVOKE SELECT ON public.property_media FROM anon;

DROP POLICY IF EXISTS "Public can read property-media objects" ON storage.objects;
CREATE POLICY "Authenticated can read property-media objects" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'property-media');
