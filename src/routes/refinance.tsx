import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { calcStampDuty, fmtGBP, fmtPct } from "@/lib/btl";
import { calculateRefinance, fmtROI, type RefinanceInputs } from "@/lib/refinance";
import { MetricCard } from "@/components/btl/MetricCard";
import { NumberField } from "@/components/btl/NumberField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { PROPERTY_SOURCES, type PropertySource } from "@/lib/sources";
import { PropertyMedia } from "@/components/property/PropertyMedia";

export const Route = createFileRoute("/refinance")({
  validateSearch: (s: Record<string, unknown>) => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "BRRR Calculator — Buy Refurb Refinance Rent" },
      { name: "description", content: "Model the full UK BRRR cycle: total cash in, GDV, cash pulled out on refinance, cash left in the deal and post-refi cashflow." },
      { property: "og:title", content: "BRRR Calculator" },
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
  fixturesFittings: 0,
  furnishing: 0,
  brokerFees: 995,
  lenderFee: 0,
  additionalFees: 0,
  auctionFees: 0,
  sourcingFee: 0,
  refurbCost: 30000,
  refurbMonths: 3,
  holdingMonthly: 300,
  useBridge: false,
  bridgeLoanPct: 75,
  bridgeFundsRefurb: false,
  bridgeRate: 9.6,
  bridgeRatePCM: 0.8,
  bridgeRateIsPCM: true,
  bridgeTermMonths: 6,
  bridgeArrangementPct: 2,
  bridgeArrangementIsPct: true,
  bridgeArrangementAmount: 3000,
  bridgeExitPct: 1,
  bridgeInterestRolled: true,
  gdv: 220000,
  refiLtv: 75,
  refiRate: 5.5,
  refiTermYears: 25,
  refiFees: 2500,
  lettableUnits: 1,
  currentMonthlyRent: 0,
  monthlyRent: 1300,
  managementPct: 10,
  maintenancePct: 5,
  voidsPct: 4,
  insurance: 25,
  groundRent: 0,
  otherMonthly: 0,
  flipEnabled: false,
  flipSalePrice: 0,
  flipLegalFees: 1500,
  flipAgencyFee: 0,
};

type CalcMethod = "mortgage" | "cash" | "bridge" | "brrr";

function RefinancePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [inputs, setInputs] = useState<RefinanceInputs>(defaults);
  const [method, setMethod] = useState<CalcMethod>("brrr");
  const [propertyName, setPropertyName] = useState("");
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [source, setSource] = useState<PropertySource | "">("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const set = <K extends keyof RefinanceInputs>(k: K, v: RefinanceInputs[K]) =>
    setInputs((p) => ({ ...p, [k]: v }));

  const effectiveInputs = useMemo<RefinanceInputs>(() => {
    if (method === "cash") {
      return {
        ...inputs,
        depositIsPct: true,
        depositPct: 100,
        deposit: inputs.purchasePrice,
        purchaseRate: 0,
        useBridge: false,
        refurbCost: 0,
        refurbMonths: 0,
        gdv: inputs.purchasePrice,
        refiLtv: 0,
        refiFees: 0,
      };
    }
    if (method === "mortgage") {
      return {
        ...inputs,
        useBridge: false,
        refurbCost: 0,
        refurbMonths: 0,
        holdingMonthly: 0,
        gdv: inputs.purchasePrice,
        refiLtv: 0,
        refiFees: 0,
      };
    }
    if (method === "bridge") {
      return {
        ...inputs,
        useBridge: true,
        gdv: inputs.purchasePrice,
        refiLtv: 0,
        refiFees: 0,
      };
    }
    return inputs;
  }, [inputs, method]);

  const r = useMemo(() => calculateRefinance(effectiveInputs), [effectiveInputs]);

  const autoStamp = () => set("stampDuty", calcStampDuty(inputs.purchasePrice));
  const reset = () => {
    setInputs(defaults);
    setPropertyName("");
    setPropertyId(null);
    setSource("");
    setSavedAt(null);
    navigate({ search: { id: undefined }, replace: true });
  };

  // Load a saved property when ?id= is present
  useEffect(() => {
    const id = search.id;
    if (!id || id === propertyId) return;
    let cancelled = false;
    (async () => {
      setLoadError(null);
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        return;
      }
      if (!data) {
        setLoadError("Property not found");
        return;
      }
      setInputs({ ...defaults, ...(data.inputs as unknown as RefinanceInputs) });
      setPropertyName(data.name);
      setPropertyId(data.id);
      setSource(((data as any).source as PropertySource) ?? "");
      setSavedAt(new Date(data.updated_at));
    })();
    return () => {
      cancelled = true;
    };
  }, [search.id]);

  const metricsSnapshot = () => ({
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
  });

  const doSave = async (forceNew = false) => {
    if (!propertyName.trim()) {
      alert("Give the property a name first.");
      return;
    }
    setSaving(true);
    const payload = {
      name: propertyName.trim(),
      inputs: inputs as any,
      metrics: metricsSnapshot() as any,
      source: source || null,
    } as any;
    if (propertyId && !forceNew) {
      const { error } = await supabase
        .from("properties")
        .update(payload)
        .eq("id", propertyId);
      setSaving(false);
      if (error) {
        alert(error.message);
        return;
      }
      setSavedAt(new Date());
    } else {
      const { data, error } = await supabase
        .from("properties")
        .insert(payload)
        .select()
        .single();
      setSaving(false);
      if (error) {
        alert(error.message);
        return;
      }
      setPropertyId(data.id);
      setSavedAt(new Date());
      navigate({ search: { id: data.id }, replace: true });
    }
  };

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
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                ↻
              </div>
              <div>
                <h1 className="text-lg font-semibold leading-tight">Property Calculator</h1>
                <p className="text-xs text-muted-foreground">
                  {method === "mortgage" && "Standard BTL mortgage"}
                  {method === "cash" && "Cash purchase"}
                  {method === "bridge" && "Bridge + Refurb"}
                  {method === "brrr" && "Buy · Refurb · Refinance · Rent"}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={reset}>New / Reset</Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="propname" className="mb-1 block text-xs font-medium text-muted-foreground">
                Property name
              </label>
              <Input
                id="propname"
                placeholder="e.g. 12 High Street, Leeds"
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
              />
            </div>
            <div className="sm:w-56">
              <label htmlFor="propsource" className="mb-1 block text-xs font-medium text-muted-foreground">
                Deal source
              </label>
              <select
                id="propsource"
                value={source}
                onChange={(e) => setSource(e.target.value as PropertySource | "")}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Unspecified</option>
                {PROPERTY_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => doSave(false)} disabled={saving}>
                {saving ? "Saving…" : propertyId ? "Save" : "Save deal"}
              </Button>
              {propertyId && (
                <Button size="sm" variant="outline" onClick={() => doSave(true)} disabled={saving}>
                  Save as new
                </Button>
              )}
            </div>
          </div>
          {(savedAt || loadError) && (
            <p className={`text-xs ${loadError ? "text-destructive" : "text-muted-foreground"}`}>
              {loadError
                ? loadError
                : `Last saved ${savedAt?.toLocaleTimeString()}${propertyId ? " · syncing changes will update this deal" : ""}`}
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {propertyId && (
          <div className="mb-8">
            <PropertyMedia propertyId={propertyId} />
          </div>
        )}
        <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
          {/* Inputs */}
          <section className="space-y-6">
            <InputGroup title="Purchase method">
              <div className="grid grid-cols-2 gap-0 overflow-hidden rounded-md border border-border sm:grid-cols-4">
                {([
                  ["mortgage", "Mortgage"],
                  ["cash", "Cash"],
                  ["bridge", "Bridge + Refurb"],
                  ["brrr", "BRRR"],
                ] as const).map(([key, label]) => (
                  <Button
                    key={key}
                    type="button"
                    variant={method === key ? "secondary" : "ghost"}
                    size="sm"
                    className="rounded-none"
                    onClick={() => setMethod(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </InputGroup>

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

            {method !== "cash" && (
            <InputGroup title="Additional acquisition costs">
              <NumberField id="ff" label="Fixtures & fittings" prefix="£"
                value={inputs.fixturesFittings} onChange={(v) => set("fixturesFittings", v)} />
              <NumberField id="furn" label="Furnishing" prefix="£"
                value={inputs.furnishing} onChange={(v) => set("furnishing", v)} />
              <NumberField id="broker" label="Broker fees" prefix="£"
                value={inputs.brokerFees} onChange={(v) => set("brokerFees", v)} />
              <NumberField id="lender" label="Lender fee" prefix="£"
                value={inputs.lenderFee} onChange={(v) => set("lenderFee", v)} />
              <NumberField id="addfees" label="Additional fees" prefix="£"
                value={inputs.additionalFees} onChange={(v) => set("additionalFees", v)} />
              <NumberField id="auction" label="Auction fees" prefix="£"
                value={inputs.auctionFees} onChange={(v) => set("auctionFees", v)} />
              <NumberField id="sourcing" label="Sourcing fee" prefix="£"
                value={inputs.sourcingFee} onChange={(v) => set("sourcingFee", v)} />
            </InputGroup>
            )}

            {(method === "brrr" || method === "bridge") && (
            <InputGroup title="Refurb">
              <NumberField id="refurb" label="Refurb cost" prefix="£" step={500}
                value={inputs.refurbCost} onChange={(v) => set("refurbCost", v)} />
              <NumberField id="rmonths" label="Refurb duration" suffix="mo"
                value={inputs.refurbMonths} onChange={(v) => set("refurbMonths", v)} />
              <NumberField id="holding" label="Holding costs / month" prefix="£"
                value={inputs.holdingMonthly} onChange={(v) => set("holdingMonthly", v)}
                hint="Council tax, utilities, insurance during refurb" />
            </InputGroup>
            )}

            {(method === "brrr" || method === "bridge") && (
            <InputGroup title="Bridging finance">
              <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm">
                <span>Fund purchase with a bridge?</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={inputs.useBridge}
                  onChange={(e) => set("useBridge", e.target.checked)}
                />
              </label>
              {inputs.useBridge && (
                <>
                  <NumberField id="bltv" label="Bridge LTV (of purchase price)" suffix="%" step={1}
                    value={inputs.bridgeLoanPct} onChange={(v) => set("bridgeLoanPct", v)}
                    hint="Typical: 70–75% of purchase price" />
                  <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm">
                    <span>Bridge also funds refurb?</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={inputs.bridgeFundsRefurb}
                      onChange={(e) => set("bridgeFundsRefurb", e.target.checked)}
                    />
                  </label>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <NumberField
                        id="brate2"
                        label={inputs.bridgeRateIsPCM ? "Bridge rate (PCM)" : "Bridge rate (annual)"}
                        suffix="%"
                        step={0.05}
                        value={inputs.bridgeRateIsPCM ? inputs.bridgeRatePCM : inputs.bridgeRate}
                        onChange={(v) => set(inputs.bridgeRateIsPCM ? "bridgeRatePCM" : "bridgeRate", v)}
                        hint={inputs.bridgeRateIsPCM ? `≈ ${(inputs.bridgeRatePCM * 12).toFixed(2)}% pa` : `≈ ${(inputs.bridgeRate / 12).toFixed(2)}% per month`}
                      />
                    </div>
                    <div className="flex overflow-hidden rounded-md border border-border">
                      <Button type="button" variant={inputs.bridgeRateIsPCM ? "secondary" : "ghost"} size="sm" className="rounded-none" onClick={() => set("bridgeRateIsPCM", true)}>PCM</Button>
                      <Button type="button" variant={inputs.bridgeRateIsPCM ? "ghost" : "secondary"} size="sm" className="rounded-none" onClick={() => set("bridgeRateIsPCM", false)}>PA</Button>
                    </div>
                  </div>
                  <NumberField id="bterm" label="Bridge term" suffix="mo" step={1}
                    value={inputs.bridgeTermMonths} onChange={(v) => set("bridgeTermMonths", v)}
                    hint="Refurb time + buffer until refi completes" />
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <NumberField
                        id="barr"
                        label="Arrangement fee"
                        prefix={inputs.bridgeArrangementIsPct ? undefined : "£"}
                        suffix={inputs.bridgeArrangementIsPct ? "%" : undefined}
                        step={inputs.bridgeArrangementIsPct ? 0.1 : 100}
                        value={inputs.bridgeArrangementIsPct ? inputs.bridgeArrangementPct : inputs.bridgeArrangementAmount}
                        onChange={(v) => set(inputs.bridgeArrangementIsPct ? "bridgeArrangementPct" : "bridgeArrangementAmount", v)}
                        hint={inputs.bridgeArrangementIsPct ? "Typical: 2% of bridge loan, added to loan" : "Flat fee added to loan"}
                      />
                    </div>
                    <div className="flex overflow-hidden rounded-md border border-border">
                      <Button type="button" variant={inputs.bridgeArrangementIsPct ? "ghost" : "secondary"} size="sm" className="rounded-none" onClick={() => set("bridgeArrangementIsPct", false)}>£</Button>
                      <Button type="button" variant={inputs.bridgeArrangementIsPct ? "secondary" : "ghost"} size="sm" className="rounded-none" onClick={() => set("bridgeArrangementIsPct", true)}>%</Button>
                    </div>
                  </div>
                  <NumberField id="bexit" label="Exit fee" suffix="%" step={0.1}
                    value={inputs.bridgeExitPct} onChange={(v) => set("bridgeExitPct", v)}
                    hint="Often 1% of loan, charged on redemption" />
                  <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm">
                    <span>Roll up interest (vs serviced monthly)</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={inputs.bridgeInterestRolled}
                      onChange={(e) => set("bridgeInterestRolled", e.target.checked)}
                    />
                  </label>
                </>
              )}
              {!inputs.useBridge && (
                <p className="text-xs text-muted-foreground">
                  Off = standard purchase mortgage. Switch on to model a bridge that's repaid by the refinance.
                </p>
              )}
            </InputGroup>
            )}

            {method === "brrr" && (
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
            )}

            <InputGroup title="Rental (post-refi)">
              <NumberField id="units" label="Lettable units" step={1}
                value={inputs.lettableUnits} onChange={(v) => set("lettableUnits", v)} />
              <NumberField id="currentRent" label="Current monthly rent" prefix="£"
                value={inputs.currentMonthlyRent} onChange={(v) => set("currentMonthlyRent", v)}
                hint="Rent being achieved today (pre-refurb)" />
              <NumberField id="rent" label="Achievable monthly rent" prefix="£"
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

            {method === "brrr" && (
            <InputGroup title="Flip / sale exit (optional)">
              <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm">
                <span>Model a flip / resale instead of refi?</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={inputs.flipEnabled}
                  onChange={(e) => set("flipEnabled", e.target.checked)}
                />
              </label>
              {inputs.flipEnabled && (
                <>
                  <NumberField id="flipPrice" label="Sale price achieved" prefix="£" step={1000}
                    value={inputs.flipSalePrice} onChange={(v) => set("flipSalePrice", v)} />
                  <NumberField id="flipLegal" label="Sale legal fees" prefix="£"
                    value={inputs.flipLegalFees} onChange={(v) => set("flipLegalFees", v)} />
                  <NumberField id="flipAgency" label="Agency fee" prefix="£"
                    value={inputs.flipAgencyFee} onChange={(v) => set("flipAgencyFee", v)} />
                </>
              )}
            </InputGroup>
            )}
          </section>

          {/* Results */}
          <section className="space-y-6">
            {method === "brrr" && (
            <div className={`rounded-xl border p-5 ${verdictTone}`}>
              <div className="text-xs font-medium uppercase tracking-wider opacity-80">BRRR verdict</div>
              <div className="mt-1 text-2xl font-semibold">{r.verdictLabel}</div>
              <div className="mt-1 text-sm opacity-90">
                {fmtPct(Math.max(0, Math.min(100, r.capitalRecycledPct)), 0)} of starting capital recycled · Cash left in {fmtGBP(Math.max(0, r.cashLeftIn))}
              </div>
            </div>
            )}

            <div>
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Key metrics</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <MetricCard label="Purchase price" value={fmtGBP(inputs.purchasePrice)} />
                <MetricCard label="Fixtures & fittings" value={fmtGBP(inputs.fixturesFittings)} />
                <MetricCard label="Refurbishment cost" value={fmtGBP(inputs.refurbCost)} />
                <MetricCard label="Conservative GDV" value={fmtGBP(inputs.gdv)} />
                <MetricCard
                  label="Below market value %"
                  value={fmtPct(r.belowMarketValuePct)}
                  hint="(GDV − Purchase) ÷ GDV"
                  tone={r.belowMarketValuePct >= 20 ? "positive" : "accent"}
                />
                <MetricCard
                  label="All money out (years)"
                  value={
                    r.cashLeftIn <= 0
                      ? "0 (full pull-out)"
                      : !isFinite(r.allMoneyOutYears)
                        ? "—"
                        : `${r.allMoneyOutYears.toFixed(2)} yrs`
                  }
                  hint="Cash left in ÷ annual cashflow"
                />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Revenue</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <MetricCard label="Lettable units" value={`${inputs.lettableUnits}`} />
                <MetricCard label="Current monthly rent" value={fmtGBP(inputs.currentMonthlyRent)} />
                <MetricCard label="Achievable monthly rent" value={fmtGBP(inputs.monthlyRent)} tone="positive" />
                <MetricCard label="Achievable annual rent" value={fmtGBP(r.annualRent)} />
                <MetricCard
                  label="Gross yield (on purchase)"
                  value={fmtPct(r.grossYieldOnPurchase)}
                  hint="Annual rent ÷ purchase price"
                  tone="positive"
                />
                <MetricCard
                  label="Gross yield (on GDV)"
                  value={fmtPct(r.grossYield)}
                  hint="Annual rent ÷ GDV"
                />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">The deal</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Total cash in" value={fmtGBP(r.totalCashIn)} hint="Deposit + costs + refurb + holding + interest" />
                {method === "brrr" && (
                  <>
                    <MetricCard label="New loan @ refi" value={fmtGBP(r.newLoan)} hint={`${fmtPct(inputs.refiLtv, 0)} of GDV`} />
                    <MetricCard
                      label="Cash released"
                      value={fmtGBP(r.cashReleased)}
                      hint={effectiveInputs.useBridge ? "New loan − bridge redemption − refi fees" : "New loan − purchase loan − refi fees"}
                      tone={r.cashReleased >= 0 ? "positive" : "negative"}
                    />
                    <MetricCard
                      label="Cash left in deal"
                      value={fmtGBP(Math.max(0, r.cashLeftIn))}
                      hint={r.cashLeftIn <= 0 ? "Full BRRR" : `${fmtPct(r.capitalRecycledPct, 0)} recycled`}
                      tone={r.cashLeftIn <= 0 ? "positive" : "accent"}
                    />
                  </>
                )}
              </div>
            </div>

            {effectiveInputs.useBridge && (
              <div>
                <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Bridging finance</h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Bridge loan" value={fmtGBP(r.bridgeLoan)} hint={`${fmtPct(inputs.bridgeLoanPct, 0)} of purchase${inputs.bridgeFundsRefurb ? " + refurb" : ""}`} />
                  <MetricCard label="Interest (total)" value={fmtGBP(r.bridgeInterestTotal)} hint={`${inputs.bridgeTermMonths} mo · ${inputs.bridgeInterestRolled ? "rolled up" : "serviced"}`} />
                  <MetricCard label="Arrangement + exit fees" value={fmtGBP(r.bridgeArrangementFee + r.bridgeExitFee)} hint={`Arr ${fmtPct(inputs.bridgeArrangementPct, 1)} · Exit ${fmtPct(inputs.bridgeExitPct, 1)}`} />
                  <MetricCard
                    label="Bridge redemption"
                    value={fmtGBP(r.bridgeRepaymentTotal)}
                    hint={`Bridge LTGDV: ${fmtPct(r.bridgeLTGDV, 0)}`}
                    tone={r.newLoan >= r.bridgeRepaymentTotal ? "positive" : "negative"}
                  />
                </div>
                {r.newLoan < r.bridgeRepaymentTotal && (
                  <p className="mt-2 text-xs text-destructive">
                    Warning: refi loan ({fmtGBP(r.newLoan)}) does not fully repay the bridge ({fmtGBP(r.bridgeRepaymentTotal)}). You'll need to inject {fmtGBP(r.bridgeRepaymentTotal - r.newLoan)} extra cash to clear it.
                  </p>
                )}
                {inputs.bridgeInterestRolled && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Rolled-up interest compounds monthly on (loan + arrangement fee). Serviced mode would cost {fmtGBP(r.bridgeInterestServicedMonthly || (r.bridgeLoan + r.bridgeArrangementFee) * (inputs.bridgeRate / 100) / 12)}/mo cash out of pocket instead.
                  </p>
                )}
              </div>
            )}

            {method === "brrr" && (
            <div>
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Value uplift</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <MetricCard label="Profit on paper" value={fmtGBP(r.profitOnPaper)} hint="GDV − (price + refurb)" tone={r.profitOnPaper >= 0 ? "positive" : "negative"} />
                <MetricCard label="New equity" value={fmtGBP(r.newEquity)} hint="GDV − new loan" />
                <MetricCard label="Money multiple" value={r.totalCashIn > 0 ? `${(inputs.gdv / r.totalCashIn).toFixed(2)}×` : "—"} hint="GDV ÷ total cash in" />
              </div>
            </div>
            )}

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

            {method !== "cash" && (
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
            )}

            <div>
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Deal summary</h2>
              <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
                <Row label="Deposit" value={fmtGBP(r.depositAmount)} />
                {!effectiveInputs.useBridge && method !== "cash" && <Row label="Purchase loan" value={fmtGBP(r.purchaseLoan)} />}
                <Row label="Stamp duty + legal + survey" value={fmtGBP(inputs.stampDuty + inputs.legalFees + inputs.surveyFees)} />
                {r.additionalAcquisitionCosts > 0 && (
                  <Row label="Additional acquisition costs" value={fmtGBP(r.additionalAcquisitionCosts)} />
                )}
                {(method === "brrr" || method === "bridge") && (
                  <>
                    <Row label="Refurb cost" value={fmtGBP(effectiveInputs.refurbCost)} />
                    {effectiveInputs.useBridge && effectiveInputs.bridgeFundsRefurb && (
                      <Row label="Less: refurb funded by bridge" value={`− ${fmtGBP(effectiveInputs.refurbCost)}`} />
                    )}
                    <Row label={`Holding costs (${effectiveInputs.refurbMonths} mo)`} value={fmtGBP(r.holdingCostsTotal)} />
                    {!effectiveInputs.useBridge && (
                      <Row label={`Purchase interest during refurb (${effectiveInputs.refurbMonths} mo)`} value={fmtGBP(r.purchaseInterestDuringRefurb)} />
                    )}
                  </>
                )}
                {effectiveInputs.useBridge && (
                  <>
                    <Row label="Bridge loan drawn" value={fmtGBP(r.bridgeLoan)} />
                    <Row label={`Bridge arrangement fee (${fmtPct(effectiveInputs.bridgeArrangementPct, 1)})`} value={fmtGBP(r.bridgeArrangementFee)} />
                    <Row
                      label={`Bridge interest (${effectiveInputs.bridgeTermMonths} mo · ${effectiveInputs.bridgeInterestRolled ? "rolled" : "serviced"})`}
                      value={fmtGBP(r.bridgeInterestTotal)}
                    />
                    <Row label={`Bridge exit fee (${fmtPct(effectiveInputs.bridgeExitPct, 1)})`} value={fmtGBP(r.bridgeExitFee)} />
                  </>
                )}
                <Row label="Total cash in" value={fmtGBP(r.totalCashIn)} bold />
                {method === "brrr" && (
                  <>
                    <Row label="Post-refurb valuation (GDV)" value={fmtGBP(inputs.gdv)} />
                    <Row label={`New loan @ ${fmtPct(inputs.refiLtv, 0)} LTV`} value={fmtGBP(r.newLoan)} />
                    {effectiveInputs.useBridge ? (
                      <Row label="Less: bridge redemption (loan + interest + fees)" value={`− ${fmtGBP(r.bridgeRepaymentTotal)}`} bold tone="negative" />
                    ) : (
                      <Row label="Less: original loan repaid" value={`− ${fmtGBP(r.purchaseLoan)}`} />
                    )}
                    <Row label="Less: refi fees" value={`− ${fmtGBP(inputs.refiFees)}`} />
                    <Row label="Cash released on refi" value={fmtGBP(r.cashReleased)} bold tone={r.cashReleased >= 0 ? "positive" : "negative"} />
                    <Row label="Cash left in deal" value={fmtGBP(Math.max(0, r.cashLeftIn))} bold tone={r.cashLeftIn <= 0 ? "positive" : undefined} />
                  </>
                )}
                {method !== "cash" && <Row label="Break-even rent" value={fmtGBP(r.breakEvenRent)} />}
                <Row label="Annual cashflow (IO)" value={fmtGBP(r.annualCashflowIO)} bold tone={r.annualCashflowIO >= 0 ? "positive" : "negative"} />
              </div>
            </div>

            {method === "brrr" && inputs.flipEnabled && (
              <div>
                <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Flip / sale exit</h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Sale price achieved" value={fmtGBP(inputs.flipSalePrice)} />
                  <MetricCard label="Sale legal fees" value={fmtGBP(inputs.flipLegalFees)} />
                  <MetricCard label="Agency fee" value={fmtGBP(inputs.flipAgencyFee)} />
                  <MetricCard
                    label="Flip profit"
                    value={fmtGBP(r.flipProfit)}
                    hint="Sale − selling costs − debt − cash in (deposit recovered)"
                    tone={r.flipProfit >= 0 ? "positive" : "negative"}
                  />
                </div>
              </div>
            )}

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
