import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  MOCK_LISTINGS,
  applyFilters,
  fmtGBP,
  fmtPct,
  type Condition,
  type Listing,
  type ListingType,
  type MarketFilters,
  type PropertyType,
  type InvestorMetrics,
} from "@/lib/market-listings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/market")({
  head: () => ({
    meta: [
      { title: "Market Search — HARTSTONE HOLDINGS" },
      { name: "description", content: "Search the UK property market with investor-grade filters: yield, BMV, HMO potential, auctions and refurb signals." },
    ],
  }),
  component: MarketPage,
});

type Row = Listing & { m: InvestorMetrics };

const DEFAULT_FILTERS: MarketFilters = { article4: "any" };

function MarketPage() {
  const [filters, setFilters] = useState<MarketFilters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [reviewFor, setReviewFor] = useState<Row | null>(null);

  const rows = useMemo(() => applyFilters(MOCK_LISTINGS, filters), [filters]);
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const stats = useMemo(() => {
    if (rows.length === 0) return { count: 0, avgYield: 0, avgBmv: 0, underGuide: 0 };
    const avgYield = rows.reduce((a, r) => a + r.m.grossYieldHmo, 0) / rows.length;
    const avgBmv = rows.reduce((a, r) => a + r.m.bmvPct, 0) / rows.length;
    const underGuide = rows.filter((r) => r.listingType === "auction" && r.guidePrice && r.guidePrice < r.price * 0.85).length;
    return { count: rows.length, avgYield, avgBmv, underGuide };
  }, [rows]);

  const set = <K extends keyof MarketFilters>(k: K, v: MarketFilters[K]) =>
    setFilters((p) => ({ ...p, [k]: v }));

  const toggleWatch = (id: string) => {
    setWatchlist((p) => {
      const next = new Set(p);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const saveAsDeal = async (r: Row) => {
    try {
      await supabase.from("properties").insert({
        name: `${r.address}, ${r.postcode}`,
        source: "market-search",
        inputs: { listingId: r.id, postcode: r.postcode, price: r.price, beds: r.beds, sqft: r.sqft, rooms: r.hmoRoomsPotential },
        metrics: r.m,
      } as never);
      toast.success("Saved to Deals");
    } catch (e) {
      toast.error("Couldn't save deal");
    }
  };

  return (
    <div className="min-h-[calc(100vh-49px)] bg-background">
      <FilterBar filters={filters} set={set} reset={() => setFilters(DEFAULT_FILTERS)} stats={stats} />

      <div className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 lg:grid-cols-[1fr_460px]">
        {/* Map placeholder */}
        <div className="relative hidden h-[calc(100vh-260px)] overflow-hidden rounded-xl border border-border bg-card lg:block">
          <MapPlaceholder rows={rows} selectedId={selectedId} onPick={setSelectedId} />
        </div>

        {/* List */}
        <div className="h-[calc(100vh-260px)] overflow-y-auto rounded-xl border border-border bg-card p-3">
          {rows.length === 0 && (
            <p className="px-3 py-12 text-center text-sm text-muted-foreground">No listings match your filters.</p>
          )}
          <div className="space-y-3">
            {rows.map((r) => (
              <ListingCard
                key={r.id}
                row={r}
                onOpen={() => setSelectedId(r.id)}
                onWatch={() => toggleWatch(r.id)}
                onSave={() => saveAsDeal(r)}
                onExpert={() => setReviewFor(r)}
                watched={watchlist.has(r.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <AnalyticsStrip rows={rows} />

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <DetailPanel
              row={selected}
              watched={watchlist.has(selected.id)}
              onWatch={() => toggleWatch(selected.id)}
              onSave={() => saveAsDeal(selected)}
              onExpert={() => setReviewFor(selected)}
            />
          )}
        </SheetContent>
      </Sheet>

      <ExpertReviewDialog row={reviewFor} onClose={() => setReviewFor(null)} />
    </div>
  );
}

function FilterBar({
  filters,
  set,
  reset,
  stats,
}: {
  filters: MarketFilters;
  set: <K extends keyof MarketFilters>(k: K, v: MarketFilters[K]) => void;
  reset: () => void;
  stats: { count: number; avgYield: number; avgBmv: number; underGuide: number };
}) {
  const togglePT = (t: PropertyType) => {
    const cur = new Set(filters.propertyTypes ?? []);
    cur.has(t) ? cur.delete(t) : cur.add(t);
    set("propertyTypes", Array.from(cur));
  };
  const toggleLT = (t: ListingType) => {
    const cur = new Set(filters.listingTypes ?? []);
    cur.has(t) ? cur.delete(t) : cur.add(t);
    set("listingTypes", Array.from(cur));
  };
  const toggleCond = (t: Condition) => {
    const cur = new Set(filters.conditions ?? []);
    cur.has(t) ? cur.delete(t) : cur.add(t);
    set("conditions", Array.from(cur));
  };

  return (
    <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto max-w-[1600px] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Postcode, town or street…"
            className="h-9 w-64"
            value={filters.query ?? ""}
            onChange={(e) => set("query", e.target.value || undefined)}
          />
          <NumInput placeholder="Min £" value={filters.minPrice} onChange={(v) => set("minPrice", v)} />
          <NumInput placeholder="Max £" value={filters.maxPrice} onChange={(v) => set("maxPrice", v)} />
          <NumInput placeholder="Min beds" value={filters.minBeds} onChange={(v) => set("minBeds", v)} className="w-24" />

          <Separator />
          <span className="text-xs text-muted-foreground">Type:</span>
          {(["terraced", "semi", "detached", "flat"] as PropertyType[]).map((t) => (
            <Chip key={t} active={(filters.propertyTypes ?? []).includes(t)} onClick={() => togglePT(t)}>
              {t}
            </Chip>
          ))}

          <Separator />
          <span className="text-xs text-muted-foreground">Listing:</span>
          {(["sale", "auction", "repossession", "probate"] as ListingType[]).map((t) => (
            <Chip key={t} active={(filters.listingTypes ?? []).includes(t)} onClick={() => toggleLT(t)}>
              {t}
            </Chip>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Investor:</span>
          <NumInput placeholder="Min HMO yield %" value={filters.minHmoYield} onChange={(v) => set("minHmoYield", v)} className="w-32" />
          <NumInput placeholder="Min ROI %" value={filters.minRoi} onChange={(v) => set("minRoi", v)} className="w-28" />
          <NumInput placeholder="Min rooms" value={filters.minRooms} onChange={(v) => set("minRooms", v)} className="w-24" />
          <NumInput placeholder="Min BMV %" value={filters.minBmv} onChange={(v) => set("minBmv", v)} className="w-28" />
          <NumInput placeholder="Max £/sqft" value={filters.maxPpsf} onChange={(v) => set("maxPpsf", v)} className="w-28" />

          <Separator />
          <span className="text-xs text-muted-foreground">Article 4:</span>
          {(["any", "exclude", "only"] as const).map((a) => (
            <Chip key={a} active={(filters.article4 ?? "any") === a} onClick={() => set("article4", a)}>
              {a}
            </Chip>
          ))}

          <Separator />
          <span className="text-xs text-muted-foreground">Condition:</span>
          {(["turnkey", "light", "heavy"] as Condition[]).map((c) => (
            <Chip key={c} active={(filters.conditions ?? []).includes(c)} onClick={() => toggleCond(c)}>
              {c}
            </Chip>
          ))}

          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              <b className="text-foreground">{stats.count}</b> matches · avg HMO yield{" "}
              <b className="text-primary">{fmtPct(stats.avgYield)}</b> · avg BMV{" "}
              <b className={stats.avgBmv > 0 ? "text-primary" : "text-foreground"}>{fmtPct(stats.avgBmv)}</b>
              {stats.underGuide > 0 && <> · {stats.underGuide} under-guide auctions</>}
            </span>
            <Button size="sm" variant="outline" onClick={reset}>Reset</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumInput({ placeholder, value, onChange, className }: { placeholder: string; value?: number; onChange: (v?: number) => void; className?: string }) {
  return (
    <Input
      type="number"
      placeholder={placeholder}
      className={`h-9 w-28 ${className ?? ""}`}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
    />
  );
}
function Separator() { return <span className="mx-1 h-5 w-px bg-border" />; }
function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function yieldTone(y: number) {
  if (y >= 12) return "text-primary";
  if (y >= 8) return "text-foreground";
  return "text-muted-foreground";
}

function ListingCard({
  row,
  onOpen,
  onWatch,
  onSave,
  onExpert,
  watched,
}: {
  row: Row;
  onOpen: () => void;
  onWatch: () => void;
  onSave: () => void;
  onExpert: () => void;
  watched: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background transition-colors hover:border-primary/50">
      <button onClick={onOpen} className="flex w-full text-left">
        <img src={row.photos[0]} alt={row.address} className="h-32 w-40 flex-shrink-0 object-cover" loading="lazy" />
        <div className="flex-1 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{fmtGBP(row.price)} {row.listingType === "auction" && row.guidePrice && <span className="text-xs font-normal text-muted-foreground">· guide {fmtGBP(row.guidePrice)}</span>}</p>
              <p className="text-xs text-muted-foreground">{row.address}, {row.postcode}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              {row.listingType !== "sale" && <Badge variant="destructive" className="text-[10px] capitalize">{row.listingType}</Badge>}
              {row.article4 && <Badge variant="outline" className="text-[10px]">Art.4</Badge>}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
            <Metric label="HMO yield" value={fmtPct(row.m.grossYieldHmo)} tone={yieldTone(row.m.grossYieldHmo)} />
            <Metric label="ROI" value={fmtPct(row.m.roiAnnual)} tone={yieldTone(row.m.roiAnnual)} />
            <Metric label="BMV" value={fmtPct(row.m.bmvPct)} tone={row.m.bmvPct > 5 ? "text-primary" : "text-foreground"} />
            <Metric label="Rooms" value={`${row.hmoRoomsPotential}`} />
          </div>
        </div>
      </button>
      <div className="flex gap-1 border-t border-border bg-card/30 px-2 py-1.5">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onWatch}>{watched ? "★ Watching" : "☆ Watch"}</Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onSave}>+ Save deal</Button>
        <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={onExpert}>£49 Expert review</Button>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className={`font-semibold ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

function MapPlaceholder({ rows, selectedId, onPick }: { rows: Row[]; selectedId: string | null; onPick: (id: string) => void }) {
  // Visual placeholder until the Google Maps connector is linked.
  // Markers laid out on a UK-shape gradient by relative lat/lng.
  const minLat = 51, maxLat = 55.5, minLng = -3.5, maxLng = -0.2;
  const proj = (lat: number, lng: number) => ({
    x: ((lng - minLng) / (maxLng - minLng)) * 100,
    y: 100 - ((lat - minLat) / (maxLat - minLat)) * 100,
  });
  return (
    <div className="relative h-full w-full bg-[radial-gradient(circle_at_30%_40%,hsl(var(--muted))_0%,hsl(var(--background))_70%)]">
      <div className="absolute left-3 top-3 z-10 rounded-md border border-border bg-card/90 px-3 py-2 text-xs backdrop-blur">
        <p className="font-semibold">Map view</p>
        <p className="text-muted-foreground">Demo projection — connect Google Maps for live tiles.</p>
      </div>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full opacity-20" preserveAspectRatio="none">
        <path d="M50,5 L70,20 L75,45 L65,70 L70,90 L40,95 L20,75 L25,50 L15,30 Z" fill="none" stroke="currentColor" strokeWidth="0.5" />
      </svg>
      {rows.map((r) => {
        const { x, y } = proj(r.lat, r.lng);
        const active = r.id === selectedId;
        const y_ = r.m.grossYieldHmo;
        const color = y_ >= 12 ? "bg-emerald-500" : y_ >= 9 ? "bg-lime-400" : y_ >= 7 ? "bg-yellow-400" : "bg-orange-400";
        return (
          <button
            key={r.id}
            onClick={() => onPick(r.id)}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 transition-all ${color} ${
              active ? "z-20 h-5 w-5 ring-foreground" : "h-3 w-3 ring-background hover:scale-150"
            }`}
            style={{ left: `${x}%`, top: `${y}%` }}
            title={`${r.town} · ${fmtPct(r.m.grossYieldHmo)}`}
          />
        );
      })}
      <div className="absolute bottom-3 left-3 z-10 rounded-md border border-border bg-card/90 px-3 py-2 text-[10px] backdrop-blur">
        <p className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">HMO yield</p>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400" /> &lt;7%</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-400" /> 7-9</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-lime-400" /> 9-12</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> 12%+</span>
        </div>
      </div>
    </div>
  );
}

function DetailPanel({
  row,
  watched,
  onWatch,
  onSave,
  onExpert,
}: {
  row: Row;
  watched: boolean;
  onWatch: () => void;
  onSave: () => void;
  onExpert: () => void;
}) {
  return (
    <div className="space-y-4">
      <SheetHeader>
        <SheetTitle className="text-base">{row.address}, {row.postcode}</SheetTitle>
      </SheetHeader>

      <div className="grid grid-cols-3 gap-1">
        {row.photos.map((p, i) => (
          <img key={i} src={p} alt="" className="aspect-square w-full rounded object-cover" loading="lazy" />
        ))}
      </div>

      <div className="flex items-baseline justify-between">
        <p className="text-2xl font-bold">{fmtGBP(row.price)}</p>
        <p className="text-xs text-muted-foreground">
          {row.beds} bed · {row.baths} bath · {row.sqft.toLocaleString()} sqft · EPC {row.epc}
        </p>
      </div>

      <p className="text-sm text-muted-foreground">{row.description}</p>

      <div className="rounded-lg border border-border bg-card p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Investor metrics</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="HMO gross yield" value={fmtPct(row.m.grossYieldHmo)} tone={yieldTone(row.m.grossYieldHmo)} />
          <Stat label="Single-let yield" value={fmtPct(row.m.grossYieldBtl)} />
          <Stat label="ROI (75% LTV)" value={fmtPct(row.m.roiAnnual)} tone={yieldTone(row.m.roiAnnual)} />
          <Stat label="BMV vs median" value={fmtPct(row.m.bmvPct)} tone={row.m.bmvPct > 5 ? "text-primary" : undefined} />
          <Stat label="Est. HMO GDV @ 8%" value={fmtGBP(row.m.estGdvHmo)} />
          <Stat label="Refurb uplift est." value={fmtGBP(row.m.refurbUplift)} />
          <Stat label="£/sqft" value={fmtGBP(Math.round(row.m.pricePerSqft))} />
          <Stat label="Total cash in" value={fmtGBP(Math.round(row.m.totalInPlight))} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={onSave} variant="default">+ Save to Deals</Button>
        <Button onClick={onWatch} variant="outline">{watched ? "★ Watching" : "☆ Watch"}</Button>
        <Button asChild variant="outline">
          <a href={`/hmo-compliance?from=${row.id}`}>Analyse as HMO</a>
        </Button>
        <Button asChild variant="outline">
          <a href={`/refinance?from=${row.id}`}>Property calculator</a>
        </Button>
        <Button onClick={onExpert} className="col-span-2 bg-gradient-to-r from-primary to-primary/70">
          £49 — Request expert deal review
        </Button>
        <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="col-span-2 text-center text-xs text-muted-foreground hover:text-foreground">
          View original listing ↗
        </a>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className={`font-semibold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

function AnalyticsStrip({ rows }: { rows: Row[] }) {
  const yieldBuckets = useMemo(() => {
    const buckets = [
      { range: "<6%", count: 0 },
      { range: "6-8%", count: 0 },
      { range: "8-10%", count: 0 },
      { range: "10-12%", count: 0 },
      { range: "12%+", count: 0 },
    ];
    rows.forEach((r) => {
      const y = r.m.grossYieldHmo;
      const i = y < 6 ? 0 : y < 8 ? 1 : y < 10 ? 2 : y < 12 ? 3 : 4;
      buckets[i].count++;
    });
    return buckets;
  }, [rows]);

  const scatter = useMemo(() => rows.map((r) => ({ ppsf: r.m.pricePerSqft, yield: r.m.grossYieldHmo, name: r.postcode })), [rows]);

  const byPostcode = useMemo(() => {
    const m = new Map<string, { bmv: number; count: number }>();
    rows.forEach((r) => {
      const code = r.postcode.split(" ")[0];
      const cur = m.get(code) ?? { bmv: 0, count: 0 };
      cur.bmv += r.m.bmvPct;
      cur.count++;
      m.set(code, cur);
    });
    return Array.from(m.entries())
      .map(([code, { bmv, count }]) => ({ code, bmv: bmv / count, count }))
      .sort((a, b) => b.bmv - a.bmv)
      .slice(0, 8);
  }, [rows]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Market analytics (filtered)</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <Card title="HMO yield distribution">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={yieldBuckets}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 2" vertical={false} />
              <XAxis dataKey="range" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <RTooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Top postcodes by avg BMV %">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={byPostcode} layout="vertical">
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 2" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="code" tick={{ fontSize: 10 }} width={50} />
              <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} formatter={(v: number) => `${v.toFixed(1)}%`} />
              <Bar dataKey="bmv" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="£/sqft vs HMO yield">
          <ResponsiveContainer width="100%" height={160}>
            <ScatterChart>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 2" />
              <XAxis dataKey="ppsf" name="£/sqft" tick={{ fontSize: 10 }} />
              <YAxis dataKey="yield" name="yield" tick={{ fontSize: 10 }} />
              <ZAxis range={[60, 60]} />
              <RTooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} formatter={(v: number, n: string) => (n === "yield" ? `${v.toFixed(1)}%` : `£${Math.round(v)}`)} />
              <Scatter data={scatter} fill="hsl(var(--primary))" />
            </ScatterChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function ExpertReviewDialog({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const [goal, setGoal] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [finance, setFinance] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!row) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("expert_reviews").insert({
        user_id: (await supabase.auth.getUser()).data.user?.id ?? null,
        listing_snapshot: row,
        context: { goal, timeframe, finance },
        status: "pending_payment",
        fee_pence: 4900,
      } as never);
      if (error) throw error;
      toast.success("Review request created. Payment checkout coming next — we'll email you to complete £49.");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't create review request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Expert deal review — £49</DialogTitle>
          <DialogDescription>
            An independent property expert assesses viability, exit options, refurb cost realism and red flags. Written review delivered within 48h.
          </DialogDescription>
        </DialogHeader>
        {row && (
          <div className="rounded-md border border-border bg-card/50 p-3 text-xs">
            <p className="font-semibold">{row.address}, {row.postcode}</p>
            <p className="text-muted-foreground">{fmtGBP(row.price)} · {row.beds} bed · HMO yield {fmtPct(row.m.grossYieldHmo)}</p>
          </div>
        )}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Your goal with this deal</label>
            <Textarea rows={2} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="HMO conversion to BRRR, hold for cashflow, flip after refurb…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Timeframe</label>
              <Input value={timeframe} onChange={(e) => setTimeframe(e.target.value)} placeholder="e.g. complete in 8 weeks" />
            </div>
            <div>
              <label className="text-xs font-medium">Finance status</label>
              <Input value={finance} onChange={(e) => setFinance(e.target.value)} placeholder="AIP in place, bridge, cash" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Continue — £49"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}