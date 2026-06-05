DROP POLICY IF EXISTS "Authenticated users can view all tradesmen" ON public.tradesmen;
DROP POLICY IF EXISTS "Authenticated users can insert tradesmen" ON public.tradesmen;
DROP POLICY IF EXISTS "Authenticated users can update tradesmen" ON public.tradesmen;
DROP POLICY IF EXISTS "Authenticated users can delete tradesmen" ON public.tradesmen;

ALTER TABLE public.tradesmen ALTER COLUMN created_by DROP NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tradesmen TO anon;

CREATE POLICY "Public can read tradesmen"
  ON public.tradesmen FOR SELECT USING (true);
CREATE POLICY "Public can insert tradesmen"
  ON public.tradesmen FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update tradesmen"
  ON public.tradesmen FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete tradesmen"
  ON public.tradesmen FOR DELETE USING (true);