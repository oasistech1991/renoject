## Goal

On `/refinance`, add a one-click way to load the exact figures from the RENOJECT PDF (430.pdf) into the calculator, for all three purchase methods the PDF shows (Cash, Bridging, Mortgage refinance).

## UI

Add a small "Load RENOJECT example" panel near the top of the inputs, with three buttons:
- Cash purchase
- Bridging finance
- Mortgage purchase

Clicking a button overwrites the current inputs with the matching scenario below. A short toast confirms which scenario was loaded.

## Values to prefill (taken verbatim from the PDF)

### Shared across all three scenarios
- Purchase price: £300,000
- Fixtures & Fittings: £0
- Refurb cost: £0
- Furnishing: £0
- Legal fees: £1,500
- Stamp Duty: £15,000
- Additional fees: £0
- Auction fees: £0
- Sourcing fee: £15,000
- Conservative GDV: £400,000
- Refi LTV: 75% → new loan £300,000
- Refi rate: 6.00% (sheet shows £1,250/mo interest-only on £300k)
- Lettable units: 1
- Current monthly rent: £0
- Achievable monthly rent: £2,400
- Management: 10% (£240)
- Insurance & compliance: £60/mo
- Maintenance / voids / ground rent / other: £0
- Refurb months: 0 (no refurb shown)
- Flip: sale £400,000, legal £1,500, agency £8,000

### 1. Cash purchase
- Bridge: off
- Deposit: 100% (£300,000 cash) → purchase loan £0
- Broker fees: £0, Lender fee: £0
- Expected totals from calc: Total cash in £331,500, cash released £300,000, money left in £31,500, ROI ~27.6%, flip profit ~£59,000

### 2. Bridging finance
- Bridge: on
- Bridge LTV: 75% of purchase (£225,000)
- Bridge rate: 1.00% PCM (12% PA), interest rolled, term 6 months
- Bridge arrangement: 2% (PDF shows £0 separately but lender fees £2,250 ≈ 1% of bridge — will set arrangement 1% = £2,250 to match the £2,250 lender fee line)
- Bridge exit: 0%
- Broker fees: £995, Lender fee: £2,250, Legal fees on bridge purchase: £3,000 (per PDF)
- Refi: as shared
- Expected: Total cash in ~£114,995, money left in ~£53,495, ROI ~16.3%

### 3. Mortgage purchase
- Bridge: off
- Deposit: 25% (£75,000), purchase loan £225,000
- Purchase rate: 5.00% PA
- Broker fees: £995, Lender fee: £6,000
- Legal fees: £1,500
- Refi: as shared
- Expected: Total cash in ~£109,745, money left in ~£84,745, ROI ~10.3%

## Notes / caveats

- The PDF's "Mortgage Payment £1,375" headline figure uses a slightly different rate than the 6% refi rate shown in the table; I'll use the table's 6% / £1,250 numbers since those drive the calc.
- The stress-test row (6.5% → £1,625 / net £475) is informational on the PDF; our calculator doesn't have a separate stress field, so it's not prefilled — the stress ICR badges already shown in the UI will reflect it automatically.
- Existing inputs are overwritten when a scenario button is clicked; an Undo isn't included to keep scope small.

## Files touched

- `src/routes/refinance.tsx` — add the three preset constants and a small button row that calls `setInputs(...)`.

No backend or schema changes.
