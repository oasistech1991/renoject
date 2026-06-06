## Goal
Add a **"Further analyse"** button to each candidate card on `/tradesmen` that runs a deeper background check on the company and its directors, combining official Companies House data with AI-summarised web research (CCJs, complaints, news, reputation). Results expand inline on the card and are persisted on the candidate row so they don't have to be re-run.

## What the user sees
- New **"Further analyse"** button on each pending candidate card (next to existing Approve / Dismiss).
- Clicking it shows a loading state, then expands an inline panel below the existing sense check / review breakdown with:
  - **Company match** — best Companies House match (name, company number, status, incorporation date, address, SIC codes), plus a link to its Companies House page.
  - **Directors** — each active director: name, role, appointed date, nationality, and a count of their other active / dissolved / resigned appointments. Highlights directors with many dissolved companies.
  - **Risk signals** — bullet list (e.g. "3 of director's 5 companies dissolved", "Company filed accounts late", "Active proposal to strike off").
  - **CCJ / reputation web check** — AI summary from Firecrawl search of "{company} CCJ / complaints / scam / reviews" with cited source links.
  - **Overall verdict** — `clean` / `watch` / `flagged` badge with one-line rationale.
- Once run, the panel stays expanded by default and a small "Re-run analysis" link lets the user refresh it.

## Data sources
1. **Companies House Public Data API** (free, requires API key) — for company search, company profile, officers list, and per-director appointments. Needs a new secret `COMPANIES_HOUSE_API_KEY`.
2. **Firecrawl search + Lovable AI** — for CCJ register mentions, Trustpilot/forum complaints, news; AI synthesises into structured JSON. Already configured.

## Persistence
New JSONB column `background_check` on `tradesmen_candidates` storing the full structured report plus `checked_at`. UI shows cached result if present; button label becomes "Re-run analysis".

## Technical changes

**Migration**
- Add `background_check jsonb` and `background_checked_at timestamptz` to `tradesmen_candidates`.

**Secret**
- Request `COMPANIES_HOUSE_API_KEY` via `add_secret` (user gets it free from developer.company-information.service.gov.uk).

**Server function** — `src/lib/tradesmen-background.functions.ts`
- `runBackgroundCheck({ id })`:
  1. Load candidate row.
  2. Call Companies House `/search/companies?q={company name}` → pick top match scoring on name similarity + address town overlap with candidate's `area_covered`.
  3. Fetch `/company/{number}` and `/company/{number}/officers`.
  4. For each active director (limit ~5): fetch `/officers/{officer_id}/appointments`, tally active/dissolved/resigned counts.
  5. Firecrawl search for `"{company} CCJ"`, `"{company} complaints scam"`, `"{director name} director"` (2–3 queries, limit 4 each).
  6. Pass structured payload to Lovable AI (`google/gemini-3-flash-preview`) with a tool-call schema → returns `{ verdict, summary, riskSignals[], positiveSignals[], directorFlags[] }`.
  7. Compose final `background_check` JSON (raw Companies House data + AI verdict + web sources) and persist.
  8. Return it to the client.

**UI** — `src/routes/tradesmen.tsx`
- Add Tanstack Query mutation calling the new server fn; on success update the candidate's local cache.
- Add "Further analyse" / "Re-run analysis" button.
- Add a `<Collapsible>` panel rendering the structured report with badges, director rows, and clickable source links.

## Out of scope
- Real CCJ register lookup (Trust Online is paid + per-search). We surface only public web mentions and clearly label the CCJ section as "Public web mentions, not an official register check".
- Editing the approved `tradesmen` table — this only enriches the candidate review queue.
