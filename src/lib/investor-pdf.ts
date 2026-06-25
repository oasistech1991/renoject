import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { calculateRefinance, type RefinanceInputs } from "@/lib/refinance";
import { fmtGBP, fmtPct } from "@/lib/btl";

const ORANGE = "#F26A1F";
const BLACK = "#000000";
const WHITE = "#FFFFFF";
const TEXT = "#111111";
const HAIRLINE: [number, number, number] = [30, 30, 30];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

type MediaRow = {
  id: string;
  storage_path: string;
  kind: "image" | "pdf";
  is_hero: boolean;
  sort_order: number;
  filename: string | null;
};

type PropertyRow = {
  id: string;
  name: string;
  inputs: RefinanceInputs | any;
  metrics: any;
  source: string | null;
  created_at: string;
  updated_at: string;
};

function inferMethod(metrics: any, inputs: any): "btl" | "brrr" | "cash" | "mortgage" {
  if (metrics?.method) return metrics.method;
  const purchasePrice = Number(inputs?.purchasePrice ?? 0);
  const gdv = Number(inputs?.gdv ?? 0);
  const refurbCost = Number(inputs?.refurbCost ?? 0);
  const useBridge = !!inputs?.useBridge;
  if (inputs?.__btl) return "btl";
  if (useBridge || refurbCost > 0 || (gdv > 0 && gdv > purchasePrice)) return "brrr";
  const deposit = Number(inputs?.deposit ?? 0);
  const depositPct = Number(inputs?.depositPct ?? 0);
  if (deposit === 0 && depositPct === 0) return "cash";
  return "btl";
}

async function fetchAsDataUrl(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims: { w: number; h: number } = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    return { dataUrl, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

async function loadMedia(propertyId: string) {
  const { data } = await supabase
    .from("property_media")
    .select("*")
    .eq("property_id", propertyId)
    .order("is_hero", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const rows = ((data as MediaRow[]) ?? []).filter((r) => r.kind === "image");
  const signed = await Promise.all(
    rows.slice(0, 8).map(async (r) => {
      const { data: s } = await supabase.storage
        .from("property-media")
        .createSignedUrl(r.storage_path, 60 * 60);
      if (!s?.signedUrl) return null;
      const img = await fetchAsDataUrl(s.signedUrl);
      return img ? { ...r, ...img } : null;
    })
  );
  return signed.filter(Boolean) as Array<MediaRow & { dataUrl: string; w: number; h: number }>;
}

function paintBlackPage(doc: jsPDF) {
  doc.setFillColor(BLACK);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
}

function orangeHeader(doc: jsPDF, y: number, title: string): number {
  doc.setFillColor(ORANGE);
  doc.rect(MARGIN, y, CONTENT_W, 9, "F");
  doc.setTextColor(WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title.toUpperCase(), MARGIN + 3, y + 6.3);
  return y + 9;
}

function dataTable(
  doc: jsPDF,
  y: number,
  rows: Array<[string, string]>,
  opts: { totalRow?: [string, string]; colWidth?: number } = {}
): number {
  const body = rows.map(([k, v]) => [k, v]);
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: opts.colWidth ?? CONTENT_W,
    body,
    theme: "grid",
    styles: {
      fillColor: WHITE,
      textColor: TEXT,
      lineColor: HAIRLINE,
      lineWidth: 0.1,
      fontSize: 9,
      cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
      font: "helvetica",
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: (opts.colWidth ?? CONTENT_W) * 0.62 },
      1: { halign: "right", cellWidth: (opts.colWidth ?? CONTENT_W) * 0.38 },
    },
  });
  let endY = (doc as any).lastAutoTable.finalY as number;
  if (opts.totalRow) {
    autoTable(doc, {
      startY: endY,
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: opts.colWidth ?? CONTENT_W,
      body: [opts.totalRow],
      theme: "grid",
      styles: {
        fillColor: ORANGE,
        textColor: WHITE,
        lineColor: HAIRLINE,
        lineWidth: 0.1,
        fontStyle: "bold",
        fontSize: 10,
        cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
      },
      columnStyles: {
        0: { halign: "right", cellWidth: (opts.colWidth ?? CONTENT_W) * 0.62 },
        1: { halign: "right", cellWidth: (opts.colWidth ?? CONTENT_W) * 0.38 },
      },
    });
    endY = (doc as any).lastAutoTable.finalY as number;
  }
  return endY;
}

