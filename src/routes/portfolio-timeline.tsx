import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fmtGBP } from "@/lib/btl";
import { toast } from "sonner";
import {
  buildDealRow,
  buildCashSeries,
  type DealRow,
  type PropertyLite,
  type TimelineEntry,
  type TimelineStatus,
} from "@/lib/portfolio-timeline";
import {
  Loader2,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Plus,
  Lock,
  Unlock,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/portfolio-timeline")({
  head: () => ({
    meta: [
      { title: "Portfolio Timeline — capital recycling planner" },
      { name: "description", content: "Plan when each deal refinances, how much capital comes out, and which next deal absorbs it." },
      { property: "og:title", content: "Portfolio Timeline" },
      { property: "og:description", content: "Map refinance events and recycled capital across your BRRR portfolio." },
    ],
  }),
  component: PortfolioTimelinePage,
});

const STATUSES: TimelineStatus[] = ["planned", "live", "refinanced", "sold"];
const STATUS_LABELS: Record<TimelineStatus, string> = {
  planned: "Planned",
  live: "Live",
  refinanced: "Refinanced",
  sold: "Sold",
};
const STATUS_DOT: Record<TimelineStatus, string> = {
  planned: "bg-slate-400",
  live: "bg-amber-500",
  refinanced: "bg-emerald-500",
  sold: "bg-zinc-500",
};

type RangePreset = "2y" | "5y" | "10y";
const LABEL_COL = 200;

function PortfolioTimelinePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<PropertyLite[]>([]);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);

  const [pxPerMonth, setPxPerMonth] = useState(28);
  const [range, setRange] = useState<RangePreset>("5y");
  const [statusFilter, setStatusFilter] = useState<TimelineStatus | "all">("all");
  const [locked, setLocked] = useState(true);
  const [refiOpenId, setRefiOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.data.subscription.unsubscribe();
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    const [{ data: props }, { data: ents }] = await Promise.all([
      supabase
        .from("properties")
        .select("id,name,inputs,metrics,in_portfolio,created_at")
        .eq("in_portfolio", true)
        .order("created_at", { ascending: true }),
      supabase.from("portfolio_timeline_entries").select("*"),
    ]);
    setProperties((props ?? []) as any);
    setEntries((ents ?? []) as any);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    void reload();
  }, [session, reload]);

  const allDeals: DealRow[] = useMemo(() => {
    const byProp = new Map(entries.map((e) => [e.property_id, e]));
    return properties.map((p) => buildDealRow(p, byProp.get(p.id) ?? null));
  }, [properties, entries]);

  const deals = useMemo(
    () => (statusFilter === "all" ? allDeals : allDeals.filter((d) => d.status === statusFilter)),
    [allDeals, statusFilter],
  );

  // Time domain: today minus 3mo → today + range
  const { startDate, endDate, months } = useMemo(() => {
    const yrs = range === "2y" ? 2 : range === "5y" ? 5 : 10;
    const s = new Date();
    s.setDate(1);
    s.setMonth(s.getMonth() - 3);
    const e = new Date(s);
    e.setFullYear(e.getFullYear() + yrs);
    // Extend if any deal goes beyond
    for (const d of deals) {
      if (d.purchaseDate < s) s.setTime(Math.min(s.getTime(), startOfMonth(d.purchaseDate).getTime()));
      if (d.refiDate > e) e.setTime(Math.max(e.getTime(), endOfMonth(d.refiDate).getTime()));
    }
    const m: Date[] = [];
    const cur = new Date(s);
    while (cur <= e) { m.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1); }
    return { startDate: s, endDate: e, months: m };
  }, [deals, range]);

  const monthsCount = months.length;
  const chartWidth = monthsCount * pxPerMonth;

  const cashSeries = useMemo(() => buildCashSeries(deals), [deals]);
  // Map cashSeries to the unified month axis
  const seriesByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of cashSeries) {
      map.set(monthKey(p.date), p.freeCapital);
    }
    return map;
  }, [cashSeries]);

  const freePoints = useMemo(
    () => months.map((m) => seriesByMonth.get(monthKey(m)) ?? 0),
    [months, seriesByMonth],
  );

  async function saveEntry(propertyId: string, patch: Partial<TimelineEntry>) {
    if (!session) return;
    const existing = entries.find((e) => e.property_id === propertyId);
    const payload: any = {
      user_id: session.user.id,
      property_id: propertyId,
      purchase_date: patch.purchase_date !== undefined ? patch.purchase_date : existing?.purchase_date ?? null,
      refi_month_offset: patch.refi_month_offset !== undefined ? patch.refi_month_offset : existing?.refi_month_offset ?? null,
      assigned_to_property_id: patch.assigned_to_property_id !== undefined ? patch.assigned_to_property_id : existing?.assigned_to_property_id ?? null,
      status: patch.status ?? existing?.status ?? "planned",
      notes: patch.notes !== undefined ? patch.notes : existing?.notes ?? null,
    };
    if (existing) {
      const { data, error } = await supabase.from("portfolio_timeline_entries").update(payload).eq("id", existing.id).select().single();
      if (error) return toast.error(error.message);
      setEntries((p) => p.map((e) => (e.id === existing.id ? (data as any) : e)));
    } else {
      const { data, error } = await supabase.from("portfolio_timeline_entries").insert(payload).select().single();
      if (error) return toast.error(error.message);
      setEntries((p) => [...p, data as any]);
    }
  }

  function scrollToToday() {
    if (!scrollRef.current) return;
    const x = monthsBetween(startDate, new Date()) * pxPerMonth;
    scrollRef.current.scrollTo({ left: Math.max(0, x + LABEL_COL - scrollRef.current.clientWidth / 2), behavior: "smooth" });
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Portfolio Timeline</h1>
        <p className="mt-3 text-muted-foreground">Sign in to plan refi events and recycled capital across your deals.</p>
        <Button asChild className="mt-6"><Link to="/auth">Sign in</Link></Button>
      </div>
    );
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const refiDeal = allDeals.find((d) => d.property.id === refiOpenId) ?? null;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Portfolio Timeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">Drag bars to re-plan dates. Click a refi marker to assign the pulled-out cash to your next deal.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> Add planned deal</Button>
      </header>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPxPerMonth((p) => Math.max(8, Math.round(p * 0.8)))} title="Zoom out"><ZoomOut className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPxPerMonth((p) => Math.min(120, Math.round(p * 1.25)))} title="Zoom in"><ZoomIn className="h-4 w-4" /></Button>
        </div>
        <Button variant="outline" size="sm" className="h-8" onClick={scrollToToday}><Crosshair className="h-4 w-4 mr-1.5" />Today</Button>
        <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
          {(["2y", "5y", "10y"] as const).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`px-2.5 py-1 text-xs rounded ${range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{r}</button>
          ))}
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Button variant={locked ? "outline" : "default"} size="sm" className="h-8" onClick={() => setLocked((l) => !l)}>
            {locked ? <><Lock className="h-3.5 w-3.5 mr-1.5" />Drag locked</> : <><Unlock className="h-3.5 w-3.5 mr-1.5" />Drag enabled</>}
          </Button>
        </div>
      </div>

      {deals.length === 0 ? (
        <div className="rounded-lg border bg-card py-16 text-center">
          <p className="text-muted-foreground">No deals match this filter. Mark deals as "In portfolio" on the <Link to="/properties" className="underline">Saved deals</Link> page, or add a planned deal above.</p>
        </div>
      ) : (
        <div ref={scrollRef} className="rounded-lg border bg-card overflow-x-auto">
          <div style={{ width: LABEL_COL + chartWidth, minWidth: "100%" }}>
            <CapitalOverlay
              months={months}
              points={freePoints}
              pxPerMonth={pxPerMonth}
              labelCol={LABEL_COL}
              startDate={startDate}
            />
            <AxisRow months={months} pxPerMonth={pxPerMonth} labelCol={LABEL_COL} startDate={startDate} />
            <div className="divide-y">
              {deals.map((d) => (
                <GanttRow
                  key={d.property.id}
                  deal={d}
                  startDate={startDate}
                  pxPerMonth={pxPerMonth}
                  labelCol={LABEL_COL}
                  locked={locked}
                  onOpenRefi={() => setRefiOpenId(d.property.id)}
                  onChangePurchaseDate={(iso) => saveEntry(d.property.id, { purchase_date: iso })}
                  onChangeRefiOffset={(n) => saveEntry(d.property.id, { refi_month_offset: n })}
                />
              ))}
            </div>
            <Legend />
          </div>
        </div>
      )}

      <RefiDrillSheet
        open={!!refiDeal}
        deal={refiDeal}
        allDeals={allDeals}
        onClose={() => setRefiOpenId(null)}
        onSave={(patch) => refiDeal && saveEntry(refiDeal.property.id, patch)}
        onSaveProperty={async (propertyId, patch) => {
          const target = properties.find((p) => p.id === propertyId);
          if (!target) return;
          const nextInputs = { ...(target.inputs ?? {}), ...patch.inputs };
          const update: any = { inputs: nextInputs };
          if (patch.name !== undefined) update.name = patch.name;
          const { error } = await supabase.from("properties").update(update).eq("id", propertyId);
          if (error) { toast.error(error.message); return; }
          setProperties((prev) => prev.map((p) => p.id === propertyId ? { ...p, ...update } as any : p));
        }}
      />

      <AddPlannedDealSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={async () => { setAddOpen(false); await reload(); }}
      />
    </div>
  );
}

/* ---------- helpers ---------- */

function startOfMonth(d: Date) { const r = new Date(d); r.setDate(1); r.setHours(0,0,0,0); return r; }
function endOfMonth(d: Date) { const r = startOfMonth(d); r.setMonth(r.getMonth() + 1); return r; }
function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function monthsBetween(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() - 1) / 30;
}
function addMonths(d: Date, m: number) { const r = new Date(d); r.setMonth(r.getMonth() + m); return r; }
function fmtShort(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `£${(n/1_000_000).toFixed(1)}m`;
  if (abs >= 1000) return `£${Math.round(n/1000)}k`;
  return `£${Math.round(n)}`;
}

/* ---------- axis + overlay ---------- */

function AxisRow({ months, pxPerMonth, labelCol, startDate }: { months: Date[]; pxPerMonth: number; labelCol: number; startDate: Date }) {
  const today = new Date();
  const todayX = monthsBetween(startDate, today) * pxPerMonth;
  return (
    <div className="relative flex border-b border-border bg-muted/30 text-[10px] text-muted-foreground" style={{ height: 28 }}>
      <div style={{ width: labelCol }} className="border-r border-border" />
      <div className="relative" style={{ width: months.length * pxPerMonth }}>
        {months.map((m, i) => {
          const isJan = m.getMonth() === 0;
          const isQuarter = m.getMonth() % 3 === 0;
          if (!isQuarter && pxPerMonth < 24) return null;
          return (
            <div key={i} className="absolute top-0 bottom-0" style={{ left: i * pxPerMonth }}>
              <div className={`w-px ${isJan ? "bg-border" : "bg-border/50"}`} style={{ height: isJan ? 28 : 12 }} />
              <div className="absolute top-3 left-1 whitespace-nowrap">
                {isJan ? m.getFullYear() : m.toLocaleDateString("en-GB", { month: "short" })}
              </div>
            </div>
          );
        })}
        {todayX >= 0 && todayX <= months.length * pxPerMonth && (
          <div className="absolute top-0 bottom-0 w-px bg-primary" style={{ left: todayX }}>
            <div className="absolute top-0.5 -translate-x-1/2 px-1 rounded text-[9px] bg-primary text-primary-foreground">Today</div>
          </div>
        )}
      </div>
    </div>
  );
}

function CapitalOverlay({ months, points, pxPerMonth, labelCol, startDate }: { months: Date[]; points: number[]; pxPerMonth: number; labelCol: number; startDate: Date }) {
  const width = months.length * pxPerMonth;
  const height = 80;
  const max = Math.max(1, ...points.map(Math.abs));
  const scale = (v: number) => (height / 2) - (v / max) * (height / 2 - 4);
  const today = new Date();
  const todayX = monthsBetween(startDate, today) * pxPerMonth;

  // Build polygons split by zero crossings (simplified: separate positive & negative areas)
  const pts = points.map((v, i) => ({ x: i * pxPerMonth, y: scale(v), v }));
  const baseY = height / 2;

  const posPath = areaPath(pts, baseY, "pos");
  const negPath = areaPath(pts, baseY, "neg");

  const [hover, setHover] = useState<number | null>(null);

  return (
    <div className="flex border-b border-border bg-card">
      <div style={{ width: labelCol, height }} className="border-r border-border flex items-center px-3 text-xs text-muted-foreground">
        <div>
          <div className="text-[10px] uppercase tracking-wide">Free capital</div>
          <div className="font-medium text-foreground tabular-nums">{fmtShort(points[points.length - 1] ?? 0)}</div>
        </div>
      </div>
      <div
        className="relative"
        style={{ width, height }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          const i = Math.max(0, Math.min(points.length - 1, Math.floor((e.clientX - rect.left) / pxPerMonth)));
          setHover(i);
        }}
      >
        <svg width={width} height={height} className="block">
          <line x1={0} y1={baseY} x2={width} y2={baseY} stroke="hsl(var(--border))" strokeDasharray="2 3" />
          {posPath && <path d={posPath} fill="hsl(140 60% 45% / 0.25)" stroke="hsl(140 60% 40%)" strokeWidth={1.5} />}
          {negPath && <path d={negPath} fill="hsl(0 70% 55% / 0.25)" stroke="hsl(0 70% 50%)" strokeWidth={1.5} />}
        </svg>
        {todayX >= 0 && todayX <= width && (
          <div className="absolute top-0 bottom-0 w-px bg-primary/50 pointer-events-none" style={{ left: todayX }} />
        )}
        {hover != null && (
          <>
            <div className="absolute top-0 bottom-0 w-px bg-foreground/40 pointer-events-none" style={{ left: hover * pxPerMonth }} />
            <div className="absolute top-1 px-2 py-1 rounded bg-popover text-popover-foreground text-[11px] shadow border border-border pointer-events-none" style={{ left: Math.min(width - 140, hover * pxPerMonth + 6) }}>
              <div className="font-medium">{months[hover]?.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</div>
              <div className="tabular-nums">{fmtGBP(points[hover] ?? 0)} free</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function areaPath(pts: { x: number; y: number; v: number }[], baseY: number, side: "pos" | "neg"): string | null {
  if (pts.length === 0) return null;
  const filtered = pts.map((p) => ({ ...p, y: side === "pos" ? Math.min(p.y, baseY) : Math.max(p.y, baseY) }));
  const allFlat = filtered.every((p, _i, arr) => p.y === baseY);
  if (allFlat) return null;
  let d = `M ${filtered[0].x} ${baseY}`;
  for (const p of filtered) d += ` L ${p.x} ${p.y}`;
  d += ` L ${filtered[filtered.length - 1].x} ${baseY} Z`;
  return d;
}

/* ---------- gantt row ---------- */

function GanttRow({
  deal, startDate, pxPerMonth, labelCol, locked, onOpenRefi, onChangePurchaseDate, onChangeRefiOffset,
}: {
  deal: DealRow;
  startDate: Date;
  pxPerMonth: number;
  labelCol: number;
  locked: boolean;
  onOpenRefi: () => void;
  onChangePurchaseDate: (iso: string) => void;
  onChangeRefiOffset: (n: number) => void;
}) {
  const rowHeight = 56;
  const purchaseX = monthsBetween(startDate, deal.purchaseDate) * pxPerMonth;
  const refiX = monthsBetween(startDate, deal.refiDate) * pxPerMonth;
  const endX = monthsBetween(startDate, deal.endDate) * pxPerMonth;
  const refurbColor = deal.useBridge ? "bg-rose-500/70" : "bg-amber-500/70";

  // Drag state
  const [drag, setDrag] = useState<{ type: "bar" | "refi"; startClientX: number; origPurchaseX: number; origRefiOffset: number } | null>(null);
  const [previewPurchaseX, setPreviewPurchaseX] = useState<number | null>(null);
  const [previewRefiOffset, setPreviewRefiOffset] = useState<number | null>(null);

  const effPurchaseX = previewPurchaseX ?? purchaseX;
  const baseRefiOffset = deal.entry?.refi_month_offset ?? (deal.useBridge ? deal.bridgeMonths : deal.refurbMonths);
  const effRefiOffset = previewRefiOffset ?? baseRefiOffset;
  const effRefiX = effPurchaseX + effRefiOffset * pxPerMonth;
  const effEndX = effRefiX + (endX - refiX); // keep post-refi width

  function onPointerDown(e: React.PointerEvent, type: "bar" | "refi") {
    if (locked) return;
    e.stopPropagation();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    setDrag({ type, startClientX: e.clientX, origPurchaseX: purchaseX, origRefiOffset: baseRefiOffset });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.startClientX;
    if (drag.type === "bar") {
      const monthsDelta = Math.round(dx / pxPerMonth);
      setPreviewPurchaseX(drag.origPurchaseX + monthsDelta * pxPerMonth);
    } else {
      const monthsDelta = Math.round(dx / pxPerMonth);
      setPreviewRefiOffset(Math.max(0, drag.origRefiOffset + monthsDelta));
    }
  }
  function onPointerUp() {
    if (!drag) return;
    if (drag.type === "bar" && previewPurchaseX != null) {
      const monthsDelta = Math.round((previewPurchaseX - drag.origPurchaseX) / pxPerMonth);
      if (monthsDelta !== 0) {
        const newDate = addMonths(deal.purchaseDate, monthsDelta);
        onChangePurchaseDate(newDate.toISOString().slice(0, 10));
      }
    } else if (drag.type === "refi" && previewRefiOffset != null && previewRefiOffset !== baseRefiOffset) {
      onChangeRefiOffset(previewRefiOffset);
    }
    setDrag(null);
    setPreviewPurchaseX(null);
    setPreviewRefiOffset(null);
  }

  const tooltip = (
    <div className="text-xs space-y-0.5">
      <div className="font-medium">{deal.property.name}</div>
      <div>Purchase: {deal.purchaseDate.toLocaleDateString("en-GB")}</div>
      <div>GDV: {fmtGBP(deal.gdv)} · LTV: {Math.round(((deal.gdv ? (deal.property.inputs?.refiLtv ?? 0) : 0)))}%</div>
      <div>Cash in: {fmtGBP(deal.totalCashIn)} · Out: {fmtGBP(deal.cashOut)} · Left in: {fmtGBP(deal.cashLeftIn)}</div>
      {deal.assignedTo && <div className="text-muted-foreground">Refi cash assigned</div>}
    </div>
  );

  return (
    <div className="flex" style={{ height: rowHeight }}>
      <div style={{ width: labelCol }} className="flex items-center gap-2 border-r border-border px-3">
        <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[deal.status]}`} />
        <button
          className="text-sm font-medium truncate text-left hover:underline"
          title={deal.property.name}
          onClick={onOpenRefi}
        >{deal.property.name}</button>
      </div>
      <div
        className="relative flex-1"
        style={{ height: rowHeight }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* row gridlines */}
        <div className="absolute inset-0 pointer-events-none" />
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* refurb / hold bar */}
              <div
                className={`absolute rounded ${refurbColor} ${locked ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"} shadow-sm flex items-center px-2 text-[10px] font-medium text-white/95 overflow-hidden`}
                style={{ top: 12, height: 22, left: effPurchaseX, width: Math.max(2, effRefiX - effPurchaseX) }}
                onPointerDown={(e) => onPointerDown(e, "bar")}
              >
                <span className="truncate">In {fmtShort(deal.totalCashIn)}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* post-refi hold */}
        <div
          className="absolute rounded bg-emerald-500/55 border border-emerald-600/30"
          style={{ top: 12, height: 22, left: effRefiX, width: Math.max(2, effEndX - effRefiX) }}
          title="Post-refi hold"
        />

        {/* refi marker */}
        <button
          onClick={onOpenRefi}
          onPointerDown={(e) => onPointerDown(e, "refi")}
          className={`absolute -translate-x-1/2 group ${locked ? "cursor-pointer" : "cursor-ew-resize"}`}
          style={{ top: 6, left: effRefiX, height: 34 }}
          title={`Refi: ${fmtGBP(deal.cashOut)} pulled out`}
        >
          <div className="h-full w-0.5 bg-foreground" />
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-foreground ring-2 ring-card" />
        </button>
        <div className="absolute pointer-events-none text-[10px] font-semibold whitespace-nowrap" style={{ top: 38, left: effRefiX, transform: "translateX(-50%)", color: deal.cashOut > 0 ? "hsl(140 70% 35%)" : "hsl(0 70% 50%)" }}>
          Out {fmtShort(deal.cashOut)}
        </div>

        {/* Drag preview month chip */}
        {drag && (
          <div className="absolute top-0 left-0 px-2 py-0.5 rounded bg-foreground text-background text-[10px] pointer-events-none" style={{ left: drag.type === "refi" ? effRefiX : effPurchaseX, transform: "translateX(-50%)" }}>
            {drag.type === "refi" ? `+${effRefiOffset}m` : addMonths(deal.purchaseDate, Math.round((effPurchaseX - purchaseX)/pxPerMonth)).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}
          </div>
        )}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 px-3 py-3 text-xs text-muted-foreground border-t border-border">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded bg-amber-500/70" /> Purchase + refurb</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded bg-rose-500/70" /> Bridge hold</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded bg-emerald-500/55" /> Post-refi hold</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-foreground" /> Refi event (click)</span>
    </div>
  );
}

