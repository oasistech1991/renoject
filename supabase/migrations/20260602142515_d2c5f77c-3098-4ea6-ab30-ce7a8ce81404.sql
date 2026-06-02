CREATE TABLE public.property_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('image','pdf')),
  filename text,
  is_hero boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_property_media_property ON public.property_media(property_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_media TO anon, authenticated;
GRANT ALL ON public.property_media TO service_role;

ALTER TABLE public.property_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read property_media" ON public.property_media FOR SELECT USING (true);
CREATE POLICY "Public can insert property_media" ON public.property_media FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update property_media" ON public.property_media FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete property_media" ON public.property_media FOR DELETE USING (true);

-- Storage policies for the property-media bucket
CREATE POLICY "Public can read property-media objects"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-media');

CREATE POLICY "Public can upload property-media objects"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'property-media');

CREATE POLICY "Public can update property-media objects"
ON storage.objects FOR UPDATE
USING (bucket_id = 'property-media')
WITH CHECK (bucket_id = 'property-media');

CREATE POLICY "Public can delete property-media objects"
ON storage.objects FOR DELETE
USING (bucket_id = 'property-media');