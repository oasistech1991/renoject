## Goal

From any saved deal, press **Export** and get a polished, branded PDF ready to send to investors. Two flavours generated in a single PDF document:

1. **Calculator Sheet** — styled exactly like the attached Renoject reference (black background, orange section header bars, white data tables).
2. **Pitch Deck** — multi-page investor presentation with hero photo, narrative, and exit strategy.

## Visual style (matches reference)

- **Background**: pure black (`#000`)
- **Section header bars**: bold orange (`#F26A1F`) full-width, white uppercase title left-aligned
- **Data tables**: white fill, black text, 1px hairline borders (`#1f1f1f`), zebra-free, label left / value right
- **Total rows**: orange fill, white bold text
- **Body font**: Helvetica/Arial (jsPDF built-in — keeps bundle tiny)
- **Page**: A4 portrait, 14mm margins

## Document structure

### Pages 1–2: Pitch Deck
1. **Cover** — Hartstone Holdings wordmark top, hero photo full-bleed below, property name + location + headline ROI / Money Left In overlay at bottom.
2. **Investment Summary** — short narrative (auto-generated from method/inputs: "Three-bed terrace in {area} acquired below market value, refurbished and refinanced. Investor capital returned within {x} years at {ROI}% net annual return."), key-metrics strip (Purchase, GDV, Money Left In, ROI, Cashflow, Yield), photo gallery (up to 4 images, 2×2 grid).

### Pages 3+: Calculator Sheet (Renoject layout)
3. **KEY METRICS** — orange header, 2-column table (Purchase Price, Fixtures, Refurb, GDV / Mortgage Payment, Management %, Mgmt Fee, Utilities).
4. **TENURE + STRESS TEST + REVENUE** — three stacked panels matching reference.
5. **MONTHLY OPERATING COSTS** — orange header + table (Management, Utilities, Repairs, Insurance, Service Charge, Total).
6. **CASH PURCHASE / BRIDGING FINANCE PURCHASE / MORTGAGE PURCHASE** — conditionally rendered based on `inferMethod`. Each has COSTS table → TOTAL CASH INVESTED orange row → REFINANCE table → FLIP table (matching reference exactly).
7. **Contact footer** on last page — Hartstone Holdings details + disclaimer.

All numbers come from the saved `inputs`, freshly recomputed via `calculateRefinance(inputs)` to guarantee accuracy.

## Implementation

### Dependencies
- `bun add jspdf jspdf-autotable` — pure-browser, no server function needed.

### New files
- **`src/lib/investor-pdf.ts`** — `exportInvestorPack(property, mediaRows)`:
  - Loads signed URLs from `property-media` bucket (reuses pattern in `PropertyMedia.tsx`), fetches each as dataURL.
  - Recomputes metrics via `calculateRefinance`.
  - Builds pages with `jspdf-autotable` using a shared `orangeHeader()` helper for the header bars (rectangle + text), a shared `dataTable()` helper for label/value tables, and an `orangeTotalRow()` helper.
  - Conditional sections by `inferMethod` (btl/brrr/cash/mortgage).
  - Saves as `Hartstone Holdings — {propertyName} — Investor Pack.pdf`.

- **`src/components/property/ExportInvestorPackButton.tsx`** — reusable button:
  - Props: `propertyId`, optional pre-loaded `property` to skip fetch.
  - Fetches row + media, calls `exportInvestorPack`, toasts on success/error, shows spinner while generating.

### Edits
- **`src/routes/properties.tsx`** — add `<ExportInvestorPackButton size="sm">` per row alongside existing actions.
- **Property detail page** (open `src/routes/refinance.tsx` during build to find the saved-deal banner) — add a prominent `<ExportInvestorPackButton>` next to the deal title when a saved property is loaded.

### Server impact
None. Fully client-side. No new tables, no migrations, no edge functions.

## Acceptance

- Pressing **Export** from list or detail produces a single branded PDF within ~2s.
- Page 1 cover uses property's hero image at full bleed; page 2 shows 4-photo gallery + narrative + metrics.
- Calculator pages match the Renoject reference 1:1 (black bg, orange header bars, white tables, orange totals).
- Sections conditionally render based on purchase method.
- File downloads with a clear branded filename.

## Out of scope

- No PowerPoint output (PDF only, per earlier choice).
- No saving generated PDFs to storage — regenerated on demand.
- No emailing — you forward the downloaded file manually.
