import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { fmtGBP, fmtPct } from "@/lib/btl";
import { sourceLabel } from "@/lib/sources";
import { lazy, Suspense } from "react";

const DealsChart = lazy(() =>
  import("@/components/forecast/ForecastCharts").then((m) => ({ default: m.DealsChart })),
);
const CumulativeChart = lazy(() =>
  import("@/components/forecast/ForecastCharts").then((m) => ({ default: m.CumulativeChart })),
);

export const Route = createFileRoute("/forecast")({
  head: () => ({
    meta: [
      { title: "Portfolio forecast — BRRR deals" },
      { name: "description", content: "Aggregate forecast of deals you've added to your portfolio." },
      { property: "og:url", content: "https://renojectholdings.com/forecast" },
    ],
    links: [
      { rel: "canonical", href: "https://renojectholdings.com/forecast" },
    ],
  }),
  component: ForecastPage,
});

type Row = {
  id: string;
  name: string;
  inputs: any;
  metrics: any;
  source: string | null;
  in_portfolio: boolean | null;
  updated_at: string;
};

function ForecastPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [defaultRefurb, setDefaultRefurb] = useState(4);
  const [defaultVoidToLet, setDefaultVoidToLet] = useState(2);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("in_portfolio", true)
      .order("updated_at", { ascending: false });
    if (error) setError(error.message);
    else setRows((data as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (id: string) => {
    setRows((p) => p.filter((r) => r.id !== id));
    await supabase.from("properties").update({ in_portfolio: false } as any).eq("id", id);
  };

  const duplicate = async (r: Row) => {
    const newName = `${r.name} (copy)`;
    const { data, error } = await supabase
      .from("properties")
      .insert({
        name: newName,
        inputs: r.inputs,
        metrics: r.metrics,
        source: r.source,
        in_portfolio: true,
      } as any)
      .select("*")
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    setRows((p) => [data as Row, ...p]);
  };

  const totals = rows.reduce(
    (acc, r) => {
      const m = r.metrics ?? {};
      const i = r.inputs ?? {};
      acc.gdv += Number(i.gdv ?? 0);
      acc.purchase += Number(i.purchasePrice ?? 0);
      acc.totalCashIn += Number(m.totalCashIn ?? 0);
      acc.cashLeftIn += Math.max(0, Number(m.cashLeftIn ?? 0));
      acc.cashReleased += Number(m.cashReleased ?? 0);
      acc.newLoan += Number(m.newLoan ?? 0);
      acc.monthlyCashflow += Number(m.monthlyCashflowIO ?? 0);
      acc.annualCashflow += Number(m.annualCashflowIO ?? 0);
      acc.profitOnPaper += Number(m.profitOnPaper ?? 0);
      acc.monthlyRent += Number(i.monthlyRent ?? 0);
      return acc;
    },
    {
      gdv: 0, purchase: 0, totalCashIn: 0, cashLeftIn: 0, cashReleased: 0,
      newLoan: 0, monthlyCashflow: 0, annualCashflow: 0, profitOnPaper: 0, monthlyRent: 0,
    },
  );

  const portfolioROI = totals.cashLeftIn > 0 ? (totals.annualCashflow / totals.cashLeftIn) * 100 : null;
  const portfolioYield = totals.gdv > 0 ? ((totals.monthlyRent * 12) / totals.gdv) * 100 : 0;

  const dealOffsets = rows.map((r) => {
    const i = r.inputs ?? {};
    const m = r.metrics ?? {};
    const refurb = Number(i.refurbMonths ?? defaultRefurb);
    const voidToLet = Number(i.voidToLetMonths ?? defaultVoidToLet);
    const startMonth = refurb + voidToLet + 1;
    return {
      id: r.id,
      refurb,
      voidToLet,
      startMonth,
      monthly: Number(m.monthlyCashflowIO ?? 0),
      rent: Number(i.monthlyRent ?? 0),
    };
  });

  const perDeal = rows.map((r) => {
    const m = r.metrics ?? {};
    const i = r.inputs ?? {};
    const monthly = Number(m.monthlyCashflowIO ?? 0);
    const annual = Number(m.annualCashflowIO ?? (monthly * 12));
    const rent = Number(i.monthlyRent ?? 0);
    return {
      name: r.name.length > 14 ? r.name.slice(0, 14) + "…" : r.name,
      monthly,
      annual,
      rent,
    };
  });

  const cumulative: { month: string; cashflow: number; rent: number }[] = [];
  let runCF = 0;
  let runRent = 0;
  for (let mIdx = 1; mIdx <= 24; mIdx++) {
    for (const d of dealOffsets) {
      if (mIdx >= d.startMonth) {
        runCF += d.monthly;
        runRent += d.rent;
      }
    }
    cumulative.push({ month: `M${mIdx}`, cashflow: Math.round(runCF), rent: Math.round(runRent) });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-lg font-semibold leading-tight">Portfolio forecast</h1>
            <p className="text-xs text-muted-foreground">
              Totals across {rows.length} deal{rows.length === 1 ? "" : "s"} you've added to your portfolio
            </p>
          </div>
          <Link to="/properties">
            <Button size="sm" variant="outline">Manage properties</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && rows.length === 0 && !error && (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <h2 className="text-base font-semibold">No deals in your portfolio yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Go to Properties and tick "Add to portfolio forecast" on the deals you want to include.
            </p>
            <div className="mt-4">
              <Link to="/properties"><Button>Open properties</Button></Link>
            </div>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Total GDV" value={fmtGBP(totals.gdv)} />
              <Stat label="Total cash required" value={fmtGBP(totals.totalCashIn)} />
              <Stat label="Cash left in" value={fmtGBP(totals.cashLeftIn)} />
              <Stat label="Cash released at refi" value={fmtGBP(totals.cashReleased)} tone="positive" />
              <Stat label="New mortgage debt" value={fmtGBP(totals.newLoan)} />
              <Stat label="Monthly cashflow" value={fmtGBP(totals.monthlyCashflow)} tone={totals.monthlyCashflow >= 0 ? "positive" : "negative"} />
              <Stat label="Annual cashflow" value={fmtGBP(totals.annualCashflow)} tone={totals.annualCashflow >= 0 ? "positive" : "negative"} />
              <Stat label="Profit on paper" value={fmtGBP(totals.profitOnPaper)} tone={totals.profitOnPaper >= 0 ? "positive" : "negative"} />
              <Stat label="Portfolio gross yield" value={fmtPct(portfolioYield)} />
              <Stat label="ROI on cash left in" value={portfolioROI === null ? "∞" : fmtPct(portfolioROI)} tone="positive" />
              <Stat label="Total monthly rent" value={fmtGBP(totals.monthlyRent)} />
              <Stat label="Total purchase price" value={fmtGBP(totals.purchase)} />
            </div>

            <div className="mt-6 rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <h3 className="text-sm font-semibold">Rent-start defaults</h3>
                  <p className="text-xs text-muted-foreground">
                    Applied to any deal that doesn't set its own refurb / time-to-let.
                  </p>
                </div>
                <label className="flex flex-col text-xs text-muted-foreground">
                  Refurb (months)
                  <input
                    type="number"
                    min={0}
                    value={defaultRefurb}
                    onChange={(e) => setDefaultRefurb(Math.max(0, Number(e.target.value) || 0))}
                    className="mt-1 w-24 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                  />
                </label>
                <label className="flex flex-col text-xs text-muted-foreground">
                  Time to let (months)
                  <input
                    type="number"
                    min={0}
                    value={defaultVoidToLet}
                    onChange={(e) => setDefaultVoidToLet(Math.max(0, Number(e.target.value) || 0))}
                    className="mt-1 w-24 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                  />
                </label>
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Cashflow per deal"
                subtitle="Monthly vs annual net cashflow (interest-only)"
              >
                <ClientOnly fallback={<div className="h-[300px]" />}>
                  <Suspense fallback={<div className="h-[300px]" />}>
                    <DealsChart data={perDeal} />
                  </Suspense>
                </ClientOnly>
              </ChartCard>

              <ChartCard
                title="Cumulative income — next 24 months"
                subtitle="Phased by refurb + time-to-let per deal"
              >
                <ClientOnly fallback={<div className="h-[300px]" />}>
                  <Suspense fallback={<div className="h-[300px]" />}>
                    <CumulativeChart data={cumulative} />
                  </Suspense>
                </ClientOnly>
              </ChartCard>
            </div>

            <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Deal</th>
                    <th className="px-4 py-3 text-left font-medium">Source</th>
                    <th className="px-4 py-3 text-right font-medium">GDV</th>
                    <th className="px-4 py-3 text-right font-medium">Cash left in</th>
                    <th className="px-4 py-3 text-right font-medium">Monthly CF</th>
                    <th className="px-4 py-3 text-right font-medium">Annual CF</th>
                    <th className="px-4 py-3 text-right font-medium">Profit on paper</th>
                    <th className="px-4 py-3 text-right font-medium">Rent starts</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const m = r.metrics ?? {};
                    const i = r.inputs ?? {};
                    const off = dealOffsets.find((d) => d.id === r.id);
                    return (
                      <tr key={r.id} className="border-t border-border">
                        <td className="px-4 py-3">
                          <Link to="/refinance" search={{ id: r.id }} className="font-medium hover:underline">
                            {r.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{sourceLabel(r.source)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmtGBP(i.gdv ?? 0)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmtGBP(Math.max(0, m.cashLeftIn ?? 0))}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmtGBP(m.monthlyCashflowIO ?? 0)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmtGBP(m.annualCashflowIO ?? 0)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmtGBP(m.profitOnPaper ?? 0)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {off ? `M${off.startMonth}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => duplicate(r)}>Duplicate</Button>
                            <Button size="sm" variant="ghost" onClick={() => toggle(r.id)}>Remove</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "positive" | "negative" }) {
  const toneCls =
    tone === "positive" ? "text-primary" : tone === "negative" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}