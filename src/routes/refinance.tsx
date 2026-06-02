import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { calcStampDuty, fmtGBP, fmtPct } from "@/lib/btl";
import { calculateRefinance, fmtROI, type RefinanceInputs } from "@/lib/refinance";
import { MetricCard } from "@/components/btl/MetricCard";
import { NumberField } from "@/components/btl/NumberField";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/refinance")({
  head: () => ({
    meta: [
      { title: "Refinance / BRRR Calculator — Buy Refurb Refinance Rent" },
      { name: "description", content: "Model the full UK BRRR cycle: total cash in, GDV, cash pulled out on refinance, cash left in the deal and post-refi cashflow." },
      { property: "og:title", content: "Refinance / BRRR Calculator" },
      { property: "og:description", content: "Work out cash recycled, money left in and post-refi yield for any BRRR deal." },
    ],
  }),
  component: RefinancePage,
});

const defaults: RefinanceInputs = {
  purchasePrice: 150000,
  deposit: 37500,
  depositPct: 25,
  depositIsPct: false,
  stampDuty: calcStampDuty(150000),
  legalFees: 1500,
  surveyFees: 500,
  purchaseRate: 6.0,
  refurbCost: 30000,
  refurbMonths: 3,
  holdingMonthly: 300,
  useBridge: false,
  bridgeLoanPct: 75,
  bridgeFundsRefurb: false,
  bridgeRate: 9.6,
  bridgeTermMonths: 6,
  bridgeArrangementPct: 2,
  bridgeExitPct: 1,
  bridgeInterestRolled: true,
  gdv: 220000,
  refiLtv: 75,
  refiRate: 5.5,
  refiTermYears: 25,
  refiFees: 2500,
  monthlyRent: 1300,
  managementPct: 10,
  maintenancePct: 5,
  voidsPct: 4,
  insurance: 25,
  groundRent: 0,
  otherMonthly: 0,
};

