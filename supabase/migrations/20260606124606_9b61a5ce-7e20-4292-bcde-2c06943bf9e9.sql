ALTER TABLE public.tradesmen_candidates
  ADD COLUMN IF NOT EXISTS background_check jsonb,
  ADD COLUMN IF NOT EXISTS background_checked_at timestamptz;