/* ---------- refi drill-down ---------- */

function RefiDrillSheet({
  open, deal, allDeals, onClose, onSave, onSaveProperty,
}: {
  open: boolean;
  deal: DealRow | null;
  allDeals: DealRow[];
  onClose: () => void;
  onSave: (patch: Partial<TimelineEntry>) => void;
  onSaveProperty: (propertyId: string, patch: { name?: string; inputs: Record<string, any> }) => Promise<void>;
}) {
  const [purchaseDate, setPurchaseDate] = useState("");
  const [refiOffset, setRefiOffset] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("__none");
  const [status, setStatus] = useState<TimelineStatus>("planned");
  const [notes, setNotes] = useState("");
  const [name, setName] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [gdv, setGdv] = useState("");
  const [refiLtv, setRefiLtv] = useState("");
  const [refurbMonths, setRefurbMonths] = useState("");
  const [refurbCost, setRefurbCost] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!deal) return;
    setPurchaseDate(deal.entry?.purchase_date ?? deal.purchaseDate.toISOString().slice(0,10));
    setRefiOffset(String(deal.entry?.refi_month_offset ?? (deal.useBridge ? deal.bridgeMonths : deal.refurbMonths)));
    setAssignedTo(deal.assignedTo ?? "__none");
    setStatus(deal.status);
    setNotes(deal.entry?.notes ?? "");
    const inp = deal.property.inputs ?? {};
    setName(deal.property.name ?? "");
    setPurchasePrice(String(inp.purchasePrice ?? ""));
    setGdv(String(inp.gdv ?? ""));
    setRefiLtv(String(inp.refiLtv ?? ""));
    setRefurbMonths(String(inp.refurbMonths ?? ""));
    setRefurbCost(String(inp.refurbCost ?? ""));
    setMonthlyRent(String(inp.monthlyRent ?? inp.currentMonthlyRent ?? ""));
  }, [deal]);

  if (!deal) return null;

  const target = assignedTo !== "__none" ? allDeals.find((d) => d.property.id === assignedTo) ?? null : null;
  const need = target?.totalCashIn ?? 0;
  const delta = target ? deal.cashOut - need : 0;
  const gapDays = target ? Math.round((target.purchaseDate.getTime() - deal.refiDate.getTime()) / (1000*60*60*24)) : null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {deal.property.name}
            <Link to="/refinance" search={{ id: deal.property.id } as any} className="text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" /></Link>
          </SheetTitle>
          <SheetDescription>
            Cash in {fmtGBP(deal.totalCashIn)} → Refi pulls {fmtGBP(deal.cashOut)} ({deal.refiDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}) → Left in {fmtGBP(deal.cashLeftIn)}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="rounded-lg border p-3 space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Deal details</div>
            <div><Label htmlFor="dname">Name</Label><Input id="dname" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Purchase price (£)</Label><Input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} /></div>
              <div><Label>GDV (£)</Label><Input type="number" value={gdv} onChange={(e) => setGdv(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Refi LTV (%)</Label><Input type="number" value={refiLtv} onChange={(e) => setRefiLtv(e.target.value)} /></div>
              <div><Label>Refurb (months)</Label><Input type="number" value={refurbMonths} onChange={(e) => setRefurbMonths(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Refurb cost (£)</Label><Input type="number" value={refurbCost} onChange={(e) => setRefurbCost(e.target.value)} /></div>
              <div><Label>Monthly rent (£)</Label><Input type="number" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} /></div>
            </div>
            <p className="text-[11px] text-muted-foreground">Full model lives on the <Link to="/refinance" search={{ id: deal.property.id } as any} className="underline">Refinance page</Link>.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pdate">Purchase date</Label>
              <Input id="pdate" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="roff">Refi month</Label>
              <Input id="roff" type="number" min={0} value={refiOffset} onChange={(e) => setRefiOffset(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TimelineStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Redeploy pull-out</div>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Reserve (uncommitted)</SelectItem>
                {allDeals.filter((d) => d.property.id !== deal.property.id).map((d) => (
                  <SelectItem key={d.property.id} value={d.property.id}>{d.property.name} — needs {fmtShort(d.totalCashIn)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {target ? (
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Available</span><span className="tabular-nums">{deal.refiDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} — {fmtGBP(deal.cashOut)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Needed by</span><span className="tabular-nums">{target.purchaseDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} — {fmtGBP(need)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Gap</span><span className="tabular-nums">{gapDays != null ? `${gapDays > 0 ? "+" : ""}${gapDays}d` : "—"}</span></div>
                <div className="pt-1">
                  {Math.abs(delta) < 1000 && <Badge className="bg-emerald-500 hover:bg-emerald-500">On track</Badge>}
                  {delta <= -1000 && <Badge variant="destructive">Short {fmtGBP(Math.abs(delta))}</Badge>}
                  {delta >= 1000 && <Badge className="bg-sky-500 hover:bg-sky-500">Surplus {fmtGBP(delta)}</Badge>}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Assign this cash to another portfolio deal to see the gap and any shortfall.</p>
            )}
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>

        <SheetFooter className="mt-6 flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button disabled={saving} onClick={async () => {
            setSaving(true);
            const num = (s: string) => s === "" ? undefined : Number(s);
            const inputsPatch: Record<string, any> = {};
            if (num(purchasePrice) !== undefined) inputsPatch.purchasePrice = num(purchasePrice);
            if (num(gdv) !== undefined) inputsPatch.gdv = num(gdv);
            if (num(refiLtv) !== undefined) inputsPatch.refiLtv = num(refiLtv);
            if (num(refurbMonths) !== undefined) inputsPatch.refurbMonths = num(refurbMonths);
            if (num(refurbCost) !== undefined) inputsPatch.refurbCost = num(refurbCost);
            if (num(monthlyRent) !== undefined) inputsPatch.monthlyRent = num(monthlyRent);
            await onSaveProperty(deal.property.id, { name: name.trim() || undefined, inputs: inputsPatch });
            await onSave({
              purchase_date: purchaseDate || null,
              refi_month_offset: refiOffset === "" ? null : Number(refiOffset),
              assigned_to_property_id: assignedTo === "__none" ? null : assignedTo,
              status,
              notes: notes || null,
            });
            setSaving(false);
            toast.success("Saved");
            onClose();
          }}>Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ---------- add planned deal ---------- */

function AddPlannedDealSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [gdv, setGdv] = useState("");
  const [refiLtv, setRefiLtv] = useState("75");
  const [refurbMonths, setRefurbMonths] = useState("4");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0,10));
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim() || !purchasePrice) { toast.error("Name and purchase price are required"); return; }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); toast.error("Sign in required"); return; }
    const inputs = {
      purchasePrice: Number(purchasePrice),
      depositPct: 25, depositIsPct: true, deposit: 0,
      gdv: Number(gdv || purchasePrice), refiLtv: Number(refiLtv),
      refurbMonths: Number(refurbMonths),
      refurbCost: 0, holdingMonthly: 0,
      stampDuty: 0, legalFees: 0, surveyFees: 0,
      fixturesFittings: 0, furnishing: 0, brokerFees: 0, lenderFee: 0, additionalFees: 0, auctionFees: 0, sourcingFee: 0,
      purchaseRate: 5,
      useBridge: false, bridgeLoanPct: 0, bridgeFundsRefurb: false, bridgeRate: 0, bridgeRatePCM: 0, bridgeRateIsPCM: false, bridgeTermMonths: 0, bridgeArrangementPct: 0, bridgeArrangementIsPct: true, bridgeArrangementAmount: 0, bridgeExitPct: 0, bridgeInterestRolled: true,
      refiRate: 5.5, refiTermYears: 25, refiFees: 0,
      lettableUnits: 1, currentMonthlyRent: 0, monthlyRent: 0, managementPct: 0, maintenancePct: 0, voidsPct: 0, insurance: 0, groundRent: 0, otherMonthly: 0,
      flipEnabled: false, flipSalePrice: 0, flipLegalFees: 0, flipAgencyFee: 0,
    };
    const { data: prop, error } = await supabase.from("properties").insert({
      name: name.trim(), inputs, metrics: {}, in_portfolio: true, source: "planned",
    }).select().single();
    if (error || !prop) { setSaving(false); toast.error(error?.message ?? "Failed"); return; }
    await supabase.from("portfolio_timeline_entries").insert({
      user_id: session.user.id,
      property_id: prop.id,
      purchase_date: purchaseDate,
      refi_month_offset: Number(refurbMonths),
      status: "planned",
    });
    setSaving(false);
    toast.success("Added");
    setName(""); setPurchasePrice(""); setGdv("");
    onCreated();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add planned deal</SheetTitle>
          <SheetDescription>Sketch in a future deal so it appears on the timeline. You can model it properly later.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Next BRRR — Manchester" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Purchase date</Label><Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></div>
            <div><Label>Refurb (months)</Label><Input type="number" min={0} value={refurbMonths} onChange={(e) => setRefurbMonths(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Purchase price (£)</Label><Input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} /></div>
            <div><Label>GDV (£)</Label><Input type="number" value={gdv} onChange={(e) => setGdv(e.target.value)} /></div>
          </div>
          <div><Label>Refi LTV (%)</Label><Input type="number" value={refiLtv} onChange={(e) => setRefiLtv(e.target.value)} /></div>
        </div>
        <SheetFooter className="mt-6 flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
