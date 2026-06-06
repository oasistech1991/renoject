## 1. Reset button on Review queue

Add a **"Reset queue"** button next to the existing flagged-toggle in `ReviewQueue` (src/routes/tradesmen.tsx). It opens a confirm dialog and then bulk-updates every `pending` candidate to `status = 'dismissed'`, so the queue is empty but historical rows remain auditable. After success it reloads the list and toasts "Queue cleared".

## 2. Fix Middlesbrough (and all) review counts

Checked the DB for `search_query ilike '%middles%'`. The Google Places counts being stored (e.g. M B Builders = 4, jdc builders = 2, BMAC = 9) are exactly what Google's Places API returns for those Place IDs. The undercount has three real causes:

1. **Wrong listing matched.** The misspelled query `"builder in middlesborough"` (should be *Middlesbrough*) made Places match smaller/older profiles. We will normalise the town input server-side (trim, collapse whitespace, common misspelling map for Middlesbrough/Middlesborough) before sending it to Google Places.
2. **Firecrawl snippets are useless for counts.** Checkatrade snippets are the Cloudflare block page, MyBuilder snippets are the generic category landing page — so `extractReviewCount` finds nothing and we never add platform totals. Fix: instead of relying on `search()` description snippets, do a targeted `scrape()` of the top Checkatrade / Trustpilot / MyBuilder / Yell result with `formats: ['markdown']`, then run `extractReviewCount` on the full page text. Cache the parsed count per platform in `sources[host].reviewCount`.
3. **Google `userRatingCount` is authoritative for Google itself** — keep it, but display review counts as a **per-platform breakdown** (see §3) rather than a single number, so the user can see *why* a total looks low and never feels the count is wrong vs. Google.

We will also store the Google Maps URL (`https://www.google.com/maps/place/?q=place_id:<id>`) in `sources.google.url` so the Google badge becomes a clickable proof link, making it trivial to compare against the real Google listing.

## 3. Review breakdown dropdown on each card

Replace the single `Star · rating (count)` line with a collapsible **"Reviews"** section (shadcn `Collapsible`) on each candidate card:

- **Header row** shows aggregated total: `★ 4.8 · 47 reviews across 3 sources`.
- **Expanded** shows one row per source with:
  - source name (clickable link to the source URL),
  - star rating if known,
  - review count for that source,
  - up to 3 representative snippets (uses `reviewSnippets` already collected, grouped by host).

Snippets are stored in a new JSONB column `review_breakdown` on `tradesmen_candidates` (`[{source, url, rating, count, snippets: [{text, rating, date, location}]}]`) populated by the scraping step. Backwards compatible: existing rows fall back to the old `sources` + `review_count`.

## 4. Sort / segment the review queue

Add a small toolbar above the queue grid with:

- **Sort by** select: `Best score` (current default) · `Most reviews` · `Highest rated` · `Newest searched`.
- **Segment** select: `All` · `By location` (groups cards under `area_covered` town/city headings) · `Latest only` (last 24h of `searched_at`).

Implemented purely client-side over the already-loaded `items` array — no schema or server changes needed for sorting/segmentation themselves.

## Technical notes

- Files touched: `src/routes/tradesmen.tsx` (UI, reset, sort/segment, breakdown), `src/lib/tradesmen-scrape.functions.ts` (targeted platform scrapes, Google URL, town normalisation, `review_breakdown` write).
- New migration: add `review_breakdown jsonb` to `public.tradesmen_candidates` (nullable, default `null`); no policy changes needed.
- New server function `resetReviewQueue` (admin-only via `requireSupabaseAuth`) that bulk-dismisses pending rows; called by the Reset button.
- No new dependencies.
