DROP POLICY IF EXISTS "Author admin or self update interest" ON public.feed_interest;

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
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.feed_posts p
      WHERE p.id = feed_interest.post_id AND p.author_id = auth.uid()
    )
  );
