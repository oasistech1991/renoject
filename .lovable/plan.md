## Goal

Make the AI apply the same conversion logic seen at 100 Elwick Road (204 sqm, 3-storey terrace, 5-bed family home → 9-bed all-ensuite HMO with kitchen-diner + communal lounge) to every floorplan it analyses, not just this one.

## What the Elwick before → after teaches us

Comparing your "before" (this upload) to the "after" you sent earlier, the conversion follows a repeatable playbook:

1. **Subdivide oversized rooms.** Front Lounge (20.8 m²), Rear Reception (19.2 m²) and Bedroom 4 (26 m²) are all large enough to split into bedroom + en-suite, or two smaller bedrooms.
2. **Every bedroom gets a private en-suite** (~2.5–3.2 m² shower room) carved out of the bedroom footprint, placed against the existing soil stack / plumbing wall where possible to cluster waste runs.
3. **One ground-floor reception becomes a kitchen-diner** (~16–18 m²) — this absorbs communal eating so no separate dining room is needed.
4. **Keep one communal lounge** (~12–14 m²) — the other reception room.
5. **Reuse existing chimney breasts, alcoves and structural piers** as natural stud-wall anchor points so new partitions are non-load-bearing wherever possible.
6. **Stairs, hallways and protected escape route stay put** — fire strategy is built around the existing core, not relocated.
7. **Bedroom sizing is calculated AFTER the en-suite carve-out**, against England HMO minimums (6.51 m² single / 10.22 m² double).

## What to change in code

One file: `src/lib/hmo.functions.ts`. Update `HMO_SYSTEM_PROMPT` only — no schema, UI or other logic changes.

Add a new section titled **"HMO CONVERSION PLAYBOOK (apply on every analysis)"** that codifies the 7 rules above as ordered instructions the model must follow when building each of the three scenarios (maxSingles / balanced / maxDoubles):

- **Step A — Identify oversize rooms.** Any room >14 m² is a subdivision candidate; >22 m² should be split into 2 lettable rooms.
- **Step B — En-suite policy.** Add `ensuitePolicy` reasoning: default to en-suite-every-bedroom for properties ≥150 m² internal area or ≥3 storeys (the Elwick profile). Carve 2.5–3.2 m² per en-suite from the bedroom, placed on the plumbing wall. Smaller properties fall back to shared bath/WC per the user's ratio setting.
- **Step C — Communal allocation.** One reception → kitchen-diner (16–18 m²), one reception → lounge (12–14 m²). If only one reception exists, use kitchen-diner sizing and skip separate lounge.
- **Step D — Wall strategy.** Prefer stud walls anchored to chimney breasts, alcoves and existing piers. Flag any partition crossing a load path as `structural` complexity in `reconfiguration[]`.
- **Step E — Core untouched.** Stairs, hall and escape route must remain in original position; only flag a move as `structural` if unavoidable.
- **Step F — Bedroom compliance check.** Measure the bedroom AFTER subtracting the en-suite footprint, then compare to 6.51 / 10.22 m² minimums.

Also add a short worked-example block inside the prompt (Elwick 204 m² → 9 beds: 8 × ~10.2 m² doubles with en-suite + 1 × ~6.5 m² single, 18 m² kitchen-diner, 13 m² lounge, ~17% circulation) so the model has a concrete anchor for the "balanced" scenario on similar-sized properties.

Keep the existing area-allocation method, three-scenario structure, verdict logic and JSON schema exactly as they are — the playbook just tightens HOW the model fills `scenarios.balanced.rooms` and `reconfiguration[]`.

## Out of scope

- No changes to `generateUpdatedFloorplan` image prompt (we'll tune the redraw in a separate pass once analysis output is solid).
- No new form fields. Existing `bathRatio`, `kitchenSizing`, `requireLivingRoom`, `circulationPct` still drive amenity sizing; the playbook adds the conversion intelligence on top.
- No schema/UI changes.

## How we'll know it worked

Re-run analysis on this Elwick "before" image with the user's settings (kitchen-diner, no separate lounge override, 1:5 bath ratio, 17% circulation). The `balanced` scenario should land on ~9 bedrooms with en-suites listed in `reconfiguration[]` as `minor works`, matching the real "after" plan. We'll iterate the prompt if it under- or over-shoots.
