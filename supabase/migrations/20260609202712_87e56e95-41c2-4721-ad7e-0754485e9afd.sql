GRANT SELECT ON public.properties TO anon;
GRANT SELECT ON public.property_media TO anon;
GRANT SELECT ON public.hmo_analyses TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_media TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hmo_analyses TO authenticated;

GRANT ALL ON public.properties TO service_role;
GRANT ALL ON public.property_media TO service_role;
GRANT ALL ON public.hmo_analyses TO service_role;

CREATE POLICY "Anyone can read properties"
ON public.properties
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Anyone can read property media"
ON public.property_media
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Anyone can read HMO analyses"
ON public.hmo_analyses
FOR SELECT
TO anon
USING (true);