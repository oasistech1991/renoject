## Plan

### 1. Persist the selected purchase method
Update the Property Calculator save flow so every deal stores the active method (`btl`, `brrr`, `mortgage`, or `cash`) in the saved metrics payload.

### 2. Save the right input set
BTL uses its own calculator inputs, so when **BTL** is selected, save those BTL inputs alongside the deal data. When reopening an existing deal, restore both the selected method and the matching input values.

### 3. Snapshot method-specific figures
Change the saved metrics snapshot so it uses the currently selected purchase method:

- **BTL**: cash in, loan amount, monthly/annual cashflow, gross yield, net yield, ROI, ICR, stress result.
- **Mortgage**: mortgage-style cash in, cashflow, yield, ROI/ICR style figures.
- **Cash**: cash purchase figures without loan/refinance values.
- **BRRR**: keep the current BRRR/refinance figures.

### 4. Show relevant figures on property cards
Update the saved property card to prioritise `metrics.method` and render rows that match the selected method instead of always showing BRRR fields like cash released/cash left in.

Example:

```text
BTL card: Purchase price, Cash in, Monthly cashflow, Gross yield, Net yield, ROI, ICR
BRRR card: GDV, Cash required, Cash left in, Cash released, Gross yield, Monthly cashflow, ROI on cash left in
Cash card: Purchase price, Cash in, Monthly cashflow, Gross yield, Net yield, ROI on cash in
Mortgage card: Purchase price, Cash in, Monthly cashflow, Gross yield, ROI, ICR
```

### 5. Keep existing deals compatible
Older deals without a saved method will default to **BRRR**, so current saved deals continue to display as they do now.