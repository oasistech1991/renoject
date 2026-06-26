## Goal

Replace the current open-market style filter bar on `/market` with a filter set built around the deals Renoject actually publishes to the feed.

## New filter bar (top of page)

Row 1 — find a deal:
- **Location search** — free-text on deal name / town / postcode
- **Region chips** — North West, North East, Yorkshire, Midlands, London, South (derived from postcode prefix)
- **Status** — All · Live · Upcoming · Sold

Row 2 — refine:
- **Deal type chips** — BTL, HMO, BRR/Flip, Turnkey, Off-Market, Mixed Use (colour-matched to feed)
- **Price range** — Min £ / Max £
- **Min beds / rooms**
- **Min projected ROI %** (from `inputs.roi` if available)
- **Min monthly cashflow £** (from `inputs.monthlyRent` − costs, falls back to rent)
- **Reset** button + live count: "X deals · Y on map"

Remove from current bar: property type (terraced/semi/detached/flat), listing type (auction/repossession/probate), Article 4 toggle, condition (turnkey/light/heavy), BMV %, £/sqft, expert review CTA — these are open-market concepts, not Renoject deal attributes.

## Behaviour

- Filters apply instantly to the deal list and map markers (already wired).
- Region chip = postcode-prefix match (e.g. M/BL/PR/L → NW).
- Status reads `feed_posts.is_upcoming` for Live/Upcoming; Sold reads a new optional `feed_posts.status` flag — if the column isn't present, the Sold chip is hidden gracefully.
- All filter state lives in URL search params via `validateSearch` + `zodValidator` so links are shareable and the back button works.
- Sticky header keeps filters visible while scrolling the list.

## Out of scope

- No changes to the map rendering, deal cards, or data loading logic.
- No changes to the feed itself or the underlying `feed_posts` / `properties` schema.