function ensureSpace(doc: jsPDF, y: number, need: number): number {
  if (y + need > PAGE_H - MARGIN) {
    doc.addPage();
    paintBlackPage(doc);
    return MARGIN;
  }
  return y;
}

function fmt0(n: number): string {
  if (!isFinite(n)) return "—";
  return fmtGBP(Math.round(n));
}

function fmtPctSafe(n: number, d = 2): string {
  if (!isFinite(n) || isNaN(n)) return "—";
  return fmtPct(n, d);
}

// ---------------- Pages ----------------

function renderCover(
  doc: jsPDF,
  property: PropertyRow,
  r: ReturnType<typeof calculateRefinance>,
  hero: { dataUrl: string; w: number; h: number } | null
) {
  paintBlackPage(doc);
  // Brand bar
  doc.setFillColor(ORANGE);
  doc.rect(0, 0, PAGE_W, 14, "F");
  doc.setTextColor(WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("RENOJECT", MARGIN, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("INVESTOR PACK", PAGE_W - MARGIN, 9, { align: "right" });

  // Hero photo
  const heroY = 14;
  const heroH = 150;
  if (hero) {
    try {
      doc.addImage(hero.dataUrl, "JPEG", 0, heroY, PAGE_W, heroH, undefined, "FAST");
    } catch {
      try {
        doc.addImage(hero.dataUrl, "PNG", 0, heroY, PAGE_W, heroH, undefined, "FAST");
      } catch {
        // ignore
      }
    }
  } else {
    doc.setFillColor("#1a1a1a");
    doc.rect(0, heroY, PAGE_W, heroH, "F");
    doc.setTextColor("#444");
    doc.setFontSize(10);
    doc.text("No photo uploaded", PAGE_W / 2, heroY + heroH / 2, { align: "center" });
  }

  // Title
  doc.setTextColor(WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  const name = property.name || "Untitled property";
  doc.text(name.toUpperCase(), MARGIN, heroY + heroH + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#bbbbbb");
  doc.text(
    `Prepared ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`,
    MARGIN,
    heroY + heroH + 23
  );

  // Headline metrics strip
  const stripY = heroY + heroH + 32;
  const cells: Array<[string, string]> = [
    ["PURCHASE", fmt0(property.inputs?.purchasePrice ?? 0)],
    ["GDV", fmt0(property.inputs?.gdv ?? 0)],
    ["MONEY LEFT IN", fmt0(Math.max(0, r.cashLeftIn))],
    ["ROI", isFinite(r.roiOnCashLeftIn) ? fmtPct(r.roiOnCashLeftIn, 1) : "∞"],
    ["MONTHLY CASHFLOW", fmt0(r.monthlyCashflowIO)],
    ["GROSS YIELD", fmtPctSafe(r.grossYield, 1)],
  ];
  const cols = 3;
  const cellW = CONTENT_W / cols;
  const cellH = 22;
  cells.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * cellW;
    const y = stripY + row * cellH;
    doc.setDrawColor(ORANGE);
    doc.setLineWidth(0.4);
    doc.rect(x, y, cellW, cellH, "S");
    doc.setTextColor("#aaaaaa");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(c[0], x + 3, y + 5);
    doc.setTextColor(WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(c[1], x + 3, y + 15);
  });
}

function renderSummary(
  doc: jsPDF,
  property: PropertyRow,
  r: ReturnType<typeof calculateRefinance>,
  gallery: Array<{ dataUrl: string; w: number; h: number }>
) {
  doc.addPage();
  paintBlackPage(doc);
  doc.setTextColor(WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("INVESTMENT SUMMARY", MARGIN, MARGIN + 6);

  const method = inferMethod(property.metrics ?? {}, property.inputs ?? {});
  const methodLabel =
    method === "brrr"
      ? "Buy · Refurb · Refinance · Rent"
      : method === "cash"
      ? "Cash purchase"
      : method === "mortgage"
      ? "Mortgage purchase"
      : "Buy-to-let";

  const years = isFinite(r.allMoneyOutYears) ? r.allMoneyOutYears.toFixed(2) : "—";
  const roi = isFinite(r.roiOnCashLeftIn) ? fmtPct(r.roiOnCashLeftIn, 1) : "infinite";
  const narrative = `Strategy: ${methodLabel}. Acquisition price ${fmt0(
    property.inputs?.purchasePrice ?? 0
  )}, conservative GDV ${fmt0(property.inputs?.gdv ?? 0)}. Projected money left in the deal: ${fmt0(
    Math.max(0, r.cashLeftIn)
  )}, returning ${roi} net annually with ${fmt0(
    r.monthlyCashflowIO
  )} monthly cashflow. All-money-out target: ${years} years.`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#dddddd");
  const lines = doc.splitTextToSize(narrative, CONTENT_W);
  doc.text(lines, MARGIN, MARGIN + 14);

  // Gallery 2x2 (skip hero, already on cover)
  const galleryStart = MARGIN + 14 + lines.length * 5 + 6;
  const skipHeroOnly = gallery.slice(1, 5);
  if (skipHeroOnly.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(WHITE);
    doc.text("GALLERY", MARGIN, galleryStart);
    const gridY = galleryStart + 3;
    const tileW = (CONTENT_W - 4) / 2;
    const tileH = 55;
    skipHeroOnly.forEach((img, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = MARGIN + col * (tileW + 4);
      const y = gridY + row * (tileH + 4);
      try {
        doc.addImage(img.dataUrl, "JPEG", x, y, tileW, tileH, undefined, "FAST");
      } catch {
        try {
          doc.addImage(img.dataUrl, "PNG", x, y, tileW, tileH, undefined, "FAST");
        } catch {
          // ignore
        }
      }
    });
  }
}

function renderCalculator(
  doc: jsPDF,
  property: PropertyRow,
  r: ReturnType<typeof calculateRefinance>
) {
  const i = property.inputs ?? {};
  const method = inferMethod(property.metrics ?? {}, i);

  doc.addPage();
  paintBlackPage(doc);
  let y = MARGIN;

  // KEY METRICS
  y = orangeHeader(doc, y, "KEY METRICS");
  const mgmtPct = Number(i.managementPct ?? 0);
  const mgmtFee = (mgmtPct / 100) * Number(i.monthlyRent ?? 0);
  y = dataTable(doc, y, [
    ["Purchase Price", fmt0(i.purchasePrice ?? 0)],
    ["Fixtures & Fittings", fmt0(i.fixturesFittings ?? 0)],
    ["Refurbishment Cost", fmt0(i.refurbCost ?? 0)],
    ["Conservative GDV", fmt0(i.gdv ?? 0)],
    ["Mortgage Payment (Post Refinance)", fmt0(r.monthlyMortgageIO)],
    ["Management (%)", fmtPctSafe(mgmtPct, 0)],
    ["Management Fee (monthly)", fmt0(mgmtFee)],
  ]);

  // STRESS TEST + REVENUE side by side via two sections
  y += 4;
  y = ensureSpace(doc, y, 50);
  y = orangeHeader(doc, y, "STRESS TEST");
  const stressRate = 6.5;
  const stressMonthly = (r.newLoan * (stressRate / 100)) / 12;
  const stressCashflow = Number(i.monthlyRent ?? 0) - stressMonthly - r.monthlyOpex;
  y = dataTable(doc, y, [
    ["Interest Rate PA %", fmtPct(stressRate, 2)],
    ["Mortgage Payment", fmt0(stressMonthly)],
    ["Net Monthly Cashflow", fmt0(stressCashflow)],
  ]);

  y += 4;
  y = ensureSpace(doc, y, 60);
  y = orangeHeader(doc, y, "REVENUE");
  y = dataTable(doc, y, [
    ["Lettable Units", String(i.lettableUnits ?? 1)],
    ["Current Monthly Rent", fmt0(i.currentMonthlyRent ?? 0)],
    ["Achievable Monthly Rent", fmt0(i.monthlyRent ?? 0)],
    ["Achievable Annual Rent", fmt0(Number(i.monthlyRent ?? 0) * 12)],
    ["Gross Yield", fmtPctSafe(r.grossYieldOnPurchase, 2)],
  ]);

  // MONTHLY OPERATING COSTS
  y += 4;
  y = ensureSpace(doc, y, 70);
  y = orangeHeader(doc, y, "MONTHLY OPERATING COSTS");
  const mgmt = (Number(i.managementPct ?? 0) / 100) * Number(i.monthlyRent ?? 0);
  const maint = (Number(i.maintenancePct ?? 0) / 100) * Number(i.monthlyRent ?? 0);
  const voids = (Number(i.voidsPct ?? 0) / 100) * Number(i.monthlyRent ?? 0);
  y = dataTable(
    doc,
    y,
    [
      ["Management Fee", fmt0(mgmt)],
      ["Maintenance Allowance", fmt0(maint)],
      ["Voids Allowance", fmt0(voids)],
      ["Insurance & Compliance", fmt0(i.insurance ?? 0)],
      ["Service Charge / Ground Rent", fmt0(i.groundRent ?? 0)],
      ["Other", fmt0(i.otherMonthly ?? 0)],
    ],
    { totalRow: ["TOTAL", fmt0(r.monthlyOpex)] }
  );

  // Finance scenario page
  doc.addPage();
  paintBlackPage(doc);
  y = MARGIN;

  if (method === "brrr" && i.useBridge) {
    y = renderBridgingScenario(doc, y, i, r);
  } else if (method === "cash") {
    y = renderCashScenario(doc, y, i, r);
  } else {
    y = renderMortgageScenario(doc, y, i, r);
  }
}

function renderBridgingScenario(
  doc: jsPDF,
  yStart: number,
  i: any,
  r: ReturnType<typeof calculateRefinance>
): number {
  let y = orangeHeader(doc, yStart, "BRIDGING FINANCE PURCHASE");
  const depositPct = i.purchasePrice
    ? ((i.purchasePrice - i.purchasePrice * (Number(i.bridgeLoanPct ?? 0) / 100)) / i.purchasePrice) * 100
    : 0;
  y = dataTable(doc, y, [
    ["Deposit %", fmtPct(depositPct, 0)],
    ["Loan to Value (LTV)", fmtPct(Number(i.bridgeLoanPct ?? 0), 0)],
    ["Total Loan", fmt0(r.bridgeLoan)],
    ["Interest Rate PCM %", fmtPct(Number(i.bridgeRatePCM ?? 0), 2)],
    ["Bridging Term (Months)", String(i.bridgeTermMonths ?? 0)],
  ]);
  y += 1;
  y = orangeHeader(doc, y, "COSTS");
  y = dataTable(
    doc,
    y,
    [
      ["Deposit", fmt0(r.depositAmount)],
      ["Fixtures & Fittings", fmt0(i.fixturesFittings ?? 0)],
      ["Refurbishment Cost", fmt0(i.refurbCost ?? 0)],
      ["Furnishing", fmt0(i.furnishing ?? 0)],
      ["Legal Fees", fmt0(i.legalFees ?? 0)],
      ["Stamp Duty Land Tax (SDLT)", fmt0(i.stampDuty ?? 0)],
      ["Broker Fees", fmt0(i.brokerFees ?? 0)],
      ["Lender Fee", fmt0(i.lenderFee ?? 0)],
      ["Additional Fees", fmt0(i.additionalFees ?? 0)],
      ["Auction Fees", fmt0(i.auctionFees ?? 0)],
      ["Sourcing Fee", fmt0(i.sourcingFee ?? 0)],
    ],
    { totalRow: ["TOTAL CASH INVESTED", fmt0(r.totalCashIn)] }
  );

  y += 4;
  y = ensureSpace(doc, y, 80);
  y = orangeHeader(doc, y, "REFINANCE");
  y = dataTable(doc, y, [
    ["Conservative GDV", fmt0(i.gdv ?? 0)],
    ["Loan to Value (LTV)", fmtPct(Number(i.refiLtv ?? 0), 0)],
    ["Total Mortgage", fmt0(r.newLoan)],
    ["Interest Rate PA %", fmtPct(Number(i.refiRate ?? 0), 2)],
    ["Mortgage Payment", fmt0(r.monthlyMortgageIO)],
    ["Cash Release", fmt0(r.cashReleased + r.bridgeRepaymentTotal)],
    ["Repay Bridging Loan", fmt0(r.bridgeRepaymentTotal - r.bridgeInterestTotal - r.bridgeExitFee)],
    ["Bridging Interest", fmt0(r.bridgeInterestTotal)],
    ["Money Left in Deal", fmt0(Math.max(0, r.cashLeftIn))],
    ["Net Return on Investment (ROI)", isFinite(r.roiOnCashLeftIn) ? fmtPct(r.roiOnCashLeftIn, 2) : "∞"],
    ["All Money Out Years", isFinite(r.allMoneyOutYears) ? r.allMoneyOutYears.toFixed(2) : "—"],
  ]);

  if (i.flipEnabled) {
    y += 4;
    y = ensureSpace(doc, y, 50);
    y = orangeHeader(doc, y, "FLIP");
    y = dataTable(doc, y, [
      ["Sale Price Achieved", fmt0(i.flipSalePrice ?? 0)],
      ["Legal Fees", fmt0(i.flipLegalFees ?? 0)],
      ["Agency Fee", fmt0(i.flipAgencyFee ?? 0)],
      ["Profit", fmt0(r.flipProfit)],
    ]);
  }
  return y;
}

function renderMortgageScenario(
  doc: jsPDF,
  yStart: number,
  i: any,
  r: ReturnType<typeof calculateRefinance>
): number {
  let y = orangeHeader(doc, yStart, "MORTGAGE PURCHASE");
  const ltv = i.purchasePrice ? ((i.purchasePrice - r.depositAmount) / i.purchasePrice) * 100 : 0;
  y = dataTable(doc, y, [
    ["Deposit %", fmtPct(i.purchasePrice ? (r.depositAmount / i.purchasePrice) * 100 : 0, 0)],
    ["Loan to Value (LTV)", fmtPct(ltv, 0)],
    ["Total Loan", fmt0(r.purchaseLoan)],
    ["Interest Rate PA %", fmtPct(Number(i.purchaseRate ?? 0), 2)],
  ]);
  y += 1;
  y = orangeHeader(doc, y, "COSTS");
  y = dataTable(
    doc,
    y,
    [
      ["Deposit", fmt0(r.depositAmount)],
      ["Fixtures & Fittings", fmt0(i.fixturesFittings ?? 0)],
      ["Refurbishment Cost", fmt0(i.refurbCost ?? 0)],
      ["Furnishing", fmt0(i.furnishing ?? 0)],
      ["Legal Fees", fmt0(i.legalFees ?? 0)],
      ["Stamp Duty Land Tax (SDLT)", fmt0(i.stampDuty ?? 0)],
      ["Broker Fees", fmt0(i.brokerFees ?? 0)],
      ["Lender Fee", fmt0(i.lenderFee ?? 0)],
      ["Additional Fees", fmt0(i.additionalFees ?? 0)],
      ["Auction Fees", fmt0(i.auctionFees ?? 0)],
      ["Sourcing Fee", fmt0(i.sourcingFee ?? 0)],
    ],
    { totalRow: ["TOTAL CASH INVESTED", fmt0(r.totalCashIn)] }
  );

  if ((i.gdv ?? 0) > (i.purchasePrice ?? 0)) {
    y += 4;
    y = ensureSpace(doc, y, 70);
    y = orangeHeader(doc, y, "REFINANCE");
    y = dataTable(doc, y, [
      ["Conservative GDV", fmt0(i.gdv ?? 0)],
      ["Loan to Value (LTV)", fmtPct(Number(i.refiLtv ?? 0), 0)],
      ["Total Mortgage", fmt0(r.newLoan)],
      ["Interest Rate PA %", fmtPct(Number(i.refiRate ?? 0), 2)],
      ["Mortgage Payment", fmt0(r.monthlyMortgageIO)],
      ["Cash Release", fmt0(r.cashReleased)],
      ["Money Left in Deal", fmt0(Math.max(0, r.cashLeftIn))],
      ["Net Return on Investment (ROI)", isFinite(r.roiOnCashLeftIn) ? fmtPct(r.roiOnCashLeftIn, 2) : "∞"],
      ["All Money Out Years", isFinite(r.allMoneyOutYears) ? r.allMoneyOutYears.toFixed(2) : "—"],
    ]);
  }
  return y;
}

function renderCashScenario(
  doc: jsPDF,
  yStart: number,
  i: any,
  r: ReturnType<typeof calculateRefinance>
): number {
  let y = orangeHeader(doc, yStart, "CASH PURCHASE");
  y = dataTable(doc, y, [
    ["Purchase Price", fmt0(i.purchasePrice ?? 0)],
    ["Fixtures & Fittings", fmt0(i.fixturesFittings ?? 0)],
    ["Refurbishment Cost", fmt0(i.refurbCost ?? 0)],
    ["Furnishing", fmt0(i.furnishing ?? 0)],
    ["Legal Fees", fmt0(i.legalFees ?? 0)],
    ["Stamp Duty Land Tax (SDLT)", fmt0(i.stampDuty ?? 0)],
    ["Additional Fees", fmt0(i.additionalFees ?? 0)],
    ["Auction Fees", fmt0(i.auctionFees ?? 0)],
    ["Sourcing Fee", fmt0(i.sourcingFee ?? 0)],
  ], { totalRow: ["TOTAL CASH INVESTED", fmt0(r.totalCashIn)] });
  return y;
}

function renderContact(doc: jsPDF) {
  doc.addPage();
  paintBlackPage(doc);
  doc.setFillColor(ORANGE);
  doc.rect(0, 0, PAGE_W, 14, "F");
  doc.setTextColor(WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("RENOJECT", MARGIN, 9);

  doc.setTextColor(WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Let's talk.", MARGIN, 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor("#dddddd");
  const intro =
    "If this opportunity fits your portfolio, get in touch and we'll walk through the deal, timelines, and next steps.";
  doc.text(doc.splitTextToSize(intro, CONTENT_W), MARGIN, 62);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(ORANGE);
  doc.text("WEB", MARGIN, 90);
  doc.text("EMAIL", MARGIN, 102);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(WHITE);
  doc.text("renojectholdings.com", MARGIN + 22, 90);
  doc.text("invest@renojectholdings.com", MARGIN + 22, 102);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor("#777777");
  const disclaimer =
    "This document is for information only and does not constitute investment advice or an offer of securities. Figures are projections based on the inputs entered at the time of generation and are not guaranteed. Capital is at risk. Investors should conduct their own due diligence and seek independent professional advice before making any investment decision.";
  doc.text(doc.splitTextToSize(disclaimer, CONTENT_W), MARGIN, PAGE_H - 25);
}

// ---------------- Entry ----------------

export async function exportInvestorPack(propertyId: string): Promise<void> {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Property not found");
  const property = data as PropertyRow;

  const media = await loadMedia(propertyId);
  const hero = media.find((m) => m.is_hero) ?? media[0] ?? null;

  const inputs = property.inputs as RefinanceInputs;
  const results = calculateRefinance(inputs);

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  renderCover(doc, property, results, hero);
  renderSummary(doc, property, results, media);
  renderCalculator(doc, property, results);
  renderContact(doc);

  const safeName = (property.name || "investor-pack").replace(/[^a-z0-9-_ ]+/gi, "").slice(0, 60).trim();
  doc.save(`Renoject — ${safeName} — Investor Pack.pdf`);
}