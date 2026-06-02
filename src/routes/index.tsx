import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { calcStampDuty, calculateBTL, fmtGBP, fmtPct, type BTLInputs } from "@/lib/btl";
import { MetricCard } from "@/components/btl/MetricCard";
import { NumberField } from "@/components/btl/NumberField";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Buy-to-Let Calculator — Full Property Investment Breakdown" },
      { name: "description", content: "Instantly calculate yield, ROI, ICR, cashflow, stamp duty and tax for any UK buy-to-let property." },
      { property: "og:title", content: "Buy-to-Let Calculator" },
      { property: "og:description", content: "Yield, ROI, ICR, cashflow and tax — every BTL metric in one place." },
    ],
  }),
  component: Index,
});

const defaults: BTLInputs = {
  purchasePrice: 200000,
  deposit: 50000,
  depositPct: 25,
  depositIsPct: false,
  interestRate: 5.5,
  mortgageTermYears: 25,
  monthlyRent: 1200,
  stampDuty: calcStampDuty(200000),
  legalFees: 1500,
  refurbCosts: 3000,
  surveyFees: 500,
  managementPct: 10,
  maintenancePct: 5,
  insurance: 25,
  groundRent: 0,
  voidsPct: 4,
  otherMonthly: 0,
  taxRate: 40,
};

