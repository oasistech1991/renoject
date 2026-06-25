-- ============================================================
-- CLIENT FEED MIGRATION
-- ============================================================

-- Auto-assign 'client' role on new user signup (admins can be promoted later)
CREATE OR REPLACE FUNCTION public.handle_new_user_default_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user_default_role() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_client ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_client
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_default_role();

-- ============================================================
-- client_profiles
-- ============================================================
CREATE TABLE public.client_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  investor_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_profiles TO authenticated;
GRANT ALL ON public.client_profiles TO service_role;

ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view profiles"
  ON public.client_profiles FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users manage their own profile"
  ON public.client_profiles FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER client_profiles_set_updated_at
  BEFORE UPDATE ON public.client_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- feed_posts
-- ============================================================
CREATE TABLE public.feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caption TEXT,
  cover_url TEXT,
  display_mode TEXT NOT NULL DEFAULT 'teaser' CHECK (display_mode IN ('teaser', 'full')),
  hidden_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_posts TO authenticated;
GRANT ALL ON public.feed_posts TO service_role;

ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view published posts or own"
  ON public.feed_posts FOR SELECT
  TO authenticated
  USING (
    is_published = true
    OR author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Owner or admin can insert posts"
  ON public.feed_posts FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner or admin can update posts"
  ON public.feed_posts FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner or admin can delete posts"
  ON public.feed_posts FOR DELETE
  TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER feed_posts_set_updated_at
  BEFORE UPDATE ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_feed_posts_published ON public.feed_posts(is_published, created_at DESC);

-- ============================================================
-- feed_reactions
-- ============================================================
CREATE TABLE public.feed_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('like', 'love', 'fire')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_reactions TO authenticated;
GRANT ALL ON public.feed_reactions TO service_role;

ALTER TABLE public.feed_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view all reactions"
  ON public.feed_reactions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users manage own reactions"
  ON public.feed_reactions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_feed_reactions_post ON public.feed_reactions(post_id);

-- ============================================================
-- feed_comments
-- ============================================================
CREATE TABLE public.feed_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_comments TO authenticated;
GRANT ALL ON public.feed_comments TO service_role;

ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view comments"
  ON public.feed_comments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users insert own comments"
  ON public.feed_comments FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own comments"
  ON public.feed_comments FOR UPDATE
  TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users or admin delete comments"
  ON public.feed_comments FOR DELETE
  TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER feed_comments_set_updated_at
  BEFORE UPDATE ON public.feed_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_feed_comments_post ON public.feed_comments(post_id, created_at);

-- ============================================================
-- feed_interest
-- ============================================================
CREATE TABLE public.feed_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_interest TO authenticated;
GRANT ALL ON public.feed_interest TO service_role;

ALTER TABLE public.feed_interest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Author admin or self view interest"
  ON public.feed_interest FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.feed_posts p
      WHERE p.id = feed_interest.post_id AND p.author_id = auth.uid()
    )
  );

CREATE POLICY "Users insert own interest"
  ON public.feed_interest FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Author admin or self update interest"
  ON public.feed_interest FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.feed_posts p
      WHERE p.id = feed_interest.post_id AND p.author_id = auth.uid()
    )
  )
  WITH CHECK (true);

CREATE POLICY "Users delete own interest"
  ON public.feed_interest FOR DELETE
  TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER feed_interest_set_updated_at
  BEFORE UPDATE ON public.feed_interest
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_feed_interest_post ON public.feed_interest(post_id);

-- ============================================================
-- feed_saves
-- ============================================================
CREATE TABLE public.feed_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_saves TO authenticated;
GRANT ALL ON public.feed_saves TO service_role;

ALTER TABLE public.feed_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own saves"
  ON public.feed_saves FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users manage own saves"
  ON public.feed_saves FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
