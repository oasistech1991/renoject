
# Refi summary strip above the timeline

Add a compact KPI row at the very top of `/portfolio-timeline`, sitting above the toolbar and capital overlay. Everything is derived from the deal rows already computed on the page — no schema or data-layer changes.

## Layout

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  REFI OVERVIEW                                          Next 12 months ▾     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────┐ │
│  │ Refis due   │ │ Capital out │ │ Capital     │ │ Avg recycle │ │ Cash   │ │
│  │    4        │ │  £312,400   │ │ left in     │ │   78%       │ │ left in│ │
│  │ next 12 mo  │ │ across 4    │ │  £84,200    │ │ weighted    │ │ £142k  │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └────────┘ │
│                                                                              │
│  Next refi → "12 Oak St" · 14 May 2027 · £92,000 out · → unassigned (assign) │
└──────────────────────────────────────────────────────────────────────────────┘
```

## The 5 KPI tiles (all refi-centric)

1. **Refis due** — count of deals whose `refiDate` falls inside the selected window. Sub-label: window name.
2. **Capital out (£)** — sum of `cashOut` (= `cashReleased`, positive only) for those refis. Sub-label: "across N refis".
3. **Capital still left in (£)** — sum of `cashLeftIn` across the whole portfolio after each refi. Flags partial vs full BRRR at a glance.
4. **Avg recycle %** — capital-weighted average of `cashReleased / totalCashIn`. Coloured: ≥90% green, 60–90% amber, <60% red.
5. **Unassigned pull-out (£)** — sum of `cashOut` from refis in the window whose `assigned_to_property_id` is null. Click → scrolls/opens the first unassigned refi's drill sheet.

## Window selector

Top-right of the strip: dropdown with `Next 6 mo` / `Next 12 mo` (default) / `Next 24 mo` / `All`. Local UI state only — does not change the Gantt zoom.

## "Next refi" callout line

A single one-line summary under the tiles for the soonest upcoming refi:
- Deal name · refi date · `£ out` · assignment status (`→ <target name>` or `Unassigned`, latter rendered as a button that opens the drill sheet).

## Conditional / empty states

- If no deals: hide the strip entirely.
- If no refis in window: tiles 1/2 show `0` and `—`, "Next refi" line shows `No refis in this window`.
- Tile 5 hides itself when unassigned = £0.

## Technical changes

- **`src/routes/portfolio-timeline.tsx`** — add a `RefiSummaryStrip` block at the top of the page body. Compute the five aggregates from the existing `deals: DealRow[]` array already in scope (filter by `refiDate` against `now + windowMonths`). Use existing `fmtGBP` / `fmtPct` from `@/lib/btl`. Reuse `Card`, `Select`, `Button` from `@/components/ui/*`. Clicking the unassigned tile / "Unassigned" button calls the same handler that opens the existing `RefiDrillSheet` for the first matching refi.
- No new files, no new helpers in `src/lib/portfolio-timeline.ts` (all math is one-liners over `DealRow`).
- No schema, no serverFn changes.

## Out of scope

- Charting inside the tiles (sparkline) — can follow up if you want a mini bar per quarter.
- Persisting the window selection to the DB.
- Stress-testing or ICR aggregates (separate row if you want it later).
