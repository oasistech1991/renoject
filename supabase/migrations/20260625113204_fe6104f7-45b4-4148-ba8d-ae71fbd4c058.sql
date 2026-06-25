
CREATE TABLE public.direct_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) > 0 AND length(body) <= 4000),
  deal_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX direct_messages_client_created_idx ON public.direct_messages (client_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Clients can read their own thread; admins can read all
CREATE POLICY "Read own thread or admin"
  ON public.direct_messages FOR SELECT
  TO authenticated
  USING (client_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Clients can send only as themselves into their own thread; admins can send into any thread
CREATE POLICY "Send as self into own thread or admin"
  ON public.direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      client_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- Mark-as-read updates: recipient side
CREATE POLICY "Update read status on own thread or admin"
  ON public.direct_messages FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (client_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
