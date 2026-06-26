## Upgrade `/legal` with the `property-legal-uk` skill + live UK source fetch

### What changes

**1. New UK-aware system prompt (server-side)**

Lift the analysis framework from the repo's `property-legal-uk` plugin into a single prompt constant in a new file `src/lib/legal-review.uk-prompt.ts`. It instructs Gemini to:

- Assume **English & Welsh law** by default; flag if the document is Scottish/NI.
- Check the document against a UK property checklist:
  - **Title & registration** — Land Registry title number, restrictions, easements, restrictive covenants, overriding interests, class of title.
  - **Leasehold** — unexpired term, ground rent (and Leasehold Reform (Ground Rent) Act 2022 implications), service charge, sinking fund, forfeiture, alienation, alterations, statutory enfranchisement rights.
  - **Auction / special conditions** — buyer's premium, completion timeline (typically 28 days), reservation fees, additional fees, indemnity policies in lieu of searches.
  - **Searches** — Local Authority (LLC1, CON29), drainage & water, environmental, chancel, mining.
  - **Planning & building regs** — relevant consents, lawful use, building regs sign-off, Article 4 directions, listed/conservation.
  - **EPC** — band, MEES (Minimum Energy Efficiency Standards) implications for BTL.
  - **HMO / licensing** — Housing Act 2004, mandatory/additional/selective licensing.
  - **Tax flags** — SDLT surcharges (3% additional dwelling, 2% non-resident), CGT, ATED for SPVs.
  - **Finance / bridging** — security, personal guarantees, early redemption, default rate.

Every red flag must cite the **source** by name (e.g. "Leasehold Reform (Ground Rent) Act 2022", "Town and Country Planning Act 1990 s.171B", "Land Registry Practice Guide 19"). The Zod schema + tool definition gets two new fields:

- `jurisdiction`: `"england-wales" | "scotland" | "northern-ireland" | "unknown"`
- `redFlags[].source`: `{ title: string; url?: string }` (URL optional — model proposes, the server resolves it next).

**2. Live UK source fetch (Firecrawl)**

After Gemini returns the structured review, the server iterates through each `redFlag.source` and, if it doesn't have a URL, runs `firecrawlSearch(source.title, { limit: 1, lang: 'en', country: 'gb' })` constrained to `site:legislation.gov.uk OR site:gov.uk OR site:landregistry.gov.uk`. The first result URL is attached to the red flag.

To keep it cheap:
- Cache lookups in a new `legal_source_cache` table (`title TEXT PRIMARY KEY, url TEXT, fetched_at TIMESTAMPTZ`) — same string only fetched once across the workspace.
- Cap to 5 lookups per review, in parallel with `Promise.all`.
- Skip silently on Firecrawl error (review still renders, just without the link).

**3. UI changes on `/legal`**

- A small "**UK Property Review v2**" badge in the header so you can tell the new prompt is live.
- Jurisdiction chip ("England & Wales") shown next to the document type.
- Each red flag card gets a tiny **Source** link (opens legislation.gov.uk / gov.uk in a new tab) when a URL was resolved.
- Disclaimer line at the bottom of the review (verbatim from the repo): *"Draft for solicitor review — not legal advice."*

**4. Out of scope**

- No npm install of the repo (it isn't a package).
- No Claude/Cursor plugin runtime.
- No other plugins (commercial / corporate / privacy / litigation) — property only, as agreed.
- No change to the chat tab or the "Attach to property" flow.

### Files touched

- `src/lib/legal-review.uk-prompt.ts` *(new)* — the long system prompt + checklist.
- `src/lib/legal-review.functions.ts` — swap system prompt, extend Zod schema + tool definition with `jurisdiction` and `redFlags[].source`, add Firecrawl resolver step using `@mendable/firecrawl-js`.
- `src/lib/legal-source-cache.server.ts` *(new)* — tiny `get`/`set` helpers around the cache table.
- `src/routes/legal.tsx` — render jurisdiction chip, source link per red flag, "v2" badge, disclaimer.
- Supabase migration — create `public.legal_source_cache` with RLS (admin/service_role only; cache is server-internal).

### Risks / call-outs

- Live fetch adds ~1–3s to first-time reviews; cached after that.
- Gemini may occasionally cite an Act that doesn't exist; the source link mitigates this by surfacing the actual law text so you can verify.
- The repo's content is MIT-licensed — fine to adapt the prompts and checklists.