## Add a source toggle to the Market Search page

Add a segmented toggle at the top of `/market` that switches the result set between:

1. **Live Market** (current behavior) — `MOCK_LISTINGS` from `src/lib/market-listings.ts`, run through `applyFilters`.
2. **My Deals** — every row from the `properties` table the signed-in user can see (the same data that powers the Deals page).

### UX
- Segmented control (shadcn `Tabs` or two `Button`s with `variant="default" | "outline"`) placed next to the search input, labels: "Live Market" and "My Deals".
- Result count + filter chips stay visible in both modes.
- When "My Deals" is active and the user is not signed in, show an inline "Sign in to view your saved deals" CTA instead of an empty grid.
- Empty state for "My Deals" with zero rows: short copy + button linking to `/market` info or the "Save as deal" flow.

### Data
- On mount (and on auth change), fetch `properties` once with `supabase.from("properties").select("*").order("updated_at", { ascending: false })` and cache in component state.
- Map each `properties` row into the same `Row` shape the grid already renders. Use existing `inputs`/`metrics` JSON when present:
  - `address`, `postcode`, `price`, `beds`, `sqft`, `hmoRoomsPotential` ← from `inputs`
  - `m` (InvestorMetrics) ← from `metrics` if stored; otherwise recompute with `metricsFor(...)` using sane fallbacks (avg room rent / BTL rent defaults already used elsewhere).
  - Fields that don't exist on saved deals (`photos`, `agent`, `sourceUrl`, `daysOnMarket`, `article4`, etc.) get neutral defaults so the existing card renders without conditionals.
- Filters (`applyFilters`) still apply in both modes so price / yield / BMV sliders keep working.

### Card differences in "My Deals" mode
- Replace "Save as deal" button with "Open deal" → navigates to the deal/properties detail.
- Hide auction-specific badges when the saved deal has no listing type.
- Show the deal's `source` (from `src/lib/sources.ts` `sourceLabel`) as a small badge in place of the agent name.

### Files to change
- `src/routes/market.tsx` — add `mode` state (`"live" | "deals"`), toggle UI, deals fetch effect, mapper, conditional card affordances.

### Out of scope
- No schema changes, no new routes, no changes to the existing Deals page.
- Realtime subscription not added; user can re-toggle to refresh (we can add `router.invalidate`-style refresh later if needed).
