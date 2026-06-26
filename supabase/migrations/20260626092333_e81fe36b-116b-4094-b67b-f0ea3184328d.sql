DROP POLICY IF EXISTS "Authenticated read legal packs" ON storage.objects;

CREATE POLICY "Legal pack owner or admin read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'property-media'
  AND (storage.foldername(name))[1] = 'legal'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.crm_property_legal_packs lp
      WHERE lp.storage_path = storage.objects.name
        AND lp.uploaded_by = auth.uid()
    )
  )
);