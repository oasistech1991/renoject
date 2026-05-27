export interface BTLInputs {
  purchasePrice: number;
  deposit: number; // absolute £ (used when depositIsPct = false)
  depositPct: number; // % of purchasePrice (used when depositIsPct = true)
  depositIsPct: boolean;
  interestRate: number; // annual %
  mortgageTermYears: number;
  monthlyRent: number;
  // costs
  stampDuty: number;
  legalFees: number;
  refurbCosts: number;
  surveyFees: number;
  // ongoing (monthly)
  managementPct: number; // % of rent
  maintenancePct: number; // % of rent
  insurance: number; // monthly
  groundRent: number; // monthly
  voidsPct: number; // % of rent assumed empty
  otherMonthly: number;
  // tax
  taxRate: number; // %
}

export interface BTLResults {
  loanAmount: number;
  ltv: number;
  totalCashIn: number;
  monthlyInterestOnly: number;
  monthlyRepayment: number;
  monthlyOpex: number;
  monthlyCashflowIO: number;
  monthlyCashflowRepay: number;
  annualCashflowIO: number;
  annualCashflowRepay: number;
  grossYield: number;
  netYield: number;
  roiIO: number;
  roiRepay: number;
  stressICR125: boolean;
  stressICR145: boolean;
  icr: number;
  rentToMortgage: number;
  breakEvenRent: number;
  annualGrossRent: number;
  annualEffectiveRent: number;
  annualOpex: number;
  annualNOI: number;
  taxableProfit: number;
  taxBill: number;
  postTaxCashflow: number;
  capRate: number;
}

export function calculateBTL(i: BTLInputs): BTLResults {
  const loanAmount = Math.max(0, i.purchasePrice - i.deposit);
  const ltv = i.purchasePrice ? (loanAmount / i.purchasePrice) * 100 : 0;
  const totalCashIn = i.deposit + i.stampDuty + i.legalFees + i.refurbCosts + i.surveyFees;

  const r = i.interestRate / 100 / 12;
  const n = i.mortgageTermYears * 12;
  const monthlyInterestOnly = loanAmount * r;
  const monthlyRepayment =
    n > 0 && r > 0
      ? (loanAmount * r) / (1 - Math.pow(1 + r, -n))
      : loanAmount / Math.max(1, n);

  const mgmt = (i.managementPct / 100) * i.monthlyRent;
  const maint = (i.maintenancePct / 100) * i.monthlyRent;
  const voids = (i.voidsPct / 100) * i.monthlyRent;
  const monthlyOpex = mgmt + maint + voids + i.insurance + i.groundRent + i.otherMonthly;

  const monthlyCashflowIO = i.monthlyRent - monthlyInterestOnly - monthlyOpex;
  const monthlyCashflowRepay = i.monthlyRent - monthlyRepayment - monthlyOpex;

  const annualGrossRent = i.monthlyRent * 12;
  const annualEffectiveRent = annualGrossRent - voids * 12;
  const annualOpex = (monthlyOpex - voids) * 12; // exclude voids from opex line
  const annualNOI = annualEffectiveRent - annualOpex;

  const grossYield = i.purchasePrice ? (annualGrossRent / i.purchasePrice) * 100 : 0;
  const netYield = i.purchasePrice ? (annualNOI / i.purchasePrice) * 100 : 0;
  const capRate = i.purchasePrice ? (annualNOI / i.purchasePrice) * 100 : 0;

  const annualCashflowIO = monthlyCashflowIO * 12;
  const annualCashflowRepay = monthlyCashflowRepay * 12;

  const roiIO = totalCashIn ? (annualCashflowIO / totalCashIn) * 100 : 0;
  const roiRepay = totalCashIn ? (annualCashflowRepay / totalCashIn) * 100 : 0;

  const icr = monthlyInterestOnly ? (i.monthlyRent / monthlyInterestOnly) * 100 : 0;
  // Lender stress: rent vs interest at 5.5% stress rate
  const stressMonthly = (loanAmount * 0.055) / 12;
  const stressedICR = stressMonthly ? (i.monthlyRent / stressMonthly) * 100 : 0;
  const stressICR125 = stressedICR >= 125;
  const stressICR145 = stressedICR >= 145;

  const rentToMortgage = monthlyInterestOnly ? i.monthlyRent / monthlyInterestOnly : 0;
  const breakEvenRent = monthlyInterestOnly + monthlyOpex;

  // Section 24 simplified: tax on rental profit before mortgage interest, then 20% credit on interest
  const profitBeforeInterest = annualEffectiveRent - annualOpex;
  const taxBeforeCredit = profitBeforeInterest * (i.taxRate / 100);
  const interestCredit = monthlyInterestOnly * 12 * 0.2;
  const taxBill = Math.max(0, taxBeforeCredit - interestCredit);
  const taxableProfit = profitBeforeInterest;
  const postTaxCashflow = annualCashflowIO - taxBill;

  return {
    loanAmount, ltv, totalCashIn, monthlyInterestOnly, monthlyRepayment, monthlyOpex,
    monthlyCashflowIO, monthlyCashflowRepay, annualCashflowIO, annualCashflowRepay,
    grossYield, netYield, roiIO, roiRepay, stressICR125, stressICR145, icr,
    rentToMortgage, breakEvenRent, annualGrossRent, annualEffectiveRent, annualOpex,
    annualNOI, taxableProfit, taxBill, postTaxCashflow, capRate,
  };
}

// UK BTL stamp duty (England, additional dwellings surcharge included, post Apr 2025)
export function calcStampDuty(price: number): number {
  if (price <= 0) return 0;
  const bands = [
    { upTo: 125000, rate: 0.05 },
    { upTo: 250000, rate: 0.07 },
    { upTo: 925000, rate: 0.10 },
    { upTo: 1500000, rate: 0.15 },
    { upTo: Infinity, rate: 0.17 },
  ];
  let tax = 0;
  let prev = 0;
  for (const b of bands) {
    if (price > prev) {
      const taxable = Math.min(price, b.upTo) - prev;
      tax += taxable * b.rate;
      prev = b.upTo;
    } else break;
  }
  return Math.round(tax);
}

export const fmtGBP = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(
    isFinite(n) ? n : 0,
  );

export const fmtPct = (n: number, d = 2) =>
  `${(isFinite(n) ? n : 0).toFixed(d)}%`;