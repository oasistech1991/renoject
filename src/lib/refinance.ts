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
  // Additional acquisition costs
  fixturesFittings: number;
  furnishing: number;
  brokerFees: number;
  lenderFee: number;
  additionalFees: number;
  auctionFees: number;
  sourcingFee: number;
  // Refurb
  refurbCost: number;
  refurbMonths: number;
  holdingMonthly: number; // council tax, utilities, insurance during refurb
  // Bridging finance
  useBridge: boolean;
  bridgeLoanPct: number; // % of purchase price covered by bridge
  bridgeFundsRefurb: boolean; // bridge also funds the refurb cost
  bridgeRate: number; // annual % (derived from PCM when bridgeRateIsPCM)
  bridgeRatePCM: number; // monthly %
  bridgeRateIsPCM: boolean; // input mode toggle
  bridgeTermMonths: number; // bridge term until refi (>= refurbMonths)
  bridgeArrangementPct: number; // % of bridge loan
  bridgeArrangementIsPct: boolean;
  bridgeArrangementAmount: number; // £ flat fee
  bridgeExitPct: number; // % of bridge loan
  bridgeInterestRolled: boolean; // true = rolled up & compounded, false = serviced monthly
  // Refinance
  gdv: number; // post-refurb valuation
  refiLtv: number; // %
  refiRate: number; // annual %
  refiTermYears: number;
  refiFees: number;
  // Rental
  lettableUnits: number;
  currentMonthlyRent: number;
  monthlyRent: number;
  managementPct: number;
  maintenancePct: number;
  voidsPct: number;
  insurance: number; // monthly
  groundRent: number; // monthly
  otherMonthly: number;
  // Flip / exit scenario
  flipEnabled: boolean;
  flipSalePrice: number;
  flipLegalFees: number;
  flipAgencyFee: number;
}

export interface RefinanceResults {
  depositAmount: number;
  purchaseLoan: number;
  purchaseInterestMonthly: number;
  purchaseInterestDuringRefurb: number;
  // Bridging
  bridgeLoan: number;
  bridgeArrangementFee: number;
  bridgeExitFee: number;
  bridgeInterestTotal: number;
  bridgeInterestServicedMonthly: number;
  bridgeRepaymentTotal: number; // principal + rolled interest + exit fee
  bridgeLTGDV: number; // bridge debt vs GDV
  holdingCostsTotal: number;
  additionalAcquisitionCosts: number;
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
  // Headline metrics
  belowMarketValuePct: number;
  grossYieldOnPurchase: number;
  annualRent: number;
  allMoneyOutYears: number;
  // Flip
  flipProfit: number;
  verdict: "full" | "partial" | "fail";
  verdictLabel: string;
}

