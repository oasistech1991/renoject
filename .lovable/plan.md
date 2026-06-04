## Problem

Right now the AI mostly counts/sizes the rooms already drawn on the floorplan. If a plan shows 4 bedrooms, it tends to report on those 4 — it doesn't reason about *"given X sqft/sqm of usable floor area in this footprint, how many HMO-compliant bedrooms (plus required bathrooms, kitchen, circulation) could actually fit?"*. That's the whole point of this tab.

## Fix

### 1. Capture floor area properly (input panel)

Add two small fields to the left panel so the model has a hard number to work from instead of guessing from pixels:

- **Total floor area** (number) + unit toggle **sqm / sqft** (default sqm). Optional but strongly encouraged — helper text: *"Usually shown on the floorplan. Lets us calculate the true bedroom capacity."*
- **Scale reference** (optional text, e.g. "1cm = 1m" or a known room dimension) — only used if total area is blank.

Pass both through `analyseFloorplan` as new optional inputs.

### 2. Rework the server prompt (`src/lib/hmo.functions.ts`)

Change the system prompt + tool schema so the model performs a **capacity calculation**, not a room audit:

- If `totalFloorAreaSqm` is provided, treat it as ground truth. Otherwise estimate it from the floorplan (and explicitly state the estimate + confidence).
- Subtract a realistic **non-bedroom allocation** before sizing bedrooms:
  - Kitchen: 7–12 sqm (scale with occupants)
  - Bathrooms: ~4 sqm each, 1 per 5 occupants (England HMO amenity standard)
  - Circulation / hallways / stairs: ~15–20% of gross internal area
  - Optional communal living room if not combined with kitchen
- From the remaining "bedroom-available" area, compute how many compliant bedrooms fit using the England minimums (6.51 sqm single / 10.22 sqm double), favouring a sensible mix.
- Return the calculation transparently.

### 3. Extend the result schema + UI

Add a new `capacity` object to `HMOComplianceResult`:

```ts
capacity: {
  totalFloorAreaSqm: number;
  areaSource: "user" | "estimated";
  nonBedroomAllocationSqm: number;   // kitchen + baths + circulation
  bedroomAvailableSqm: number;
  breakdown: Array<{ item: string; sqm: number }>;  // "Kitchen 9", "2x bathroom 8", "Circulation 18"…
  assumptions: string[];             // short bullets so the user can sanity-check
}
```

In `ReportView`, add a new card between the Hero and Top Issues: **"How we got to {N} bedrooms"** — show total area, the breakdown table, bedroom-available area, and 1–2 lines of assumptions. The existing "Bedroom assessment" table stays but now represents the *proposed compliant layout* the AI fits into the available area (not the current floorplan's labelled rooms).

### 4. Keep everything else as-is

PDF upload, current vs target bedrooms, licensing, fire safety, accordion detail — all unchanged.

## Out of scope

- No OCR / pixel measurement of the floorplan beyond what Gemini already does.
- No saving results to the DB.
- No changes to other tabs.

## Open question

Do you want the **total floor area field to be required** (forces accurate capacity) or **optional with AI estimation as fallback** (smoother UX but less reliable)? I'd recommend optional-with-warning — the result card flags when area was estimated so you know to double-check.
