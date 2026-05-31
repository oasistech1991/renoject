## Goal

Make the Property Condition Analyser noticeably more accurate by rewriting the AI instructions around a proper UK lettings-industry rubric and calibrated 2025 contractor costs — no UI changes, no new data required.

## What changes

All edits are in `src/lib/condition.functions.ts` (the system prompt and a small bit of user-message scaffolding). The UI, inputs and result shape stay identical.

## New scoring rubric (1–10)

Replace the current 4-band description with a strict, observable rubric the model must justify against:

- 1–2: Uninhabitable / pre-refurb shell. Damp, missing kitchen or bathroom, exposed wiring, failed plaster, no flooring.
- 3: Major refurb. Dated kitchen + bathroom both need replacing, full redecorate, flooring throughout, likely rewire/boiler check.
- 4: Tired throughout. Kitchen and/or bathroom serviceable but dated, full redecorate + flooring needed.
- 5: Below lettable. Redecorate most rooms, replace some flooring, deep clean, minor kitchen/bathroom refresh.
- 6: Lettable with refresh. Touch-up decoration, 1–2 carpets, minor repairs, professional clean.
- 7: Good lettable. Clean, neutral, only minor snags (touch-ups, one carpet, garden tidy).
- 8: Very good. Recently maintained, ready to market within a week.
- 9: Excellent. Recently refurbished to a high standard, photo-ready.
- 10: New / showhome standard.

The model must pick the lowest band where ANY listed issue applies (no rounding up for good photos).

## Calibrated UK cost bands (2025)

Tighten the cost guidance so totals stop drifting. Bands are given as basic / mid / premium and apply nationally; the model then applies a regional multiplier.

- Full redecoration per room (walls, ceiling, woodwork): £350 / £550 / £900
- Carpet per room supplied & fitted: £250 / £400 / £650
- LVT per room supplied & fitted: £450 / £700 / £1,100
- Kitchen (small/galley): £3,500 / £7,000 / £14,000
- Kitchen (medium): £5,000 / £9,500 / £18,000
- Bathroom suite + tiling: £2,800 / £5,000 / £9,000
- Shower room: £2,200 / £4,200 / £7,500
- Replaster a room: £700 / £1,000 / £1,400
- Skim ceiling: £250 / £400 / £600
- Full rewire 2-bed / 3-bed / 4-bed: £4,000 / £5,500 / £7,500
- Consumer unit only: £650
- Combi boiler swap: £2,500 / £3,000 / £3,800
- New radiators (per): £220 / £320 / £450
- EPC remedial (loft top-up, LED, TRVs, draught): £400 / £1,200 / £2,800
- Damp treatment + replaster localised: £900 / £1,800 / £3,500
- Window (uPVC, per): £550 / £750 / £1,100
- Internal door + furniture (per): £180 / £260 / £380
- Fire doors FD30 (HMO, per): £350 / £450 / £600
- Deep clean 3-bed end-of-tenancy: £250 / £350 / £500
- Garden tidy / clearance: £200 / £450 / £900

Regional multipliers applied to the totals:
- London / inner SE: ×1.25
- Outer SE, Bristol, Edinburgh, Cambridge, Oxford: ×1.15
- Midlands, NW cities, Yorkshire cities: ×1.00 (baseline)
- North East, Wales, NI, rural: ×0.90

## Stricter output contract

- `costRangeLow` = totalEstimatedCost × 0.85; `costRangeHigh` = totalEstimatedCost × 1.20 (rounded to nearest £50). Stops the range being nonsense.
- Every room finding must include at least one observation tied to what is visible in the photos ("worn carpet visible in lounge", "blown sealed unit in rear window") — no generic boilerplate.
- `priorityWorks` ordered by impact on lettability: H&S → compliance (EPC/electrics/gas) → kitchen/bathroom → decoration → cosmetic.
- `timelineWeeks` derived from a simple ladder: ≤£1.5k = 1 week, ≤£5k = 1–2 weeks, ≤£10k = 2–4 weeks, ≤£20k = 4–6 weeks, >£20k = 6–10 weeks.
- Markdown report uses fixed sections: `## Overall`, `## Compliance & safety`, `## Room-by-room`, `## Priority works`, `## Cost summary` (with a per-room table).

## User-message scaffolding

Append a short reminder so the model anchors against the chosen target standard and location before scoring:

> "Score against the rubric. Apply {basic|mid|premium} unit costs above. Apply the {region} multiplier. Do not round scores up."

## Why this should help

- The current prompt gives the model wide latitude on both scoring and pricing; this version forces it to choose the lowest matching band and use specific £ figures rather than vague ranges.
- Tying the cost range and timeline to formulas removes the inconsistency where the range was sometimes wider than the central estimate justified.
- Section-locked markdown keeps reports comparable property-to-property, which is what you actually want when shortlisting deals.

## Out of scope

- No database, no saved analyses, no UI changes.
- No per-user rubric editor (can add later if you want to override the defaults).
- No model change — still `google/gemini-2.5-flash`.
