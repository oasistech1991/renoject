import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { fmtGBP, fmtPct } from "@/lib/btl";
import { calcStampDuty } from "@/lib/btl";
import { calculateRefinance, fmtROI, type RefinanceInputs } from "@/lib/refinance";
import { parsePropertyPdf } from "@/lib/import-deal.functions";
import { PROPERTY_SOURCES, sourceBadgeClass, sourceLabel, type PropertySource } from "@/lib/sources";
import { useSourceColors, badgeStyleFromHex } from "@/lib/source-colors";

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
  source: string | null;
  in_portfolio?: boolean | null;
  created_at: string;
  updated_at: string;
};

type HmoAnalysisRow = {
  id: string;
  property_id: string | null;
  label: string;
  location: string | null;
  result: any;
  thumbnail: string | null;
  created_at: string;
};

// Infer the purchase method for legacy deals that didn't persist `method`.
// Heuristics on the inputs: BRRR uplifts GDV above purchase and/or has refurb;
// cash purchases zero out the deposit/rate; BTL has no GDV uplift or refurb.
function inferMethod(metrics: any, inputs: any): "btl" | "brrr" | "cash" | "mortgage" {
  if (metrics?.method) return metrics.method;
  const purchasePrice = Number(inputs?.purchasePrice ?? 0);
  const gdv = Number(inputs?.gdv ?? 0);
  const refurbCost = Number(inputs?.refurbCost ?? 0);
  const useBridge = !!inputs?.useBridge;
  const hasBtlBlob = !!inputs?.__btl;
  if (hasBtlBlob) return "btl";
  if (useBridge || refurbCost > 0 || (gdv > 0 && gdv > purchasePrice)) return "brrr";
  const deposit = Number(inputs?.deposit ?? 0);
  const depositPct = Number(inputs?.depositPct ?? 0);
  if (deposit === 0 && depositPct === 0) return "cash";
  return "btl";
}

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
  const [filter, setFilter] = useState<"all" | PropertySource | "none">("all");
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const parsePdf = useServerFn(parsePropertyPdf);
  const { colorFor, setColor } = useSourceColors();
  const [heroUrls, setHeroUrls] = useState<Record<string, string>>({});
  const [analyses, setAnalyses] = useState<HmoAnalysisRow[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) setError(error.message);
    else setRows((data as PropertyRow[]) ?? []);
    setLoading(false);
    // Load hero banners (one signed url per property if marked)
    const { data: media } = await supabase
      .from("property_media")
      .select("property_id, storage_path")
      .eq("is_hero", true)
      .eq("kind", "image");
    const map: Record<string, string> = {};
    await Promise.all(
      ((media as { property_id: string; storage_path: string }[]) ?? []).map(async (m) => {
        const { data: s } = await supabase.storage
          .from("property-media")
          .createSignedUrl(m.storage_path, 60 * 60);
        if (s?.signedUrl) map[m.property_id] = s.signedUrl;
      })
    );
    setHeroUrls(map);
    // Load HMO analyses (both attached and unattached)
    const { data: a } = await supabase
      .from("hmo_analyses")
      .select("id,property_id,label,location,result,thumbnail,created_at")
      .order("created_at", { ascending: false });
    setAnalyses((a as HmoAnalysisRow[]) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const refreshAnalyses = async () => {
    const { data: a } = await supabase
      .from("hmo_analyses")
      .select("id,property_id,label,location,result,thumbnail,created_at")
      .order("created_at", { ascending: false });
    setAnalyses((a as HmoAnalysisRow[]) ?? []);
  };

  const attachAnalysis = async (analysisId: string, propertyId: string) => {
    if (!propertyId) return;
    const { error } = await supabase
      .from("hmo_analyses")
      .update({ property_id: propertyId } as any)
      .eq("id", analysisId);
    if (error) alert(error.message);
    else refreshAnalyses();
  };

  const detachAnalysis = async (analysisId: string) => {
    const { error } = await supabase
      .from("hmo_analyses")
      .update({ property_id: null } as any)
      .eq("id", analysisId);
    if (error) alert(error.message);
    else refreshAnalyses();
  };

  const deleteAnalysis = async (analysisId: string, label: string) => {
    if (!confirm(`Delete analysis "${label}"? This can't be undone.`)) return;
    const { error } = await supabase.from("hmo_analyses").delete().eq("id", analysisId);
    if (error) alert(error.message);
    else refreshAnalyses();
  };

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
        .insert({ name, inputs: inputs as any, metrics: metrics as any, source: null } as any)
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

  const togglePortfolio = async (id: string, next: boolean) => {
    setRows((p) => p.map((r) => (r.id === id ? { ...r, in_portfolio: next } : r)));
    const { error } = await supabase
      .from("properties")
      .update({ in_portfolio: next } as any)
      .eq("id", id);
    if (error) {
      alert(error.message);
      setRows((p) => p.map((r) => (r.id === id ? { ...r, in_portfolio: !next } : r)));
    }
  };

  const visibleRows = rows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "none") return !r.source;
    return r.source === filter;
  });
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    const k = r.source ?? "none";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

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
            <Link to="/forecast">
              <Button size="sm" variant="outline">Portfolio forecast</Button>
            </Link>
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
        {(() => {
          const unattached = analyses.filter((a) => !a.property_id);
          if (unattached.length === 0) return null;
          return (
            <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
              <h2 className="text-sm font-semibold text-foreground">
                Unattached HMO analyses ({unattached.length})
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                These were saved without a property. Attach each one to an existing deal below.
              </p>
              <ul className="mt-3 space-y-2">
                {unattached.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                  >
                    {a.thumbnail && (
                      <img
                        src={a.thumbnail}
                        alt=""
                        className="h-12 w-16 rounded object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {a.result?.verdict ?? "—"} · {a.result?.maxCompliantBedrooms ?? "—"} beds ·{" "}
                        {new Date(a.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <select
                      defaultValue=""
                      onChange={(e) => attachAnalysis(a.id, e.target.value)}
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                    >
                      <option value="">Attach to…</option>
                      {rows.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <Link to="/hmo-compliance" search={{ analysis: a.id } as any}>
                      <Button size="sm" variant="outline">
                        View
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteAnalysis(a.id, a.label)}
                    >
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}
        {!loading && rows.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
              All <span className="ml-1 opacity-60">{rows.length}</span>
            </FilterPill>
            {PROPERTY_SOURCES.map((s) => {
              const n = counts[s.value] ?? 0;
              if (n === 0) return null;
              const hex = colorFor(s.value);
              return (
                <div key={s.value} className="inline-flex items-center gap-1">
                  <FilterPill
                    active={filter === s.value}
                    onClick={() => setFilter(s.value)}
                    className={hex ? "" : sourceBadgeClass(s.value)}
                    style={filter === s.value ? undefined : badgeStyleFromHex(hex)}
                  >
                    {s.label} <span className="ml-1 opacity-60">{n}</span>
                  </FilterPill>
                  <label
                    title={`Change ${s.label} colour`}
                    className="relative inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-border"
                    style={{ backgroundColor: hex ?? "transparent" }}
                  >
                    <input
                      type="color"
                      value={hex ?? "#888888"}
                      onChange={(e) => setColor(s.value, e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>
              );
            })}
            {(counts["none"] ?? 0) > 0 && (
              <FilterPill active={filter === "none"} onClick={() => setFilter("none")}>
                Unspecified <span className="ml-1 opacity-60">{counts["none"]}</span>
              </FilterPill>
            )}
          </div>
        )}
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
        {!loading && visibleRows.length > 0 && (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(() => {
                const totals = visibleRows.reduce(
                  (acc, r) => {
                    const m = r.metrics ?? {};
                    acc.monthly += Number(m.monthlyCashflowIO ?? 0);
                    acc.annual += Number(m.annualCashflowIO ?? 0);
                    return acc;
                  },
                  { monthly: 0, annual: 0 },
                );
                return (
                  <>
                    <SummaryCard label="Total monthly cashflow" value={fmtGBP(totals.monthly)} tone={totals.monthly >= 0 ? "positive" : "negative"} />
                    <SummaryCard label="Total annual cashflow" value={fmtGBP(totals.annual)} tone={totals.annual >= 0 ? "positive" : "negative"} />
                  </>
                );
              })()}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleRows.map((r) => {
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
                  {heroUrls[r.id] && (
                    <div
                      className="-mx-5 -mt-5 mb-4 h-32 rounded-t-xl bg-cover bg-center"
                      style={{ backgroundImage: `url(${heroUrls[r.id]})` }}
                    />
                  )}
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
                  <div className="mt-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                    {(() => {
                      const hex = colorFor(r.source);
                      return (
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${hex ? "" : sourceBadgeClass(r.source)}`}
                          style={badgeStyleFromHex(hex)}
                        >
                          {sourceLabel(r.source)}
                        </span>
                      );
                    })()}
                    {(() => {
                      const method: string = inferMethod(m, r.inputs);
                      const label = method === "btl" ? "BTL"
                        : method === "cash" ? "Cash"
                        : method === "mortgage" ? "Mortgage"
                        : "BRRR";
                      return (
                        <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {label}
                        </span>
                      );
                    })()}
                    </div>
                  </div>
                   <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
                    {(() => {
                      const method: string = inferMethod(m, r.inputs);
                      const purchasePrice = m.purchasePrice ?? r.inputs?.purchasePrice ?? 0;
                      if (method === "btl") {
                        return (
                          <>
                            <dt className="text-muted-foreground">Purchase price</dt>
                            <dd className="text-right tabular-nums">{fmtGBP(purchasePrice)}</dd>
                            <dt className="text-muted-foreground">Cash in</dt>
                            <dd className="text-right tabular-nums">{fmtGBP(m.totalCashIn ?? 0)}</dd>
                            <dt className="text-muted-foreground">Monthly cashflow</dt>
                            <dd className="text-right tabular-nums">{fmtGBP(m.monthlyCashflowIO ?? 0)}</dd>
                            <dt className="text-muted-foreground">Gross yield</dt>
                            <dd className="text-right tabular-nums">{fmtPct(m.grossYield ?? 0)}</dd>
                            <dt className="text-muted-foreground">Net yield</dt>
                            <dd className="text-right tabular-nums">{fmtPct(m.netYield ?? 0)}</dd>
                            <dt className="text-muted-foreground">ROI</dt>
                            <dd className="text-right tabular-nums">{fmtPct(m.roiIO ?? 0)}</dd>
                            <dt className="text-muted-foreground">ICR</dt>
                            <dd className="text-right tabular-nums">{fmtPct(m.icr ?? 0, 0)}</dd>
                          </>
                        );
                      }
                      if (method === "cash") {
                        return (
                          <>
                            <dt className="text-muted-foreground">Purchase price</dt>
                            <dd className="text-right tabular-nums">{fmtGBP(purchasePrice)}</dd>
                            <dt className="text-muted-foreground">Cash in</dt>
                            <dd className="text-right tabular-nums">{fmtGBP(m.totalCashIn ?? 0)}</dd>
                            <dt className="text-muted-foreground">Monthly cashflow</dt>
                            <dd className="text-right tabular-nums">{fmtGBP(m.monthlyCashflowIO ?? 0)}</dd>
                            <dt className="text-muted-foreground">Gross yield</dt>
                            <dd className="text-right tabular-nums">{fmtPct(m.grossYield ?? 0)}</dd>
                            <dt className="text-muted-foreground">Net yield</dt>
                            <dd className="text-right tabular-nums">{fmtPct(m.netYield ?? 0)}</dd>
                            <dt className="text-muted-foreground">ROI on cash</dt>
                            <dd className="text-right tabular-nums">{fmtROI(m.roiIO ?? m.roiOnCashLeftIn ?? 0)}</dd>
                          </>
                        );
                      }
                      if (method === "mortgage") {
                        return (
                          <>
                            <dt className="text-muted-foreground">Purchase price</dt>
                            <dd className="text-right tabular-nums">{fmtGBP(purchasePrice)}</dd>
                            <dt className="text-muted-foreground">Cash in</dt>
                            <dd className="text-right tabular-nums">{fmtGBP(m.totalCashIn ?? 0)}</dd>
                            <dt className="text-muted-foreground">Monthly cashflow</dt>
                            <dd className="text-right tabular-nums">{fmtGBP(m.monthlyCashflowIO ?? 0)}</dd>
                            <dt className="text-muted-foreground">Gross yield</dt>
                            <dd className="text-right tabular-nums">{fmtPct(m.grossYield ?? 0)}</dd>
                            <dt className="text-muted-foreground">ROI</dt>
                            <dd className="text-right tabular-nums">{fmtROI(m.roiIO ?? m.roiOnCashLeftIn ?? 0)}</dd>
                            <dt className="text-muted-foreground">ICR</dt>
                            <dd className="text-right tabular-nums">{fmtPct(m.icr ?? 0, 0)}</dd>
                          </>
                        );
                      }
                      return (
                        <>
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
                        </>
                      );
                    })()}
                  </dl>
                  <div className="mt-4 flex gap-2">
                    <Link to="/refinance" search={{ id: r.id }} className="flex-1">
                      <Button size="sm" className="w-full">Open</Button>
                    </Link>
                    <Button size="sm" variant="outline" onClick={() => remove(r.id, r.name)}>Delete</Button>
                  </div>
                  {(() => {
                    const attached = analyses.filter((a) => a.property_id === r.id);
                    if (attached.length === 0) return null;
                    const isOpen = !!expanded[r.id];
                    return (
                      <div className="mt-3 rounded-md border border-border bg-background/40">
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((p) => ({ ...p, [r.id]: !p[r.id] }))
                          }
                          className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium"
                        >
                          <span>HMO analyses ({attached.length})</span>
                          <span className="text-muted-foreground">{isOpen ? "▲" : "▼"}</span>
                        </button>
                        {isOpen && (
                          <ul className="space-y-1.5 border-t border-border px-3 py-2">
                            {attached.map((a) => (
                              <li
                                key={a.id}
                                className="flex items-center gap-2 text-xs"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium">{a.label}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {a.result?.verdict ?? "—"} ·{" "}
                                    {a.result?.maxCompliantBedrooms ?? "—"} beds ·{" "}
                                    {new Date(a.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                                <Link
                                  to="/hmo-compliance"
                                  search={{ analysis: a.id } as any}
                                >
                                  <Button size="sm" variant="outline">
                                    View
                                  </Button>
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => detachAnalysis(a.id)}
                                  className="rounded border border-border px-2 py-1 text-[10px] hover:bg-accent"
                                >
                                  Detach
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteAnalysis(a.id, a.label)}
                                  className="rounded border border-border px-2 py-1 text-[10px] hover:bg-destructive/10 hover:text-destructive"
                                >
                                  ✕
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })()}
                  <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-xs font-medium select-none">
                    <input
                      type="checkbox"
                      checked={!!r.in_portfolio}
                      onChange={(e) => togglePortfolio(r.id, e.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span>{r.in_portfolio ? "In portfolio forecast" : "Add to portfolio forecast"}</span>
                  </label>
                </div>
              );
            })}
          </div>
          </>
        )}
        {!loading && rows.length > 0 && visibleRows.length === 0 && (
          <p className="text-sm text-muted-foreground">No deals match this filter.</p>
        )}
      </main>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  className = "",
  style,
  children,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-foreground bg-foreground text-background"
          : `hover:bg-accent ${className || "border-border bg-card text-foreground"}`
      }`}
    >
      {children}
    </button>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  const toneClass =
    tone === "positive" ? "text-primary" : tone === "negative" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}