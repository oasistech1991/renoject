## Goal

1. Rename **Refinance / BRRR** → **Property Calculator** in the top nav.
2. Rename **Properties** → **View Deals** in the top nav.
3. Move the purchase-method selector (currently on the BTL Calculator) onto the Property Calculator page, expanded to **4 methods**.

URLs stay the same (`/refinance`, `/properties`) so saved links keep working.

## Property Calculator — 4 methods

A tab bar at the top of the page picks one of:

| Method | What it models |
|---|---|
| **Mortgage** | Standard BTL purchase with a mortgage. No refurb cycle, no bridge, no refi. |
| **Cash** | 100% cash purchase. No loan, no bridge, no refi. |
| **Bridge + Refurb** | Bridge-funded purchase, refurb period, then held on the bridge (no refi step). |
| **Refinance / BRRR** | The current full configuration on this page — purchase → refurb → refinance → rent. **Kept exactly as it is today.** |

For each method the page hides the input blocks and result cards that don't apply:

- **Mortgage**: hides bridge block, refurb block, GDV / refi-rate / refi-LTV block, and the "capital recycled / cash left in" results.
- **Cash**: hides all loan, bridge, refurb and refi blocks. Shows cashflow, yield and ROI on full cash in.
- **Bridge + Refurb**: shows bridge + refurb inputs; hides GDV / refi block and the "cash released on refi" result.
- **Refinance / BRRR**: unchanged.

Default tab on first load = **Refinance / BRRR** so existing users land on the same screen they have now.

## BTL Calculator page

Removes the Mortgage / Cash / Bridge tabs that were recently added there. The BTL page goes back to a single straight mortgage calculator. (The functionality moves to Property Calculator instead.)

## Technical notes

Files touched:

- `src/routes/__root.tsx` — change two `<Link>` labels only.
- `src/routes/refinance.tsx`:
  - Add `method` state with 4 values.
  - Add a tab bar (same component shape as BTL's existing mode tabs).
  - Derive an `effectiveInputs: RefinanceInputs` via `useMemo` that forces fields per method (e.g. cash → `depositPct=100, purchaseRate=0`; mortgage → `useBridge=false, refurbMonths=0, refurbCost=0, refiLtv=0`; bridge → `useBridge=true, refiLtv=0`).
  - Wrap each input section and result card in a `method`-aware conditional.
  - Persist `method` in the Supabase save payload (default to `"brrr"` when loading older records that don't have it).
- `src/routes/index.tsx` — delete the `mode` / `bridge` state, the method tab bar, the `effectiveInputs` memo and the bridge inputs block; restore a plain BTL calculator that calls `calculateBTL(inputs)` directly.

No new routes, no new packages, no DB migration. All existing saved deals continue to load — they'll just open in the "Refinance / BRRR" tab by default.
