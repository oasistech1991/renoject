import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { fmtGBP, fmtPct } from "@/lib/btl";
import { calcStampDuty } from "@/lib/btl";
import { calculateRefinance, fmtROI, type RefinanceInputs } from "@/lib/refinance";
import { parsePropertyPdf } from "@/lib/import-deal.functions";

export const Route = createFileRoute("/properties")({
  head: () => ({
    meta: [
      { title: "Saved properties — BRRR deals" },
      { name: "description", content: "All your saved BRRR / refinance deals in one place." },
      { property: "og:title", content: "Saved properties" },
      { property: "og:description", content: "All your saved BRRR / refinance deals." },
    ],
  }),
  component: PropertiesPage,
});

type PropertyRow = {
  id: string;
  name: string;
  inputs: any;
  metrics: any;
  created_at: string;
  updated_at: string;
};

const DEFAULT_INPUTS: RefinanceInputs = {
  purchasePrice: 150000, deposit: 37500, depositPct: 25, depositIsPct: false,
  stampDuty: calcStampDuty(150000), legalFees: 1500, surveyFees: 500, purchaseRate: 6.0,
  fixturesFittings: 0, furnishing: 0, brokerFees: 995, lenderFee: 0,
  additionalFees: 0, auctionFees: 0, sourcingFee: 0,
  refurbCost: 30000, refurbMonths: 3, holdingMonthly: 300,
  useBridge: false, bridgeLoanPct: 75, bridgeFundsRefurb: false,
  bridgeRate: 9.6, bridgeRatePCM: 0.8, bridgeRateIsPCM: true,
  bridgeTermMonths: 6, bridgeArrangementPct: 2, bridgeArrangementIsPct: true,
  bridgeArrangementAmount: 3000, bridgeExitPct: 1, bridgeInterestRolled: true,
  gdv: 220000, refiLtv: 75, refiRate: 5.5, refiTermYears: 25, refiFees: 2500,
  lettableUnits: 1, currentMonthlyRent: 0, monthlyRent: 1300,
  managementPct: 10, maintenancePct: 5, voidsPct: 4,
  insurance: 25, groundRent: 0, otherMonthly: 0,
  flipEnabled: false, flipSalePrice: 0, flipLegalFees: 1500, flipAgencyFee: 0,
};

function mergeDefaults(extracted: Record<string, number | string | boolean>): RefinanceInputs {
  const merged: any = { ...DEFAULT_INPUTS };
  for (const [k, v] of Object.entries(extracted)) {
    if (k === "propertyName") continue;
    if (k in merged) merged[k] = v;
  }
  // If purchase price was extracted but stamp duty wasn't, recompute it.
  if (
    typeof extracted.purchasePrice === "number" &&
    typeof extracted.stampDuty !== "number"
  ) {
    merged.stampDuty = calcStampDuty(extracted.purchasePrice);
  }
  return merged as RefinanceInputs;
}

function snapshotMetrics(r: ReturnType<typeof calculateRefinance>) {
  return {
    cashLeftIn: r.cashLeftIn,
    cashReleased: r.cashReleased,
    newLoan: r.newLoan,
    totalCashIn: r.totalCashIn,
    monthlyCashflowIO: r.monthlyCashflowIO,
    annualCashflowIO: r.annualCashflowIO,
    grossYield: r.grossYield,
    netYield: r.netYield,
    roiOnCashLeftIn: isFinite(r.roiOnCashLeftIn) ? r.roiOnCashLeftIn : null,
    capitalRecycledPct: r.capitalRecycledPct,
    profitOnPaper: r.profitOnPaper,
    verdict: r.verdict,
    verdictLabel: r.verdictLabel,
  };
}

