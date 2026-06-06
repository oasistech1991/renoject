## Problem

The "Find tradesmen" search runs and inserts candidates correctly (34 pending rows exist in the DB right now, all from your recent "Electrician in Manchester" run), but the **Review queue** tab looks empty.

The cause is the recent security tightening. `tradesmen_candidates` now requires an authenticated Supabase session to read:

```
Authenticated read candidates  SELECT  authenticated  USING (true)
```

The Review queue currently reads with the browser Supabase client. If the page is opened without a signed-in Supabase session (e.g. via the "admin unlock" sessionStorage flag, or after a session expired), RLS silently returns zero rows — no error toast, just an empty list. Meanwhile the search itself still works because it runs server-side via `supabaseAdmin`, which bypasses RLS.

## Fix

Route the queue reads through the same trusted server path as the writes, so the directory works for any user who can already use the rest of the page.

### Changes

1. **`src/lib/tradesmen-scrape.functions.ts`** — add two server functions:
   - `listCandidates({ status: "pending" })` — uses `supabaseAdmin` to return pending candidates ordered by `score desc`.
   - (Optional) `listCandidateStats()` if we later want counts per location; not required for this fix.

2. **`src/routes/tradesmen.tsx` → `ReviewQueue`**:
   - Replace the direct `supabase.from("tradesmen_candidates").select(...)` in `load()` with a `useServerFn(listCandidates)` call.
   - Keep the existing client-side sort/segment/group logic unchanged.
   - Keep `approveCandidate` / `dismissCandidate` / `resetReviewQueue` as-is (already server fns).

3. **No DB / RLS changes.** The shared-workspace policy stays intact; we just stop relying on the browser client for this read.

### Out of scope

- No UI redesign of the queue.
- No change to `searchTradesmen`, scoring, or scraping logic.
- No change to the `tradesmen` directory read (that one already works because rows are visible to everyone with grants).
