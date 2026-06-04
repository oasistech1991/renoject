## Goal

Rework the HMO floorplan checker so it returns **three side-by-side capacity scenarios** (max singles, max doubles, balanced) using England national minimums, with **user-configurable amenity ratios**, and have the AI **suggest wall reconfigurations** to hit each scenario's max.

## 1. Inputs (left panel)

Add a collapsible "Amenity standards" section so power users can tune assumptions while defaults stay sensible:

- **Bath/WC ratio** — select: `1 per 5 occupants` (default) / `1 per 4` / `1 per 3`
- **Kitchen sizing** — select: `Standard (7-12 sqm)` (default) / `Kitchen-diner combined` / `Large (11-14 sqm)`
- **Separate living room required** — toggle (default off; on adds ~10-14 sqm)
- **Circulation %** — slider 12-22% (default 17%)

Existing fields (total floor area, scale ref, storeys, occupants, notes) stay as-is. Drop the "target bedrooms" field's prominence — it becomes a sanity-check input ("how many do you currently propose?") and the tool's headline output is the three scenarios.

## 2. Server logic (`src/lib/hmo.functions.ts`)

Extend the input schema with the amenity options above. Rewrite the prompt so the model returns **three scenarios** plus a shared capacity baseline:

```
scenarios: {
  maxSingles:  { bedroomCount, mix: {singles, doubles}, estRentIndex, ... }
  maxDoubles:  { bedroomCount, mix, estRentIndex, ... }
  balanced:    { bedroomCount, mix, estRentIndex, ... }   // recommended
}
```

Each scenario contains:
- `bedroomCount` + mix of singles/doubles
- `rooms[]` — proposed layout (Bedroom 1..N with sqm)
- `reconfiguration[]` — ordered list of wall changes needed vs the current drawn floorplan (e.g. "Remove non-load-bearing wall between current Bed 3 and Bed 4 to create one 11 sqm double", "Steal 1.2m from oversized landing to widen Bed 2 to 7 sqm"). Each item: `{change, impact, complexity: "cosmetic"|"minor works"|"structural"}`.
- `verdict` PASS/REVIEW/FAIL relative to the user's proposed bedroom count
- `tradeoffs` — 1-2 short bullets ("Highest room count but tight common space", "Best £/room but only 4 lettable rooms")

Shared `capacity` block stays (total area, non-bedroom allocation breakdown, bedroom-available area, assumptions) — the three scenarios fit into the same available area, they just allocate it differently.

**Footprint constraint:** the prompt instructs the model to (a) read the drawn walls, (b) propose reconfiguration to reach each scenario, (c) flag if a scenario is physically impossible on this footprint regardless of area math (sets `physicallyAchievable: false` + reason).

`maxCompliantBedrooms` at the top level becomes the **balanced** scenario's count (the recommended one) so existing UI bits that read it still work.

## 3. UI (`src/routes/hmo-compliance.tsx`)

Replace the single "How we got to N bedrooms" card with a **3-column scenario comparison** card:

```text
┌─ Max singles ─┬─ Balanced (rec) ─┬─ Max doubles ─┐
│   7 bedrooms  │    6 bedrooms    │   5 bedrooms  │
│   7S / 0D     │    3S / 3D       │   1S / 4D     │
│   [PASS]      │    [PASS]        │   [REVIEW]    │
│  tradeoff…    │   tradeoff…      │  tradeoff…    │
│  [View layout]│   [View layout]  │  [View layout]│
└───────────────┴──────────────────┴───────────────┘
```

Clicking a scenario expands below into:
- Proposed room list (the existing rooms table)
- **Reconfiguration steps** — ordered list with complexity badges (cosmetic / minor works / structural)
- Scenario-specific issues

Shared sections stay: capacity breakdown ("How we got to the bedroom-available area"), licensing, fire safety, amenities, local authority, planning, actions.

Default-selected scenario = balanced.

## 4. Out of scope

- Per-council standards lookup (sticking with England national minimums as you specified)
- Saving results to DB
- Other tabs
- Pixel-accurate wall measurement beyond what Gemini already does from the image

## Technical notes

- Schema change to `HMOComplianceResult` is additive (`scenarios` object) but reshuffles `rooms` under each scenario. UI changes are in the report view only — input form gets the new amenity section but keeps the same submit flow.
- Prompt becomes noticeably longer; keep `google/gemini-2.5-flash` but consider bumping to `gemini-2.5-pro` if reconfiguration suggestions come back weak (one-line model swap).
- `estRentIndex` is a relative 0-100 score the model assigns, not a £ figure — avoids inventing local rents.