function RefinancePage() {
  const [inputs, setInputs] = useState<RefinanceInputs>(defaults);
  const set = <K extends keyof RefinanceInputs>(k: K, v: RefinanceInputs[K]) =>
    setInputs((p) => ({ ...p, [k]: v }));

  const r = useMemo(() => calculateRefinance(inputs), [inputs]);

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

  const verdictTone =
    r.verdict === "full"
      ? "border-primary bg-primary/10 text-primary"
      : r.verdict === "partial"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "border-destructive/40 bg-destructive/10 text-destructive";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              ↻
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Refinance / BRRR Calculator</h1>
              <p className="text-xs text-muted-foreground">Buy · Refurb · Refinance · Rent</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>Reset</Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
          {/* Inputs */}
          <section className="space-y-6">
            <InputGroup title="Purchase">
              <NumberField id="price" label="Purchase price" prefix="£" step={1000}
                value={inputs.purchasePrice} onChange={(v) => set("purchasePrice", v)} />
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
                  />
                </div>
                <div className="flex overflow-hidden rounded-md border border-border">
                  <Button type="button" variant={inputs.depositIsPct ? "ghost" : "secondary"} size="sm" className="rounded-none" onClick={() => setDepositMode(false)}>£</Button>
                  <Button type="button" variant={inputs.depositIsPct ? "secondary" : "ghost"} size="sm" className="rounded-none" onClick={() => setDepositMode(true)}>%</Button>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <NumberField id="stamp" label="Stamp duty" prefix="£"
                    value={inputs.stampDuty} onChange={(v) => set("stampDuty", v)} />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={autoStamp}>Auto</Button>
              </div>
              <NumberField id="legal" label="Legal fees" prefix="£"
                value={inputs.legalFees} onChange={(v) => set("legalFees", v)} />
              <NumberField id="survey" label="Survey / valuation" prefix="£"
                value={inputs.surveyFees} onChange={(v) => set("surveyFees", v)} />
              <NumberField id="prate" label="Purchase mortgage rate (IO)" suffix="%" step={0.1}
                value={inputs.purchaseRate} onChange={(v) => set("purchaseRate", v)} />
            </InputGroup>

            <InputGroup title="Refurb">
              <NumberField id="refurb" label="Refurb cost" prefix="£" step={500}
                value={inputs.refurbCost} onChange={(v) => set("refurbCost", v)} />
              <NumberField id="rmonths" label="Refurb duration" suffix="mo"
                value={inputs.refurbMonths} onChange={(v) => set("refurbMonths", v)} />
              <NumberField id="holding" label="Holding costs / month" prefix="£"
                value={inputs.holdingMonthly} onChange={(v) => set("holdingMonthly", v)}
                hint="Council tax, utilities, insurance during refurb" />
              <NumberField id="brate" label="Bridge / refurb finance rate" suffix="%" step={0.1}
                value={inputs.bridgeRate} onChange={(v) => set("bridgeRate", v)}
                hint="0 = cash funded" />
            </InputGroup>

            <InputGroup title="Refinance">
              <NumberField id="gdv" label="Post-refurb valuation (GDV)" prefix="£" step={1000}
                value={inputs.gdv} onChange={(v) => set("gdv", v)} />
              <NumberField id="rltv" label="Refinance LTV" suffix="%"
                value={inputs.refiLtv} onChange={(v) => set("refiLtv", v)} />
              <NumberField id="rrate" label="Refinance rate" suffix="%" step={0.1}
                value={inputs.refiRate} onChange={(v) => set("refiRate", v)} />
              <NumberField id="rterm" label="Refinance term" suffix="yr"
                value={inputs.refiTermYears} onChange={(v) => set("refiTermYears", v)} />
              <NumberField id="rfees" label="Refinance fees" prefix="£"
                value={inputs.refiFees} onChange={(v) => set("refiFees", v)}
                hint="Arrangement + valuation + legal" />
            </InputGroup>

            <InputGroup title="Rental (post-refi)">
              <NumberField id="rent" label="Monthly rent" prefix="£"
                value={inputs.monthlyRent} onChange={(v) => set("monthlyRent", v)} />
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
          </section>

          {/* Results */}
          <section className="space-y-6">
            <div className={`rounded-xl border p-5 ${verdictTone}`}>
              <div className="text-xs font-medium uppercase tracking-wider opacity-80">BRRR verdict</div>
              <div className="mt-1 text-2xl font-semibold">{r.verdictLabel}</div>
              <div className="mt-1 text-sm opacity-90">
                {fmtPct(Math.max(0, Math.min(100, r.capitalRecycledPct)), 0)} of starting capital recycled · Cash left in {fmtGBP(Math.max(0, r.cashLeftIn))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">The deal</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Total cash in" value={fmtGBP(r.totalCashIn)} hint="Deposit + costs + refurb + holding + interest" />
                <MetricCard label="New loan @ refi" value={fmtGBP(r.newLoan)} hint={`${fmtPct(inputs.refiLtv, 0)} of GDV`} />
                <MetricCard label="Cash released" value={fmtGBP(r.cashReleased)} hint="New loan − purchase loan − refi fees" tone={r.cashReleased >= 0 ? "positive" : "negative"} />
                <MetricCard
                  label="Cash left in deal"
                  value={fmtGBP(Math.max(0, r.cashLeftIn))}
                  hint={r.cashLeftIn <= 0 ? "Full BRRR" : `${fmtPct(r.capitalRecycledPct, 0)} recycled`}
                  tone={r.cashLeftIn <= 0 ? "positive" : "accent"}
                />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Value uplift</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <MetricCard label="Profit on paper" value={fmtGBP(r.profitOnPaper)} hint="GDV − (price + refurb)" tone={r.profitOnPaper >= 0 ? "positive" : "negative"} />
                <MetricCard label="New equity" value={fmtGBP(r.newEquity)} hint="GDV − new loan" />
                <MetricCard label="Money multiple" value={r.totalCashIn > 0 ? `${(inputs.gdv / r.totalCashIn).toFixed(2)}×` : "—"} hint="GDV ÷ total cash in" />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Post-refi monthly cashflow</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Rent" value={fmtGBP(inputs.monthlyRent)} />
                <MetricCard label="Mortgage (IO)" value={fmtGBP(r.monthlyMortgageIO)} hint={`Repayment: ${fmtGBP(r.monthlyMortgageRepay)}`} />
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
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Yields, ROI & lender stress</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Gross yield (on GDV)" value={fmtPct(r.grossYield)} tone="positive" />
                <MetricCard label="Net yield (on GDV)" value={fmtPct(r.netYield)} />
                <MetricCard
                  label="ROI on cash left in"
                  value={fmtROI(r.roiOnCashLeftIn)}
                  hint="Annual cashflow ÷ cash left in"
                  tone="accent"
                />
                <MetricCard
                  label="Stress test @ 5.5%"
                  value={r.stressICR145 ? "Pass 145%" : r.stressICR125 ? "Pass 125%" : "Fail"}
                  hint={`ICR (current): ${fmtPct(r.icr, 0)}`}
                  tone={r.stressICR145 ? "positive" : r.stressICR125 ? "accent" : "negative"}
                />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Deal summary</h2>
              <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
                <Row label="Deposit" value={fmtGBP(r.depositAmount)} />
                <Row label="Purchase loan" value={fmtGBP(r.purchaseLoan)} />
                <Row label="Stamp duty + legal + survey" value={fmtGBP(inputs.stampDuty + inputs.legalFees + inputs.surveyFees)} />
                <Row label="Refurb cost" value={fmtGBP(inputs.refurbCost)} />
                <Row label={`Holding costs (${inputs.refurbMonths} mo)`} value={fmtGBP(r.holdingCostsTotal)} />
                <Row label={`Purchase interest during refurb (${inputs.refurbMonths} mo)`} value={fmtGBP(r.purchaseInterestDuringRefurb)} />
                {inputs.bridgeRate > 0 && (
                  <Row label="Bridge interest during refurb" value={fmtGBP(r.bridgeInterestDuringRefurb)} />
                )}
                <Row label="Total cash in" value={fmtGBP(r.totalCashIn)} bold />
                <Row label="Post-refurb valuation (GDV)" value={fmtGBP(inputs.gdv)} />
                <Row label={`New loan @ ${fmtPct(inputs.refiLtv, 0)} LTV`} value={fmtGBP(r.newLoan)} />
                <Row label="Less: original loan repaid" value={`− ${fmtGBP(r.purchaseLoan)}`} />
                <Row label="Less: refi fees" value={`− ${fmtGBP(inputs.refiFees)}`} />
                <Row label="Cash released on refi" value={fmtGBP(r.cashReleased)} bold tone={r.cashReleased >= 0 ? "positive" : "negative"} />
                <Row label="Cash left in deal" value={fmtGBP(Math.max(0, r.cashLeftIn))} bold tone={r.cashLeftIn <= 0 ? "positive" : undefined} />
                <Row label="Break-even rent" value={fmtGBP(r.breakEvenRent)} />
                <Row label="Annual cashflow (IO)" value={fmtGBP(r.annualCashflowIO)} bold tone={r.annualCashflowIO >= 0 ? "positive" : "negative"} />
              </div>
            </div>

            <p className="pt-4 text-xs text-muted-foreground">
              Estimates only. Holding costs assume the purchase mortgage runs interest-only throughout the refurb. Stress test uses a 5.5% notional refi rate. Speak to a broker, accountant and solicitor before committing.
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
