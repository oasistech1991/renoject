## Goal

On `/portfolio-timeline`, let the user set a **Starting capital** and log **cash injections** (personal funds etc.), then show a **running monthly cash balance** that accounts for: starting capital + injections + refi releases − deal deployments.

## Data model (Lovable Cloud)

Two new tables, RLS scoped to `auth.uid()`.

1. `portfolio_capital_settings` — one row per user
   - `user_id` (PK, FK auth.users)
   - `starting_capital` numeric, default 0
   - `starting_date` date (defaults to today on first insert; used as the anchor when the balance series begins before any deal)

2. `portfolio_capital_injections` — many per user
   - `id`, `user_id`
   - `date` date
   - `amount` numeric (positive = cash in; negative allowed for one-off withdrawals)
   - `label` text

Both tables get standard `created_at` / `updated_at` + GRANTs + RLS policies (`auth.uid() = user_id` for all CRUD).

## UI changes (all in `src/routes/portfolio-timeline.tsx`)

### A. New "Capital setup" card, above the RefiSummaryStrip

```text
┌──────────────────────────────────────────────────────────────┐
│ Starting capital  £[ 250,000 ] from [ 01 Jan 2026 ]   [Save] │
│                                                              │
│ Cash injections (personal funds, etc.)        [+ Add]        │
│ • 12 Mar 2026  £25,000  "Personal savings"     [edit][×]    │
│ • 01 Jul 2026  £10,000  "ISA top-up"           [edit][×]    │
└──────────────────────────────────────────────────────────────┘
```

- Starting capital uses the existing `NumberField` (£ prefix).
- Injections list is inline-editable rows; "+ Add" appends a blank row.
- All writes go through `supabase.from(...).upsert/insert/update/delete` like the existing `saveEntry` pattern. No serverFn needed.

### B. Top overlay — reuse the existing `CapitalOverlay`

Replace `freePoints` with a new `balancePoints` series that starts at `startingCapital` and applies, for each month:
`balance += injections(month) + refiReleases(month) − deployments(month)`.

Relabel the overlay tag from "Free capital" to **"Cash balance"**. Negative values render in red, positive in the existing green.

### C. New bottom sticky row — "Cash balance" numeric strip

A new row rendered after the Gantt rows (same width / column structure as `AxisRow`):

```text
Cash balance │ 250k │ 250k │ 225k │ 198k │ ... │ 312k │
```

- Sticky to the bottom of the scroll container (`sticky bottom-0 bg-card border-t`).
- One cell per month aligned to `pxPerMonth`; values formatted with `fmtShort` (existing helper).
- Cell tooltip on hover lists that month's components: injections, refi in, deploy out, ending balance.

### D. Math helper

Extend `src/lib/portfolio-timeline.ts` with a `buildBalanceSeries(deals, startingCapital, startingDate, injections)` that returns the same shape as `buildCashSeries` plus `injection` / `balance` fields. The existing `buildCashSeries` stays for any other consumers.

## Out of scope

- Recurring injections (decided against — single-shot date+amount+label only).
- Editing starting capital from the bottom row (only from the top card).
- Charting or stress modes (separate request).

## Technical notes

- New types regenerate after the migration runs; only then wire the `supabase.from("portfolio_capital_settings")` calls.
- Compute `balancePoints` in a `useMemo` next to `freePoints`; pass through to both `CapitalOverlay` (top) and a new `BalanceRow` (bottom).
- No serverFn / no edge function changes.
