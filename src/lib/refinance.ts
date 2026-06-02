import { fmtGBP, fmtPct } from "./btl";

export interface RefinanceInputs {
  // Purchase
  purchasePrice: number;
  deposit: number;
  depositPct: number;
  depositIsPct: boolean;
  stampDuty: number;
  legalFees: number;
  surveyFees: number;
  purchaseRate: number; // annual %
  // Refurb
  refurbCost: number;
  refurbMonths: number;
  holdingMonthly: number; // council tax, utilities, insurance during refurb
  bridgeRate: number; // annual %, 0 = cash funded
  // Refinance
  gdv: number; // post-refurb valuation
  refiLtv: number; // %
  refiRate: number; // annual %
  refiTermYears: number;
  refiFees: number;
  // Rental
  monthlyRent: number;
  managementPct: number;
  maintenancePct: number;
  voidsPct: number;
  insurance: number; // monthly
  groundRent: number; // monthly
  otherMonthly: number;
}

export interface RefinanceResults {
  depositAmount: number;
  purchaseLoan: number;
  purchaseInterestMonthly: number;
  purchaseInterestDuringRefurb: number;
  bridgeInterestDuringRefurb: number;
  holdingCostsTotal: number;
  totalCashIn: number;
  newLoan: number;
  newEquity: number;
  cashReleased: number;
  cashLeftIn: number;
  capitalRecycledPct: number;
  profitOnPaper: number;
  monthlyMortgageIO: number;
  monthlyMortgageRepay: number;
  monthlyOpex: number;
  monthlyCashflowIO: number;
  monthlyCashflowRepay: number;
  annualCashflowIO: number;
  grossYield: number;
  netYield: number;
  roiOnCashLeftIn: number; // Infinity if cashLeftIn <= 0
  icr: number;
  stressICR125: boolean;
  stressICR145: boolean;
  breakEvenRent: number;
  verdict: "full" | "partial" | "fail";
  verdictLabel: string;
}

export function calculateRefinance(i: RefinanceInputs): RefinanceResults {
  const depositAmount = i.depositIsPct
    ? Math.round(i.purchasePrice * (i.depositPct / 100))
    : i.deposit;
  const purchaseLoan = Math.max(0, i.purchasePrice - depositAmount);
  const purchaseInterestMonthly = (purchaseLoan * (i.purchaseRate / 100)) / 12;
  const purchaseInterestDuringRefurb = purchaseInterestMonthly * i.refurbMonths;
  const bridgeInterestDuringRefurb =
    (i.refurbCost * (i.bridgeRate / 100)) / 12 * i.refurbMonths;
  const holdingCostsTotal = i.holdingMonthly * i.refurbMonths;

  const totalCashIn =
    depositAmount +
    i.stampDuty +
    i.legalFees +
    i.surveyFees +
    i.refurbCost +
    holdingCostsTotal +
    purchaseInterestDuringRefurb +
    bridgeInterestDuringRefurb;

  const newLoan = Math.round(i.gdv * (i.refiLtv / 100));
  const newEquity = Math.max(0, i.gdv - newLoan);
  const cashReleased = newLoan - purchaseLoan - i.refiFees;
  const cashLeftIn = totalCashIn - cashReleased;
  const capitalRecycledPct = totalCashIn > 0 ? (cashReleased / totalCashIn) * 100 : 0;
  const profitOnPaper = i.gdv - (i.purchasePrice + i.refurbCost);

  const r = i.refiRate / 100 / 12;
  const n = i.refiTermYears * 12;
  const monthlyMortgageIO = newLoan * r;
  const monthlyMortgageRepay =
    n > 0 && r > 0
      ? (newLoan * r) / (1 - Math.pow(1 + r, -n))
      : newLoan / Math.max(1, n);

  const mgmt = (i.managementPct / 100) * i.monthlyRent;
  const maint = (i.maintenancePct / 100) * i.monthlyRent;
  const voids = (i.voidsPct / 100) * i.monthlyRent;
  const monthlyOpex = mgmt + maint + voids + i.insurance + i.groundRent + i.otherMonthly;

  const monthlyCashflowIO = i.monthlyRent - monthlyMortgageIO - monthlyOpex;
  const monthlyCashflowRepay = i.monthlyRent - monthlyMortgageRepay - monthlyOpex;
  const annualCashflowIO = monthlyCashflowIO * 12;

  const grossYield = i.gdv ? ((i.monthlyRent * 12) / i.gdv) * 100 : 0;
  const netYield = i.gdv ? ((i.monthlyRent * 12 - monthlyOpex * 12) / i.gdv) * 100 : 0;

  const roiOnCashLeftIn =
    cashLeftIn > 0 ? (annualCashflowIO / cashLeftIn) * 100 : Infinity;

  const icr = monthlyMortgageIO ? (i.monthlyRent / monthlyMortgageIO) * 100 : 0;
  const stressMonthly = (newLoan * 0.055) / 12;
  const stressedICR = stressMonthly ? (i.monthlyRent / stressMonthly) * 100 : 0;
  const stressICR125 = stressedICR >= 125;
  const stressICR145 = stressedICR >= 145;

  const breakEvenRent = monthlyMortgageIO + monthlyOpex;

  let verdict: "full" | "partial" | "fail" = "fail";
  let verdictLabel = "Doesn't stack";
  if (monthlyCashflowIO < 0 || !stressICR125) {
    verdict = "fail";
    verdictLabel = monthlyCashflowIO < 0 ? "Negative cashflow" : "Fails lender stress";
  } else if (cashLeftIn <= 0 && stressICR125) {
    verdict = "full";
    verdictLabel = "Full BRRR — all capital out";
  } else {
    verdict = "partial";
    verdictLabel = `Partial pull-out — ${fmtGBP(Math.max(0, cashLeftIn))} left in`;
  }

  return {
    depositAmount,
    purchaseLoan,
    purchaseInterestMonthly,
    purchaseInterestDuringRefurb,
    bridgeInterestDuringRefurb,
    holdingCostsTotal,
    totalCashIn,
    newLoan,
    newEquity,
    cashReleased,
    cashLeftIn,
    capitalRecycledPct,
    profitOnPaper,
    monthlyMortgageIO,
    monthlyMortgageRepay,
    monthlyOpex,
    monthlyCashflowIO,
    monthlyCashflowRepay,
    annualCashflowIO,
    grossYield,
    netYield,
    roiOnCashLeftIn,
    icr,
    stressICR125,
    stressICR145,
    breakEvenRent,
    verdict,
    verdictLabel,
  };
}

export const fmtROI = (n: number) =>
  !isFinite(n) ? "∞ (no money left in)" : fmtPct(n);
