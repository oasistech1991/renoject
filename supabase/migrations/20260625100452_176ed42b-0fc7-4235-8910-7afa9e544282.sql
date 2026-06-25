CREATE TABLE public.feed_poll_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('yes','no')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_poll_votes TO authenticated;
GRANT ALL ON public.feed_poll_votes TO service_role;

ALTER TABLE public.feed_poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read poll votes"
  ON public.feed_poll_votes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users insert their own vote"
  ON public.feed_poll_votes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own vote"
  ON public.feed_poll_votes FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their own vote"
  ON public.feed_poll_votes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER set_feed_poll_votes_updated_at
  BEFORE UPDATE ON public.feed_poll_votes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();