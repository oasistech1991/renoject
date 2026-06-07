## Problem

In `/market`, the "My Deals" toggle currently squeezes each saved property into the live‑market `Listing` shape and then runs `applyFilters`. Two issues compound:

1. `applyFilters` calls `metricsFor(l)` again, **overwriting** the metrics I mapped from the saved deal — so the real `grossYield`, `ROI`, `cashLeftIn`, `verdictLabel` from the `properties.metrics` JSON never make it to the UI.
2. The mapper invents `beds=3`, `sqft=1000`, `propertyType="terraced"`, an Unsplash photo, and a missing postcode/town — so cards show wrong/fake info, the address line is broken, and most numeric filters (yield, BMV, £/sqft) compare against bogus values.

Net result: deals render but the data is wrong/empty and doesn't match what's actually saved.

## Fix

Treat "My Deals" as its own view inside `/market` instead of trying to reuse the live‑market card pipeline.

### Scope (frontend only, single file: `src/routes/market.tsx`)

1. **Drop `dealToListing` + `applyFilters` for deals mode.** Fetch `properties` rows (`id, name, source, inputs, metrics, updated_at`) into a separate `deals` array typed against the actual JSON shape.

2. **New `DealCard` component**, rendered only in deals mode, that surfaces the real stored fields:
   - Title: `name`, with the `source` shown via existing `sourceLabel()` as a small badge.
   - Headline figures (from `metrics` first, falling back to `inputs`):
     - Purchase price (`inputs.purchasePrice`)
     - GDV (`inputs.gdv`) and uplift vs purchase
     - Monthly rent (`inputs.monthlyRent`)
     - Gross yield (`metrics.grossYield`)
     - ROI on cash left in (`metrics.roiOnCashLeftIn` or `metrics.roiIO`)
     - Cash left in (`metrics.cashLeftIn`) and verdict label (`metrics.verdictLabel`)
     - Updated date
   - Primary action: **Open deal** → `<Link to="/refinance" search={{ id }}>`.
   - Secondary action: **Delete** (same `supabase.from("properties").delete()` pattern already used on `/properties`).

3. **Filter bar in deals mode**: collapse to the filters that actually apply to saved deals — text search (matches `name` + `inputs.postcode`), min/max purchase price, and a min ROI / min gross yield using `metrics.*`. Hide the live‑market chips (property type, listing type, Article 4, condition, £/sqft, rooms) since they don't exist on saved deals. The existing `mode` toggle stays at the top.

4. **Stats line in deals mode**: count + avg gross yield + avg ROI computed from `metrics`.

5. **Map**: hide the map column entirely in deals mode (saved deals have no lat/lng) and let the list span full width. No more empty map placeholder.

6. **Empty / loading / signed‑out states**: keep the existing copy ("Sign in to view your saved deals", "No saved deals yet", loading spinner).

7. Live Market mode is unchanged.

### Out of scope

- No DB schema changes, no new routes, no changes to `/properties` or `/refinance`.
- No geocoding of saved deals (so still no map pins for them — handled by hiding the map in deals mode).
- No realtime subscription.

### Technical notes

- Read `inputs` / `metrics` as `Record<string, unknown>` and coerce per‑field with `Number(...)` + fallbacks; legacy rows (some have `__btl` nested blob, some don't have `gdv`) need defensive defaults so a missing field renders `—` instead of `£NaN`.
- Use `metrics.roiOnCashLeftIn ?? metrics.roiIO` because BTL rows store `roiIO` and BRRR rows store `roiOnCashLeftIn`.
- Keep `Listing`/`Row` types untouched — `DealCard` takes a new local `Deal` type.