function Index() {
  const [inputs, setInputs] = useState<BTLInputs>(defaults);

  const set = <K extends keyof BTLInputs>(k: K, v: BTLInputs[K]) =>
    setInputs((p) => ({ ...p, [k]: v }));

  const r = useMemo(() => calculateBTL(inputs), [inputs]);

  const autoStamp = () => set("stampDuty", calcStampDuty(inputs.purchasePrice));
  const reset = () => setInputs(defaults);

  const setDepositMode = (isPct: boolean) => {
    if (isPct === inputs.depositIsPct) return;
    setInputs((p) => {
      if (isPct) {
        const pct = p.purchasePrice > 0 ? (p.deposit / p.purchasePrice) * 100 : 0;
        return { ...p, depositIsPct: true, depositPct: Math.round(pct * 10) / 10 };
      }
      const amount = Math.round(p.purchasePrice * (p.depositPct / 100));
      return { ...p, depositIsPct: false, deposit: amount };
    });
  };

  const depositHint = inputs.depositIsPct
    ? `= ${fmtGBP(Math.round(inputs.purchasePrice * (inputs.depositPct / 100)))} · LTV: ${fmtPct(r.ltv, 1)}`
    : `${fmtPct((inputs.purchasePrice ? (inputs.deposit / inputs.purchasePrice) * 100 : 0), 1)} of price · LTV: ${fmtPct(r.ltv, 1)}`;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              £
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Buy-to-Let Calculator</h1>
              <p className="text-xs text-muted-foreground">UK property investment breakdown</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>Reset</Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
          {/* Inputs */}
          <section className="space-y-6">
            <InputGroup title="Purchase method">
              <div className="grid grid-cols-3 overflow-hidden rounded-md border border-border">
                {([
                  ["mortgage", "Mortgage"],
                  ["cash", "Cash"],
                  ["bridge", "Bridge + refurb"],
                ] as const).map(([key, label]) => (
                  <Button
                    key={key}
                    type="button"
                    variant={mode === key ? "secondary" : "ghost"}
                    size="sm"
                    className="rounded-none"
                    onClick={() => setMode(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {mode === "cash"
                  ? "No mortgage — full purchase price paid in cash."
                  : mode === "bridge"
                    ? "Short-term bridging finance to buy & refurb, then refinance onto the BTL mortgage below."
                    : "Standard BTL mortgage with deposit."}
              </p>
            </InputGroup>

            <InputGroup title="The Property">
              <NumberField id="price" label="Purchase price" prefix="£" step={1000}
                value={inputs.purchasePrice}
                onChange={(v) => set("purchasePrice", v)} />
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <NumberField
                    id="deposit"
                    label="Deposit"
                    prefix={inputs.depositIsPct ? undefined : "£"}
                    suffix={inputs.depositIsPct ? "%" : undefined}
                    step={inputs.depositIsPct ? 1 : 1000}
                    value={inputs.depositIsPct ? inputs.depositPct : inputs.deposit}
                    onChange={(v) => set(inputs.depositIsPct ? "depositPct" : "deposit", v)}
                    hint={depositHint}
                  />
                </div>
                <div className="flex overflow-hidden rounded-md border border-border">
                  <Button
                    type="button"
                    variant={inputs.depositIsPct ? "ghost" : "secondary"}
                    size="sm"
                    className="rounded-none"
                    onClick={() => setDepositMode(false)}
                  >
                    £
                  </Button>
                  <Button
                    type="button"
                    variant={inputs.depositIsPct ? "secondary" : "ghost"}
                    size="sm"
                    className="rounded-none"
                    onClick={() => setDepositMode(true)}
                  >
                    %
                  </Button>
                </div>
              </div>
              <NumberField id="rent" label="Expected monthly rent" prefix="£"
                value={inputs.monthlyRent} onChange={(v) => set("monthlyRent", v)} />
            </InputGroup>

            {mode !== "cash" && (
              <InputGroup title={mode === "bridge" ? "Exit mortgage (post-refurb)" : "The Mortgage"}>
                <NumberField id="rate" label="Interest rate" suffix="%" step={0.1}
                  value={inputs.interestRate} onChange={(v) => set("interestRate", v)} />
                <NumberField id="term" label="Term (years)" suffix="yr"
                  value={inputs.mortgageTermYears} onChange={(v) => set("mortgageTermYears", v)} />
              </InputGroup>
            )}

            {mode === "bridge" && (
              <InputGroup title="Bridging finance">
                <NumberField id="bridgeLtv" label="Bridge LTV" suffix="%" step={1}
                  value={bridge.ltv} onChange={(v) => setBridge((b) => ({ ...b, ltv: v }))} />
                <NumberField id="bridgeRate" label="Bridge rate (annual)" suffix="%" step={0.1}
                  value={bridge.rate} onChange={(v) => setBridge((b) => ({ ...b, rate: v }))} />
                <NumberField id="bridgeMonths" label="Bridge term" suffix="mo" step={1}
                  value={bridge.months} onChange={(v) => setBridge((b) => ({ ...b, months: v }))} />
                <NumberField id="bridgeFee" label="Arrangement + exit fees" suffix="%" step={0.1}
                  value={bridge.feePct} onChange={(v) => setBridge((b) => ({ ...b, feePct: v }))}
                  hint={`Bridge loan ${fmtGBP(bridgeLoan)} · Finance cost ${fmtGBP(bridgeTotal)}`} />
              </InputGroup>
            )}

            <InputGroup title="Purchase Costs">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <NumberField id="stamp" label="Stamp duty" prefix="£"
                    value={inputs.stampDuty} onChange={(v) => set("stampDuty", v)} />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={autoStamp}>
                  Auto
                </Button>
              </div>
              <NumberField id="legal" label="Legal fees" prefix="£"
                value={inputs.legalFees} onChange={(v) => set("legalFees", v)} />
              <NumberField id="survey" label="Survey / valuation" prefix="£"
                value={inputs.surveyFees} onChange={(v) => set("surveyFees", v)} />
              <NumberField id="refurb" label="Refurb / furnishing" prefix="£"
                value={inputs.refurbCosts} onChange={(v) => set("refurbCosts", v)} />
            </InputGroup>

            <InputGroup title="Running Costs">
              <NumberField id="mgmt" label="Management fee" suffix="%"
                value={inputs.managementPct} onChange={(v) => set("managementPct", v)} />
              <NumberField id="maint" label="Maintenance allowance" suffix="%"
                value={inputs.maintenancePct} onChange={(v) => set("maintenancePct", v)} />
              <NumberField id="voids" label="Voids allowance" suffix="%"
                value={inputs.voidsPct} onChange={(v) => set("voidsPct", v)} />
              <NumberField id="ins" label="Insurance / month" prefix="£"
                value={inputs.insurance} onChange={(v) => set("insurance", v)} />
              <NumberField id="ground" label="Ground rent / service / month" prefix="£"
                value={inputs.groundRent} onChange={(v) => set("groundRent", v)} />
              <NumberField id="other" label="Other / month" prefix="£"
                value={inputs.otherMonthly} onChange={(v) => set("otherMonthly", v)} />
            </InputGroup>

            <InputGroup title="Tax">
              <NumberField id="tax" label="Your income tax rate" suffix="%"
                value={inputs.taxRate} onChange={(v) => set("taxRate", v)}
                hint="20 basic · 40 higher · 45 additional" />
            </InputGroup>
          </section>

          {/* Results */}
          <section className="space-y-6">
            <div>
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Headline metrics</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Gross yield" value={fmtPct(r.grossYield)} hint="Annual rent ÷ price" tone="positive" />
                <MetricCard label="Net yield" value={fmtPct(r.netYield)} hint="After running costs" tone="positive" />
                <MetricCard label="ROI (cash-on-cash)" value={fmtPct(r.roiIO)} hint="Interest-only basis" tone="accent" />
                <MetricCard label="Cap rate (NOI)" value={fmtPct(r.capRate)} hint="NOI ÷ price" />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Monthly cashflow</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Rent" value={fmtGBP(inputs.monthlyRent)} />
                <MetricCard label="Mortgage (IO)" value={fmtGBP(r.monthlyInterestOnly)} hint={`Repayment: ${fmtGBP(r.monthlyRepayment)}`} />
                <MetricCard label="Operating costs" value={fmtGBP(r.monthlyOpex)} hint="Mgmt, maint, voids, insurance" />
                <MetricCard
                  label="Cashflow (IO)"
                  value={fmtGBP(r.monthlyCashflowIO)}
                  hint={`Repayment basis: ${fmtGBP(r.monthlyCashflowRepay)}`}
                  tone={r.monthlyCashflowIO >= 0 ? "positive" : "negative"}
                />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Lender stress & ratios</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="ICR (current rate)" value={fmtPct(r.icr, 0)} hint="Rent ÷ mortgage interest" />
                <MetricCard
                  label="Stress test @ 5.5%"
                  value={r.stressICR145 ? "Pass 145%" : r.stressICR125 ? "Pass 125%" : "Fail"}
                  hint="Higher-rate threshold: 145%"
                  tone={r.stressICR145 ? "positive" : r.stressICR125 ? "accent" : "negative"}
                />
                <MetricCard label="Break-even rent" value={fmtGBP(r.breakEvenRent)} hint="To cover mortgage + costs" />
                <MetricCard label="Rent / mortgage" value={`${r.rentToMortgage.toFixed(2)}×`} />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Annual summary</h2>
              <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
                <Row label="Gross annual rent" value={fmtGBP(r.annualGrossRent)} />
                <Row label="Less voids" value={`− ${fmtGBP(r.annualGrossRent - r.annualEffectiveRent)}`} />
                <Row label="Effective rent" value={fmtGBP(r.annualEffectiveRent)} />
                <Row label="Operating expenses" value={`− ${fmtGBP(r.annualOpex)}`} />
                <Row label="Net operating income (NOI)" value={fmtGBP(r.annualNOI)} bold />
                <Row label="Mortgage interest" value={`− ${fmtGBP(r.monthlyInterestOnly * 12)}`} />
                <Row label="Pre-tax cashflow (IO)" value={fmtGBP(r.annualCashflowIO)} bold />
                <Row label={`Estimated tax @ ${inputs.taxRate}% (Sec 24)`} value={`− ${fmtGBP(r.taxBill)}`} />
                <Row
                  label="Post-tax cashflow"
                  value={fmtGBP(r.postTaxCashflow)}
                  bold
                  tone={r.postTaxCashflow >= 0 ? "positive" : "negative"}
                />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Capital deployed</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <MetricCard label="Loan amount" value={fmtGBP(r.loanAmount)} hint={`LTV ${fmtPct(r.ltv, 1)}`} />
                <MetricCard label="Total cash in" value={fmtGBP(r.totalCashIn)} hint="Deposit + purchase costs" />
                <MetricCard label="Payback (pre-tax)" value={r.annualCashflowIO > 0 ? `${(r.totalCashIn / r.annualCashflowIO).toFixed(1)} yrs` : "—"} />
              </div>
            </div>

            <p className="pt-4 text-xs text-muted-foreground">
              Estimates only. Stamp duty assumes an additional-dwelling purchase in England.
              Tax uses a simplified Section 24 model (20% interest credit) and your nominal rate.
              Speak to a broker, accountant and solicitor before committing.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

function InputGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: "positive" | "negative";
}) {
  const toneClass =
    tone === "positive" ? "text-primary" : tone === "negative" ? "text-destructive" : "text-foreground";
  return (
    <div className="flex items-center justify-between border-b border-border px-5 py-3 last:border-0">
      <span className={`text-sm ${bold ? "font-semibold" : "text-muted-foreground"}`}>{label}</span>
      <span className={`tabular-nums text-sm ${bold ? "font-semibold" : ""} ${toneClass}`}>{value}</span>
    </div>
  );
}
