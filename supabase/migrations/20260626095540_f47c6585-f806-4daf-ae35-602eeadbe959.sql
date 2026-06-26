
CREATE OR REPLACE FUNCTION public.crm_on_feed_post_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  addr text;
BEGIN
  SELECT p.inputs->>'address' INTO addr FROM public.properties p WHERE p.id = NEW.property_id;
  IF addr IS NOT NULL AND length(trim(addr)) > 0 THEN
    INSERT INTO public.crm_properties (address, status, source_post_id, hero_image_url)
    VALUES (addr, 'sourcing', NEW.id, NULL)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
