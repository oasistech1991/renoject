## Why this is happening

`tradesmen_candidates` has correct RLS policies for the `authenticated` role, but the table has **zero table-level GRANTs**. Supabase's Data API (PostgREST) checks role grants *before* RLS — with no grants, every request from the browser client fails with `permission denied for table tradesmen_candidates`, even for signed-in users. That's why the Review queue read worked via `supabaseAdmin` (service role bypasses both) but direct browser reads/writes fail.

This likely happened when a recent security migration dropped/recreated the table or revoked default grants without re-issuing them.

## Fix

One migration to add the Data API grants matching the existing policies (auth-only, so no `anon`):

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tradesmen_candidates TO authenticated;
GRANT ALL ON public.tradesmen_candidates TO service_role;
```

I'll also audit the other recently-touched tables in this area (`tradesmen`, `hmo_analyses`, `expert_reviews`, `properties`, `property_media`, `market_watchlist`, `saved_searches`, `subscriptions`, `tokens`, `token_holdings`, `token_fractions`, `token_transfers`, `user_roles`) in the same migration and add any missing grants based on each table's existing policies (skipping `anon` for auth-only tables).

## Out of scope

- No RLS policy changes.
- No code changes — once grants are restored, the existing browser-client reads/writes start working again.
