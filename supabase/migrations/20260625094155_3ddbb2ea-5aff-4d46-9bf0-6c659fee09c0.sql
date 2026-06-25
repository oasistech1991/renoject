
-- 1) Remove anon SELECT + tighten authenticated SELECT on user-owned tables
DROP POLICY IF EXISTS "Anyone can read properties" ON public.properties;
DROP POLICY IF EXISTS "Authenticated can read properties" ON public.properties;
CREATE POLICY "Read own properties" ON public.properties
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can read HMO analyses" ON public.hmo_analyses;
DROP POLICY IF EXISTS "Authenticated can read hmo_analyses" ON public.hmo_analyses;
CREATE POLICY "Read own hmo_analyses" ON public.hmo_analyses
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can read property media" ON public.property_media;
DROP POLICY IF EXISTS "Authenticated can read property_media" ON public.property_media;
CREATE POLICY "Read own property_media" ON public.property_media
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_media.property_id AND p.created_by = auth.uid()
    )
  );

-- Revoke anon Data API grants on these tables (defensive; policies already block reads)
REVOKE SELECT ON public.properties FROM anon;
REVOKE SELECT ON public.hmo_analyses FROM anon;
REVOKE SELECT ON public.property_media FROM anon;

-- 2) Fix broken storage policies for property-media bucket
DROP POLICY IF EXISTS "Read own property-media objects" ON storage.objects;
DROP POLICY IF EXISTS "Insert own property-media objects" ON storage.objects;
DROP POLICY IF EXISTS "Update own property-media objects" ON storage.objects;
DROP POLICY IF EXISTS "Delete own property-media objects" ON storage.objects;

CREATE POLICY "Read own property-media objects" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'property-media'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
          AND p.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Insert own property-media objects" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'property-media'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
          AND p.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Update own property-media objects" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'property-media'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
          AND p.created_by = auth.uid()
      )
    )
  )
  WITH CHECK (
    bucket_id = 'property-media'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
          AND p.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Delete own property-media objects" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'property-media'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
          AND p.created_by = auth.uid()
      )
    )
  );

-- 3) Lock down SECURITY DEFINER functions: revoke EXECUTE from PUBLIC and anon.
-- has_role / has_active_subscription are referenced in RLS policies, so
-- authenticated must retain EXECUTE for policy evaluation. set_updated_at is
-- only used by triggers, so revoke from authenticated as well.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;
