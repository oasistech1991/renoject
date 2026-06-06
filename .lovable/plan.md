## Goal

On `/tradesmen`, add a "Find tradesmen" flow: enter a town/city + trade, scrape Google Maps + review/social sources, run an AI "sense check" that flags complaints or bad reviews, then queue results for you to approve before they join the shared directory.

## User flow

1. On `/tradesmen`, click **Find tradesmen**.
2. Enter **Town/city** and **Trade** (e.g. "Manchester" + "Electrician"). Optional radius.
3. App scrapes sources in parallel, dedupes by name + phone, ranks by rating × review count × social presence.
4. Each candidate runs a **sense check** — AI scans recent reviews and social mentions for complaints, 1–2★ reviews, scam flags, unresolved disputes.
5. Results land in a **Review queue** with a status badge:
   - Clean — no issues found
   - Mixed — some negatives, summary shown
   - Flagged — recurring complaints, hidden by default
6. You click **Approve** to save into the shared `tradesmen` directory, or **Dismiss**.

## Sources (in priority order)

1. **Google Maps / Places API (New)** — primary. Already connected (`GOOGLE_MAPS_API_KEY` connector). Use `places:searchText` with query `"{trade} in {town}"`, fetch place details (rating, user_ratings_total, website, phone, recent reviews).
2. **Checkatrade / MyBuilder / Rated People / Trustpilot / Yell** — via **Firecrawl** (needs connector — will request after plan approval). Search-then-scrape pattern: `firecrawl.search("{trade} {town} site:checkatrade.com")` → scrape top results for reviews + contact.
3. **Facebook / Instagram pages** — Firecrawl scrape of public pages found via Google search; pull follower count, last-post recency as "social presence" signal. (No login-gated data.)

Each source contributes a partial profile; we merge by normalised name + phone.

## Sense check (AI)

Server fn `senseCheckTradesman` using Lovable AI (`google/gemini-3-flash-preview`):
- Input: merged profile + concatenated review/social snippets (truncated).
- Output (JSON): `{ verdict: "clean" | "mixed" | "flagged", complaintSummary: string, redFlags: string[], positiveSignals: string[] }`.
- Heuristics it must apply: recurring no-show complaints, unpaid-work disputes, fake-review patterns (bursts of 5★ same day), Trustpilot score <3, ratio of 1–2★ reviews >20%.

## Ranking score

`score = rating * log10(reviewCount + 1) + socialPresenceBonus - complaintPenalty`
Sorted desc; flagged entries hidden behind a toggle.

## Data model (one new table)

`tradesmen_candidates` — pending queue, separate from the live `tradesmen` directory.
- name, company, phone, email, area, website
- specialities text[]
- sources jsonb (per-source raw: google, checkatrade, facebook…)
- rating numeric, review_count int, social_presence_score int
- sense_check jsonb (verdict, summary, red flags)
- score numeric
- status: `pending` | `approved` | `dismissed`
- search_query text, searched_at timestamptz
- approved_tradesman_id uuid (set when promoted)

RLS: authenticated full access, mirrors `tradesmen`.

## Files

- **New migration** — `tradesmen_candidates` table + GRANTs + RLS.
- **`src/lib/tradesmen-scrape.functions.ts`** — server fns:
  - `searchTradesmen({ town, trade, radius? })` — orchestrates Google Places + Firecrawl, merges, runs sense check, writes rows into `tradesmen_candidates` with status `pending`, returns inserted IDs.
  - `approveCandidate({ id })` — inserts into `tradesmen`, marks candidate approved.
  - `dismissCandidate({ id })`.
- **`src/routes/tradesmen.tsx`** — add:
  - "Find tradesmen" button → dialog with town/trade form.
  - Tabs: **Directory** (existing) / **Review queue** (new) with candidate cards showing rating, review count, social presence, sense-check verdict + summary, source badges, Approve / Dismiss buttons.
- **Connector** — request Firecrawl connection (managed) after plan approval; Google Maps already connected.

## Costs / caveats (call out to user)

- Each search ≈ 1 Google Places text search + ~5–15 detail calls + 3–6 Firecrawl scrapes + 1 AI sense check per candidate. Expect a few cents per search.
- Checkatrade / MyBuilder ToS restrict scraping; we'll scrape only public listing pages and store summaries, not full review text. If you want to skip those two, say the word.
- Social presence is a weak signal from public pages only — no login.

## Out of scope (for now)

- No automatic re-scrape / freshness refresh.
- No per-project linking from HMO compliance (can add later — say the word).
- No outreach automation (sending enquiry emails).