function PropertiesPage() {
  const [rows, setRows] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const parsePdf = useServerFn(parsePropertyPdf);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) setError(error.message);
    else setRows((data as PropertyRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const onPickFile = () => fileRef.current?.click();

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setImportMsg("Please choose a PDF file.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setImportMsg("PDF is too large (max 15 MB).");
      return;
    }
    setImporting(true);
    setImportMsg("Reading PDF and extracting deal details…");
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      const pdfBase64 = btoa(bin);
      const { extracted, warning } = await parsePdf({
        data: { pdfBase64, filename: file.name },
      });
      if (warning) {
        setImportMsg(warning);
        setImporting(false);
        return;
      }
      const inputs = mergeDefaults(extracted);
      const name =
        (typeof extracted.propertyName === "string" && extracted.propertyName.trim()) ||
        file.name.replace(/\.pdf$/i, "");
      const metrics = snapshotMetrics(calculateRefinance(inputs));
      const { data, error } = await supabase
        .from("properties")
        .insert({ name, inputs: inputs as any, metrics: metrics as any })
        .select()
        .single();
      if (error) throw error;
      setImportMsg(null);
      setImporting(false);
      navigate({ to: "/refinance", search: { id: data.id } });
    } catch (err: any) {
      setImporting(false);
      setImportMsg(err?.message ?? "Failed to import PDF.");
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    setRows((p) => p.filter((r) => r.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-lg font-semibold leading-tight">Saved properties</h1>
            <p className="text-xs text-muted-foreground">All your BRRR / refinance deals</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={onFileChosen}
            />
            <Button size="sm" variant="outline" onClick={onPickFile} disabled={importing}>
              {importing ? "Importing…" : "Import from PDF"}
            </Button>
            <Link to="/refinance">
              <Button size="sm">+ New property</Button>
            </Link>
          </div>
        </div>
        {importMsg && (
          <div className="mx-auto max-w-7xl px-6 pb-4 text-xs text-muted-foreground">{importMsg}</div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <h2 className="text-base font-semibold">No saved properties yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Open the calculator, name a deal and hit Save.
            </p>
            <div className="mt-4">
              <Link to="/refinance">
                <Button>Open calculator</Button>
              </Link>
            </div>
          </div>
        )}
        {!loading && rows.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((r) => {
              const m = r.metrics ?? {};
              const verdict: string = m.verdictLabel ?? "—";
              const verdictTone =
                m.verdict === "full"
                  ? "bg-primary/10 text-primary border-primary/30"
                  : m.verdict === "partial"
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400"
                    : "bg-destructive/10 text-destructive border-destructive/30";
              return (
                <div key={r.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold">{r.name}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Updated {new Date(r.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${verdictTone}`}>
                      {verdict}
                    </span>
                  </div>
                   <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">GDV</dt>
                    <dd className="text-right tabular-nums">{fmtGBP(r.inputs?.gdv ?? 0)}</dd>
                    <dt className="text-muted-foreground">Cash required</dt>
                    <dd className="text-right tabular-nums">{fmtGBP(m.totalCashIn ?? 0)}</dd>
                    <dt className="text-muted-foreground">Cash left in</dt>
                    <dd className="text-right tabular-nums">{fmtGBP(Math.max(0, m.cashLeftIn ?? 0))}</dd>
                    <dt className="text-muted-foreground">Cash released</dt>
                    <dd className="text-right tabular-nums">{fmtGBP(m.cashReleased ?? 0)}</dd>
                    <dt className="text-muted-foreground">Gross yield</dt>
                    <dd className="text-right tabular-nums">{fmtPct(m.grossYield ?? 0)}</dd>
                    <dt className="text-muted-foreground">Monthly cashflow</dt>
                    <dd className="text-right tabular-nums">{fmtGBP(m.monthlyCashflowIO ?? 0)}</dd>
                    <dt className="text-muted-foreground">ROI on cash left in</dt>
                    <dd className="text-right tabular-nums">{fmtROI(m.roiOnCashLeftIn ?? 0)}</dd>
                  </dl>
                  <div className="mt-4 flex gap-2">
                    <Link to="/refinance" search={{ id: r.id }} className="flex-1">
                      <Button size="sm" className="w-full">Open</Button>
                    </Link>
                    <Button size="sm" variant="outline" onClick={() => remove(r.id, r.name)}>Delete</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}