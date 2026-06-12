
# Portfolio Timeline → Gantt-only command centre

Strip the page back to ONE primary visual: a rich, interactive Gantt that shows every portfolio deal on a shared time axis, with a capital overlay above it and a refi drill-down panel beside it. The waterfall, Sankey, and redeployment table are removed.

## Layout

```text
┌────────────────────────────────────────────────────────────┐
│  Toolbar:  [Zoom −/+]  [Today]  [Range: 2y · 5y · 10y]      │
│            [Filter: status ▼]   [+ Add planned deal]        │
├────────────────────────────────────────────────────────────┤
│  Free-capital overlay (area chart, same x-axis as Gantt)    │
│  · shaded red when < £0, green when > £0                    │
│  · hover = month total, deployed, released, free            │
├────────────────────────────────────────────────────────────┤
│  Month/quarter/year axis · TODAY vertical line              │
│  ──────────────────────────────────────────────────────     │
│  Deal A  ▓▓▓▓▒▒▒▒│●─────────────────────                    │
│  Deal B          ▓▓▓▓│●──────────────                       │
│  Deal C                    ▓▓▓▓│●──────                     │
│  …                                                          │
└────────────────────────────────────────────────────────────┘
        (click a ● refi marker → side sheet opens)
```

## Bar anatomy

Each row = one deal. Segments coloured by phase:

- **Amber** — Purchase + refurb (`purchaseDate` → `purchaseDate + refurbMonths`)
- **Red** — Bridge hold (only if `useBridge`, overlays refurb tail to bridge end)
- **● marker** — Refi event at `refiDate` with `£ pulled out` label above
- **Green** — Post-refi hold (refi → end of visible range or sale)
- **Grey end-cap** — Sale/flip exit (if status = sold)

On each bar:
- Left: deal name + status pill (planned / live / refinanced / sold)
- Inside purchase segment: `£ in: totalCashIn`
- Above refi marker: `£ out: cashReleased` (green if positive, red if negative pull)
- Right of bar: mini sparkline = monthly cashflow post-refi
- Hover tooltip: GDV, refi LTV, ICR, cash left in, assigned-to deal name

## Interactions

- **Drag a bar horizontally** → updates `purchase_date` (snap to month, persists on drop)
- **Drag the refi marker** → updates `refi_month_offset` (snap to month)
- **Resize right edge** → adjusts post-refi hold for visual planning (display only)
- **Click bar body** → opens existing Refinance scenario in new tab
- **Click ● refi marker** → opens **Refi drill-down sheet** (right side):
  - Source deal summary (£ in, £ out, GDV, debt cleared)
  - "Assign pull-out to" dropdown → other portfolio deals or Reserve
  - Live gap calculation: "Cash available 14 May 2027 → Deal C needs deposit 02 Aug 2027 = 2.6 month buffer"
  - Shortfall/surplus pill: `Surplus £12,400` or `Short £8,100`
  - Notes textarea
  - Save / delete
- **Zoom controls**: − / + buttons change pixels-per-month; **Range** preset jumps to 2y/5y/10y window
- **Today button** scrolls to the today line
- **Filter** chips: All · Planned · Live · Refinanced · Sold
- **+ Add planned deal**: opens sheet to create a stub property (name + estimated purchase price + refi LTV + purchase date) so future deals appear on the timeline before they're modelled in full

## Capital overlay (kept from waterfall, simplified)

A single thin area chart sitting flush above the Gantt, sharing its x-axis exactly:
- Y = running free capital (£)
- Fill green above zero, red below
- Vertical guides on every refi marker
- Hover shows the same month under inspection in both panels

This replaces the standalone waterfall chart — same information, half the page.

## Removed

- `CashWaterfallChart` (folded into capital overlay)
- `CapitalFlowSankey` (deleted)
- `RedeploymentTable` (folded into the refi drill-down sheet)

## Data / persistence

No schema change. Existing `portfolio_timeline_entries` already has the fields we need (`purchase_date`, `refi_month_offset`, `assigned_to_property_id`, `status`, `notes`). Drag interactions call existing `upsertEntry` serverFn (debounced 400 ms on drop).

The "+ Add planned deal" creates a row in `properties` with `in_portfolio: true` and a minimal `inputs` payload so it shows up alongside fully modelled deals.

## Technical changes

- **`src/routes/portfolio-timeline.tsx`** — replace body with new Gantt-only layout; remove imports for Sankey/waterfall/table
- **`src/components/portfolio/GanttTimeline.tsx`** (new) — SVG-based, virtualised rows, drag handlers using pointer events, zoom state, today line, filter
- **`src/components/portfolio/CapitalOverlay.tsx`** (new) — recharts AreaChart locked to the Gantt's x-domain (shared scale via prop)
- **`src/components/portfolio/RefiDrillSheet.tsx`** (new) — shadcn Sheet, assignment dropdown, gap calc, notes, save
- **`src/components/portfolio/AddPlannedDealSheet.tsx`** (new) — minimal stub creator
- **`src/lib/portfolio-timeline.ts`** — add `dragUpdateEntry(...)` helper, shared scale type, drop unused Sankey + redeployment helpers
- **`src/lib/portfolio-timeline.functions.ts`** — no change beyond what already exists; reuse `upsertEntry`

## Out of scope

- Multi-select bulk drag
- Undo/redo
- Real-time collaboration cursors
- Exporting the Gantt as PDF (can follow up if useful)

Tell me if you'd rather keep "+ Add planned deal" out of v1, or if drag-to-edit should be behind a lock toggle (so you don't move bars by accident).
