
ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_business_number text;

CREATE TABLE IF NOT EXISTS public.feed_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  click_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.feed_share_links TO authenticated;
GRANT ALL ON public.feed_share_links TO service_role;

ALTER TABLE public.feed_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can insert share links"
  ON public.feed_share_links FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can read share links"
  ON public.feed_share_links FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR created_by = auth.uid());

CREATE INDEX IF NOT EXISTS feed_share_links_post_idx ON public.feed_share_links(post_id);
