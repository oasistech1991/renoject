## Goal
On the Forecast page, account for the time each deal spends in refurb + on the market before rent starts. Today the cumulative chart assumes rent flows from month 1, which overstates the early months.

## Changes

### 1. Per-deal "rent start" offset
Add two numbers per deal (default 4 months refurb + 2 months to let = 6):
- `refurbMonths`
- `voidToLetMonths`

Source of truth: read from `r.inputs.refurbMonths` / `r.inputs.voidToLetMonths` if set, otherwise fall back to a global default controlled at the top of the Forecast page (one input pair, applies to any deal missing its own).

A deal's rent (and therefore monthly cashflow) only starts contributing in month `refurbMonths + voidToLetMonths + 1`.

### 2. Cumulative chart becomes phased
Replace the current flat `runCF += totals.monthlyCashflow` loop with a per-deal walk:

```text
for each month 1..24:
  for each deal:
    if month > deal.refurbMonths + deal.voidToLetMonths:
      add deal.monthlyCashflow and deal.monthlyRent
```

So the cumulative rent / cashflow curve stays flat (or only reflects already-renting deals) until each deal "comes online", then ramps.

### 3. UI on the Forecast page
- A small "Rent start defaults" card above the charts with two inputs (refurb months, void-to-let months) — drives the default for any deal missing its own values.
- A new column in the deals table: "Rent starts" showing `Month N` for each deal, computed from its offsets.
- Chart subtitle updated to "Phased by refurb + time-to-let per deal".

### 4. Headline stats stay as steady-state
The top stat cards ("Monthly cashflow", "Annual cashflow", "Total monthly rent") continue to show the steady-state numbers once everything is let — that's the long-run view. The phasing only changes the 24-month cumulative chart and adds the "Rent starts" column.

## Out of scope
- Persisting per-deal refurb/void-to-let into the database (would need a migration). For now they live on `inputs` if already there, otherwise the global default is used. We can add a migration + editor later if you want each deal to remember its own.
- Changing the deal page or properties page calculations.