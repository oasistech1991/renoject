CREATE TABLE public.crm_property_legal_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.crm_properties(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  storage_path text NOT NULL,
  document_type text,
  summary text,
  red_flag_count int NOT NULL DEFAULT 0,
  review_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_property_legal_packs TO authenticated;
GRANT ALL ON public.crm_property_legal_packs TO service_role;

ALTER TABLE public.crm_property_legal_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins read packs"
  ON public.crm_property_legal_packs FOR SELECT
  TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners insert packs"
  ON public.crm_property_legal_packs FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Owners and admins delete packs"
  ON public.crm_property_legal_packs FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX crm_property_legal_packs_property_idx ON public.crm_property_legal_packs(property_id);

-- Storage policies for legal/ prefix in property-media bucket
CREATE POLICY "Authenticated read legal packs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'property-media' AND (storage.foldername(name))[1] = 'legal');

CREATE POLICY "Authenticated upload legal packs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'property-media' AND (storage.foldername(name))[1] = 'legal' AND owner = auth.uid());
