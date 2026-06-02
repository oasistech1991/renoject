## Goal

Add a **Refinance / BRRR Calculator** as a new page so you can model the full Buy-Refurb-Refinance-Rent cycle and see how much cash you pull back out, what's left in the deal, and whether the post-refi rent still stacks.

## New route

`src/routes/refinance.tsx` → `/refinance`, added to the top nav in `__root.tsx` next to "Renovation Calculator" and "HMO Compliance". Own `head()` meta (title, description, og:title, og:description) so it's SEO/share-friendly.

## Inputs (left column, grouped like the BTL page)

**Purchase**
- Purchase price
- Deposit (£ or %, same toggle pattern as BTL)
- Stamp duty (with Auto button, reuses `calcStampDuty`)
- Legal fees, survey fees
- Purchase mortgage rate %, term (yrs) — usually interest-only for BRRR

**Refurb**
- Refurb cost (can be pre-filled from the Renovation Calculator output later — out of scope for v1, but I'll keep the field name aligned)
- Refurb duration (months) — used for holding cost
- Holding costs / month during refurb (council tax, utilities, insurance)
- Bridge / refurb finance rate % (optional, 0 = cash funded)

**Refinance**
- Post-refurb valuation (GDV / end value)
- Refinance LTV % (default 75)
- Refinance rate %, term (yrs)
- Refinance fees (arrangement, valuation, legal) — single £ field

**Rental (post-refi)**
- Monthly rent
- Management %, maintenance %, voids %
- Insurance / month, ground rent / month, other / month

## Calculated results (right column, MetricCard grid + summary table)

**The deal**
- Total cash in (deposit + stamp + legal + survey + refurb + holding costs during refurb + bridge interest)
- New loan amount (GDV × refi LTV)
- Cash released on refi (new loan − original loan balance − refi fees)
- **Cash left in deal** (total cash in − cash released) — the headline BRRR number
- % capital recycled (cash released ÷ total cash in)

**Value uplift**
- GDV − (price + refurb) = profit on paper
- Money multiple on starting cash
- New equity (GDV − new loan)

**Post-refi monthly cashflow**
- New monthly mortgage (interest-only AND repayment)
- Operating costs (mgmt + maint + voids + insurance + ground rent + other)
- Net monthly cashflow (IO and repayment)
- Annualised cashflow

**Yields & lender stress**
- Gross yield on GDV
- Net yield on GDV
- ROI on cash-left-in (annual cashflow ÷ cash left in) — infinite if cash left in ≤ 0, shown as "∞ (no money left in)"
- ICR at refi rate
- Stress ICR @ 5.5% (Pass 145% / Pass 125% / Fail) — reuse BTL logic
- Break-even rent

**BRRR verdict banner**
A coloured banner at the top of results summarising the deal:
- Green "Full BRRR" if cash left in ≤ £0 AND stress ICR ≥ 125%
- Amber "Partial pull-out" if some cash left in but cashflow positive and ICR passes
- Red "Doesn't stack" if cashflow negative or ICR fails

## Implementation

- New `src/lib/refinance.ts` with a `RefinanceInputs` interface, a pure `calculateRefinance()` function, and reuses `calcStampDuty`, `fmtGBP`, `fmtPct` from `src/lib/btl.ts`. All logic is unit-testable, no side effects.
- New `src/routes/refinance.tsx` using the same `MetricCard` / `NumberField` / `InputGroup` / `Row` building blocks as `src/routes/index.tsx` for a consistent look.
- Update `__root.tsx` nav: add `<Link to="/refinance">Refinance / BRRR</Link>`.
- Update the home page header tagline or add a small card linking to the new tool (optional, can skip if you'd rather keep the homepage as-is — let me know).
- Sensible defaults so the page is useful on first load (e.g. £150k buy, £30k refurb, £220k GDV, 75% refi LTV, 5.5% refi rate, £1,300 rent).

## Out of scope for v1

- Saving deals to a database (no backend changes).
- Pulling the refurb figure automatically from the Renovation Calculator (can wire up later).
- Multi-year projections / appreciation modelling.
- Tax modelling on the refi — the BTL page already handles Section 24 for the holding period; happy to add a "post-tax" row here too if you want, just say.

## Quick question

Do you want **bridge finance** modelled properly (interest during refurb based on a draw schedule), or is a simple "refurb finance rate × refurb cost × months" approximation good enough for v1? I'll default to the simple approximation unless you say otherwise.