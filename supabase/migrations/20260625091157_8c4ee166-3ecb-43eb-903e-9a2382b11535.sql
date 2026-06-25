
-- Add ownership columns
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.hmo_analyses ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.property_media ADD COLUMN IF NOT EXISTS created_by uuid;

-- Backfill nulls to existing admin so app continues to work for the owner
UPDATE public.properties SET created_by = '2d2e8685-978e-4140-a8ad-41619848e42f' WHERE created_by IS NULL;
UPDATE public.hmo_analyses SET created_by = '2d2e8685-978e-4140-a8ad-41619848e42f' WHERE created_by IS NULL;
UPDATE public.property_media SET created_by = '2d2e8685-978e-4140-a8ad-41619848e42f' WHERE created_by IS NULL;

ALTER TABLE public.properties ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.hmo_analyses ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.property_media ALTER COLUMN created_by SET DEFAULT auth.uid();

-- ============ properties: tighten UPDATE/DELETE ============
DROP POLICY IF EXISTS "Authenticated can update properties" ON public.properties;
DROP POLICY IF EXISTS "Authenticated can delete properties" ON public.properties;
DROP POLICY IF EXISTS "Authenticated can insert properties" ON public.properties;

CREATE POLICY "Insert own properties" ON public.properties
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Update own properties" ON public.properties
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Delete own properties" ON public.properties
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ hmo_analyses: tighten INSERT/UPDATE/DELETE ============
DROP POLICY IF EXISTS "Authenticated can insert hmo_analyses" ON public.hmo_analyses;
DROP POLICY IF EXISTS "Authenticated can update hmo_analyses" ON public.hmo_analyses;
DROP POLICY IF EXISTS "Authenticated can delete hmo_analyses" ON public.hmo_analyses;

CREATE POLICY "Insert own hmo_analyses" ON public.hmo_analyses
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Update own hmo_analyses" ON public.hmo_analyses
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Delete own hmo_analyses" ON public.hmo_analyses
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ property_media: scope to owning property ============
DROP POLICY IF EXISTS "Authenticated can insert property_media" ON public.property_media;
DROP POLICY IF EXISTS "Authenticated can update property_media" ON public.property_media;
DROP POLICY IF EXISTS "Authenticated can delete property_media" ON public.property_media;

CREATE POLICY "Insert own property_media" ON public.property_media
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_media.property_id
        AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "Update own property_media" ON public.property_media
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_media.property_id AND p.created_by = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_media.property_id AND p.created_by = auth.uid())
  );

CREATE POLICY "Delete own property_media" ON public.property_media
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_media.property_id AND p.created_by = auth.uid())
  );

-- ============ storage: property-media bucket ============
DROP POLICY IF EXISTS "Authenticated can read property-media objects" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload property-media objects" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can insert property-media objects" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update property-media objects" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete property-media objects" ON storage.objects;

CREATE POLICY "Read own property-media objects" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'property-media' AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id::text = (storage.foldername(name))[1]
          AND p.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Insert own property-media objects" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'property-media' AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id::text = (storage.foldername(name))[1]
          AND p.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Update own property-media objects" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'property-media' AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id::text = (storage.foldername(name))[1]
          AND p.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Delete own property-media objects" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'property-media' AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id::text = (storage.foldername(name))[1]
          AND p.created_by = auth.uid()
      )
    )
  );

-- ============ expert_reviews: tighten INSERT ============
DROP POLICY IF EXISTS "Own reviews insert" ON public.expert_reviews;
CREATE POLICY "Own reviews insert" ON public.expert_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND fee_pence = 4900
    AND status = 'pending_payment'
    AND stripe_session_id IS NULL
    AND deliverable_url IS NULL
    AND expert_notes IS NULL
  );

-- ============ token_transfers: explicit admin UPDATE/DELETE ============
CREATE POLICY "Admins update transfers" ON public.token_transfers
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete transfers" ON public.token_transfers
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