export function calculateRefinance(i: RefinanceInputs): RefinanceResults {
  // --- Acquisition financing ---
  let depositAmount: number;
  let purchaseLoan: number;
  let purchaseInterestMonthly = 0;
  let purchaseInterestDuringRefurb = 0;

  let bridgeLoan = 0;
  let bridgeArrangementFee = 0;
  let bridgeExitFee = 0;
  let bridgeInterestTotal = 0;
  let bridgeInterestServicedMonthly = 0;
  let bridgeRepaymentTotal = 0;

  const termMonths = Math.max(i.bridgeTermMonths, i.refurbMonths);

  const bridgeAnnualRate = i.bridgeRateIsPCM ? i.bridgeRatePCM * 12 : i.bridgeRate;

  if (i.useBridge) {
    // Bridge funds % of purchase, optionally adds refurb
    bridgeLoan = i.purchasePrice * (i.bridgeLoanPct / 100)
      + (i.bridgeFundsRefurb ? i.refurbCost : 0);
  bridgeArrangementFee = i.bridgeArrangementIsPct
    ? bridgeLoan * (i.bridgeArrangementPct / 100)
    : i.bridgeArrangementAmount;
    bridgeExitFee = bridgeLoan * (i.bridgeExitPct / 100);

    // Arrangement fee is typically added to the loan (rolled in)
    const principal = bridgeLoan + bridgeArrangementFee;
    const monthlyRate = bridgeAnnualRate / 100 / 12;

    if (i.bridgeInterestRolled) {
      const grown = principal * Math.pow(1 + monthlyRate, termMonths);
      bridgeInterestTotal = grown - principal;
    } else {
      bridgeInterestServicedMonthly = principal * monthlyRate;
      bridgeInterestTotal = bridgeInterestServicedMonthly * termMonths;
    }
    bridgeRepaymentTotal = principal + (i.bridgeInterestRolled ? bridgeInterestTotal : 0) + bridgeExitFee;

    // Deposit = cash to complete purchase after bridge contribution
    depositAmount = Math.max(0, i.purchasePrice - i.purchasePrice * (i.bridgeLoanPct / 100));
    purchaseLoan = 0; // bridge replaces the standard mortgage at purchase
  } else {
    depositAmount = i.depositIsPct
      ? Math.round(i.purchasePrice * (i.depositPct / 100))
      : i.deposit;
    purchaseLoan = Math.max(0, i.purchasePrice - depositAmount);
    purchaseInterestMonthly = (purchaseLoan * (i.purchaseRate / 100)) / 12;
    purchaseInterestDuringRefurb = purchaseInterestMonthly * i.refurbMonths;
  }

  const holdingCostsTotal = i.holdingMonthly * i.refurbMonths;

  const additionalAcquisitionCosts =
    i.fixturesFittings +
    i.furnishing +
    i.brokerFees +
    i.lenderFee +
    i.additionalFees +
    i.auctionFees +
    i.sourcingFee;

  const refurbCashOutlay = i.useBridge && i.bridgeFundsRefurb ? 0 : i.refurbCost;
  const servicedBridgeInterestPaid = i.useBridge && !i.bridgeInterestRolled
    ? bridgeInterestTotal
    : 0;

  const totalCashIn =
    depositAmount +
    i.stampDuty +
    i.legalFees +
    i.surveyFees +
    additionalAcquisitionCosts +
    refurbCashOutlay +
    holdingCostsTotal +
    purchaseInterestDuringRefurb +
    servicedBridgeInterestPaid;

  const newLoan = Math.round(i.gdv * (i.refiLtv / 100));
  const newEquity = Math.max(0, i.gdv - newLoan);
  const debtToRepayAtRefi = i.useBridge ? bridgeRepaymentTotal : purchaseLoan;
  const cashReleased = newLoan - debtToRepayAtRefi - i.refiFees;
  const cashLeftIn = totalCashIn - cashReleased;
  const capitalRecycledPct = totalCashIn > 0 ? (cashReleased / totalCashIn) * 100 : 0;
  const profitOnPaper = i.gdv - (i.purchasePrice + i.refurbCost);
  const bridgeLTGDV = i.useBridge && i.gdv > 0 ? (bridgeRepaymentTotal / i.gdv) * 100 : 0;

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

  const belowMarketValuePct = i.gdv > 0 ? ((i.gdv - i.purchasePrice) / i.gdv) * 100 : 0;
  const annualRent = i.monthlyRent * 12 * Math.max(1, i.lettableUnits || 1);
  const grossYieldOnPurchase = i.purchasePrice > 0 ? (annualRent / i.purchasePrice) * 100 : 0;
  const allMoneyOutYears =
    cashLeftIn <= 0 ? 0 : annualCashflowIO > 0 ? cashLeftIn / annualCashflowIO : Infinity;

  // Flip profit: sale price minus all cash in (excl. deposit which is recovered via sale proceeds)
  // and minus bridge/purchase debt redemption, plus flip selling costs.
  const debtToClear = i.useBridge ? bridgeRepaymentTotal : purchaseLoan;
  const flipProfit = i.flipEnabled
    ? i.flipSalePrice - i.flipLegalFees - i.flipAgencyFee - debtToClear - (totalCashIn) + depositAmount + (i.useBridge ? 0 : 0)
    : 0;
  // Note: depositAmount is added back because it forms part of totalCashIn but is recovered from sale equity.

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
    bridgeLoan,
    bridgeArrangementFee,
    bridgeExitFee,
    bridgeInterestTotal,
    bridgeInterestServicedMonthly,
    bridgeRepaymentTotal,
    bridgeLTGDV,
    holdingCostsTotal,
    additionalAcquisitionCosts,
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
    belowMarketValuePct,
    grossYieldOnPurchase,
    annualRent,
    allMoneyOutYears,
    flipProfit,
    verdict,
    verdictLabel,
  };
}

export const fmtROI = (n: number) =>
  !isFinite(n) ? "∞ (no money left in)" : fmtPct(n);
