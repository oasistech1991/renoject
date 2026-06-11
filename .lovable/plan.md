
# Portfolio Timeline — manage capital recycling across deals

A new `/portfolio-timeline` page (signed-in) that turns your saved Properties (those marked "in portfolio") into a multi-deal capital plan: when each deal refinances, how much cash comes out, and which next deal that cash is earmarked for.

## What you'll see

Four linked views on one page, all driven by the same deal list at the top.

### 1. Gantt timeline (primary)
Horizontal bars, one per deal, on a month-by-month axis (today → +5 yrs by default, zoomable).
Each bar segments:
- Purchase + refurb (amber)
- Bridging hold (red, if bridge used)
- Refi event (vertical marker with £ pulled out)
- Post-refi hold (green)
- Optional sale/flip exit (grey end-cap)

Hover a bar = deal summary. Click = open the underlying Refinance scenario.

### 2. Cash waterfall (cumulative chart)
Stacked area / line over the same time axis:
- Cash deployed (negative) per month
- Cash released at each refi (positive spikes)
- Running "free capital available" line — what's sitting uncommitted

Lets you spot months where you're cash-rich or about to run dry.

### 3. Sankey — capital flow
Nodes = deals. Flows = refi proceeds from Deal A → deposit/refurb on Deal B (manual links you set). Surplus that isn't assigned flows to a "Reserve" node. Immediately shows recycled vs trapped equity.

### 4. Redeployment planner table
One row per upcoming refi event, sorted by date:

| Refi date | Source deal | Cash out | Assigned to | Gap (months) | Status |

"Assigned to" is a dropdown of your other portfolio deals (or "Reserve"). Status = on-track / short by £X / surplus £X based on the target deal's totalCashIn.

## Inputs we already have vs need

The `properties` table stores `inputs` (jsonb with purchasePrice, refurbMonths, gdv, refiLtv, bridgeTermMonths, etc.) and `metrics` (cashLeftIn, cashReleased, totalCashIn). That's enough to compute £ amounts.

What's missing per deal, for the timeline:
- **purchase_date** (anchors the bar on the axis)
- **refi_month_offset** (override of refurbMonths if you actually refinanced later)
- **assigned_to_property_id** (which deal absorbs this refi's cash)
- **status** (planned / live / refinanced / sold) — for colouring + filtering
- **notes** (free text)

## Data model

New table `portfolio_timeline_entries`:
- `property_id` (FK → properties, unique — one row per property)
- `user_id`
- `purchase_date` (date)
- `refi_month_offset` (int, nullable — falls back to inputs.refurbMonths)
- `assigned_to_property_id` (uuid, nullable)
- `status` (text: planned/live/refinanced/sold)
- `notes` (text)
- standard `created_at` / `updated_at` + RLS scoped to `user_id`

Editing a row never touches the underlying `properties.inputs` — it's a planning overlay.

## File-level changes

- **Migration**: create `portfolio_timeline_entries` + GRANTs + RLS (own-row only) + updated_at trigger.
- **`src/lib/portfolio-timeline.functions.ts`** — serverFns: `listTimeline()` (joins properties + entries, computes derived fields like refi_date, cash_out, cash_in_needed), `upsertEntry(...)`, `deleteEntry(id)`. Uses `requireSupabaseAuth`.
- **`src/lib/portfolio-timeline.ts`** — pure helpers: compute refi date, free-capital series month-by-month, sankey link builder, status calculator.
- **`src/routes/_authenticated/portfolio-timeline.tsx`** — page route (must live under `_authenticated/` since it needs the user's deals; create `_authenticated/route.tsx` if it doesn't exist).
- **Components** under `src/components/portfolio/`:
  - `GanttTimeline.tsx` (SVG-based; no new dep needed)
  - `CashWaterfallChart.tsx` (Recharts — already in project)
  - `CapitalFlowSankey.tsx` (Recharts has Sankey)
  - `RedeploymentTable.tsx` (shadcn Table + Select per row)
  - `DealEditorSheet.tsx` (edit purchase_date / refi offset / assignment / status / notes)
- **Nav**: add "Portfolio Timeline" link in the signed-in header next to Properties.

## Out of scope (flag for later)

- Auto-suggesting which deal to assign cash to (today's plan is manual only, as you chose).
- Tax/CGT modelling on flips.
- Multi-scenario comparison (Plan A vs Plan B).
- Importing dates from PDF deal packs.

Tell me if you'd rather put the page outside `_authenticated/` (public + sign-in CTA) or skip any of the 4 visuals to ship faster.
