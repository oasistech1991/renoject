CREATE TABLE public.copilot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX copilot_messages_user_created_idx ON public.copilot_messages (user_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.copilot_messages TO authenticated;
GRANT ALL ON public.copilot_messages TO service_role;

ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copilot_messages_select_own" ON public.copilot_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "copilot_messages_insert_own" ON public.copilot_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "copilot_messages_delete_own" ON public.copilot_messages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);