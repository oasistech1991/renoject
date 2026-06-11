import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Sankey,
  Cell,
} from "recharts";
import { fmtGBP } from "@/lib/btl";
import { toast } from "sonner";
import {
  buildDealRow,
  buildCashSeries,
  buildSankey,
  redeploymentRows,
  type DealRow,
  type PropertyLite,
  type TimelineEntry,
  type TimelineStatus,
} from "@/lib/portfolio-timeline";
import { Loader2 } from "lucide-react";

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
const STATUS_COLORS: Record<TimelineStatus, string> = {
  planned: "bg-slate-500",
  live: "bg-amber-500",
  refinanced: "bg-emerald-500",
  sold: "bg-zinc-500",
};

function PortfolioTimelinePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<PropertyLite[]>([]);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    (async () => {
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
    })();
  }, [session]);

  const deals: DealRow[] = useMemo(() => {
    const byProp = new Map(entries.map((e) => [e.property_id, e]));
    return properties.map((p) => buildDealRow(p, byProp.get(p.id) ?? null));
  }, [properties, entries]);

  const cashSeries = useMemo(() => buildCashSeries(deals), [deals]);
  const sankey = useMemo(() => buildSankey(deals), [deals]);
  const planRows = useMemo(() => redeploymentRows(deals), [deals]);

  const editingDeal = deals.find((d) => d.property.id === editingId) ?? null;

  async function saveEntry(propertyId: string, patch: Partial<TimelineEntry>) {
    if (!session) return;
    const existing = entries.find((e) => e.property_id === propertyId);
    const payload: any = {
      user_id: session.user.id,
      property_id: propertyId,
      purchase_date: patch.purchase_date ?? existing?.purchase_date ?? null,
      refi_month_offset: patch.refi_month_offset ?? existing?.refi_month_offset ?? null,
      assigned_to_property_id: patch.assigned_to_property_id ?? existing?.assigned_to_property_id ?? null,
      status: patch.status ?? existing?.status ?? "planned",
      notes: patch.notes ?? existing?.notes ?? null,
    };
    if (existing) {
      const { data, error } = await supabase
        .from("portfolio_timeline_entries")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) return toast.error(error.message);
      setEntries((p) => p.map((e) => (e.id === existing.id ? (data as any) : e)));
    } else {
      const { data, error } = await supabase
        .from("portfolio_timeline_entries")
        .insert(payload)
        .select()
        .single();
      if (error) return toast.error(error.message);
      setEntries((p) => [...p, data as any]);
    }
    toast.success("Saved");
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Portfolio Timeline</h1>
        <p className="mt-3 text-muted-foreground">
          Sign in to plan refi events and recycled capital across your deals.
        </p>
        <Button asChild className="mt-6">
          <Link to="/auth">Sign in</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (deals.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Portfolio Timeline</h1>
        <p className="mt-3 text-muted-foreground">
          Mark deals as "In portfolio" on the{" "}
          <Link to="/properties" className="underline">
            Saved deals
          </Link>{" "}
          page and they'll appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Portfolio Timeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Map when each deal refinances, how much capital comes out, and which next deal it funds.
        </p>
      </header>

      <section>
        <h2 className="text-lg font-medium mb-3">Deal timeline</h2>
        <GanttView deals={deals} onEdit={setEditingId} />
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Cash deployed vs released</h2>
        <div className="rounded-lg border bg-card p-4">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={cashSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v: number) => `£${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmtGBP(Number(v))} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="deployed" name="Cash deployed" fill="hsl(0 70% 55%)" />
              <Bar dataKey="released" name="Cash released" fill="hsl(140 60% 45%)" />
              <Line type="monotone" dataKey="freeCapital" name="Free capital (running)" stroke="var(--primary)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Capital flow</h2>
        <p className="text-xs text-muted-foreground mb-2">Assign each deal's refi proceeds to another deal in the planner below — flows update here.</p>
        <div className="rounded-lg border bg-card p-4">
          {sankey.links.length > 0 ? (
            <ResponsiveContainer width="100%" height={360}>
              <Sankey
                data={sankey}
                nodePadding={20}
                nodeWidth={12}
                link={{ stroke: "var(--primary)", strokeOpacity: 0.25 }}
                node={<SankeyNode />}
              >
                <Tooltip formatter={(v: number) => fmtGBP(Number(v))} />
              </Sankey>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No capital flows yet.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Redeployment planner</h2>
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Refi date</TableHead>
                <TableHead>Source deal</TableHead>
                <TableHead className="text-right">Cash out</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead className="text-right">Gap</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {planRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    No refi events with cash out yet — make sure each deal has a GDV and refi LTV set.
                  </TableCell>
                </TableRow>
              )}
              {planRows.map(({ deal, target, gap, status, delta }) => (
                <TableRow key={deal.property.id}>
                  <TableCell>{deal.refiDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</TableCell>
                  <TableCell className="font-medium">
                    <button className="underline-offset-2 hover:underline" onClick={() => setEditingId(deal.property.id)}>
                      {deal.property.name}
                    </button>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtGBP(deal.cashOut)}</TableCell>
                  <TableCell>
                    <Select
                      value={deal.assignedTo ?? "__none"}
                      onValueChange={(v) =>
                        saveEntry(deal.property.id, {
                          assigned_to_property_id: v === "__none" ? null : v,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-[200px]">
                        <SelectValue placeholder="Reserve" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Reserve</SelectItem>
                        {deals
                          .filter((d) => d.property.id !== deal.property.id)
                          .map((d) => (
                            <SelectItem key={d.property.id} value={d.property.id}>
                              {d.property.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{gap == null ? "—" : `${gap}m`}</TableCell>
                  <TableCell>
                    {status === "on-track" && <Badge className="bg-emerald-500 hover:bg-emerald-500">On track</Badge>}
                    {status === "short" && <Badge variant="destructive">Short {fmtGBP(Math.abs(delta))}</Badge>}
                    {status === "surplus" && <Badge className="bg-sky-500 hover:bg-sky-500">Surplus {fmtGBP(delta)}</Badge>}
                    {status === "unassigned" && <Badge variant="outline">Unassigned</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <DealEditorSheet
        open={!!editingDeal}
        deal={editingDeal}
        allDeals={deals}
        onClose={() => setEditingId(null)}
        onSave={(patch) => editingDeal && saveEntry(editingDeal.property.id, patch)}
      />
    </div>
  );
}

function SankeyNode(props: any) {
  const { x, y, width, height, index, payload } = props;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill="var(--primary)" fillOpacity={0.7} />
      <text x={x + width + 6} y={y + height / 2} textAnchor="start" dominantBaseline="middle" fontSize={11} fill="var(--foreground)">
        {payload.name}
      </text>
    </g>
  );
}

function GanttView({ deals, onEdit }: { deals: DealRow[]; onEdit: (id: string) => void }) {
  const start = new Date(Math.min(...deals.map((d) => d.purchaseDate.getTime())));
  start.setDate(1);
  const end = new Date(Math.max(...deals.map((d) => d.endDate.getTime())));
  end.setMonth(end.getMonth() + 1);
  const totalMs = end.getTime() - start.getTime();

  const months: Date[] = [];
  for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
    months.push(new Date(d));
  }
  const today = new Date();

  const pct = (d: Date) => ((d.getTime() - start.getTime()) / totalMs) * 100;

  return (
    <div className="rounded-lg border bg-card p-4 overflow-x-auto">
      <div className="min-w-[720px]">
        {/* Month axis */}
        <div className="relative h-6 border-b border-border text-[10px] text-muted-foreground">
          {months.map((m, i) =>
            m.getMonth() === 0 || i === 0 ? (
              <div key={i} className="absolute top-0" style={{ left: `${pct(m)}%` }}>
                <div className="h-3 w-px bg-border" />
                <div className="pl-1">{m.getFullYear()}</div>
              </div>
            ) : null
          )}
          {today >= start && today <= end && (
            <div className="absolute top-0 h-6 w-px bg-primary" style={{ left: `${pct(today)}%` }}>
              <div className="absolute -top-3 left-1 text-[10px] text-primary">Today</div>
            </div>
          )}
        </div>

        {/* Bars */}
        <div className="mt-2 space-y-2">
          {deals.map((d) => {
            const purchasePct = pct(d.purchaseDate);
            const refiPct = pct(d.refiDate);
            const endPct = pct(d.endDate);
            const holdColor = d.useBridge ? "bg-red-500/70" : "bg-amber-500/70";
            return (
              <div key={d.property.id} className="grid grid-cols-[180px_1fr] gap-3 items-center">
                <button
                  className="text-left text-sm font-medium truncate hover:underline"
                  onClick={() => onEdit(d.property.id)}
                  title={d.property.name}
                >
                  <span className={`inline-block h-2 w-2 rounded-full mr-2 ${STATUS_COLORS[d.status]}`} />
                  {d.property.name}
                </button>
                <div className="relative h-7 bg-muted/30 rounded">
                  {today >= start && today <= end && (
                    <div className="absolute top-0 bottom-0 w-px bg-primary/60" style={{ left: `${pct(today)}%` }} />
                  )}
                  {/* Refurb / hold segment */}
                  <div
                    className={`absolute top-1 bottom-1 rounded ${holdColor}`}
                    style={{ left: `${purchasePct}%`, width: `${Math.max(0.5, refiPct - purchasePct)}%` }}
                    title={`${d.useBridge ? "Bridge" : "Purchase"} hold`}
                  />
                  {/* Post-refi hold */}
                  <div
                    className="absolute top-1 bottom-1 rounded bg-emerald-500/60"
                    style={{ left: `${refiPct}%`, width: `${Math.max(0.5, endPct - refiPct)}%` }}
                    title="Post-refi hold"
                  />
                  {/* Refi marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-foreground"
                    style={{ left: `${refiPct}%` }}
                    title={`Refi: ${fmtGBP(d.cashOut)} out`}
                  />
                  <div
                    className="absolute -top-4 text-[10px] text-foreground whitespace-nowrap"
                    style={{ left: `${refiPct}%`, transform: "translateX(-50%)" }}
                  >
                    {fmtGBP(d.cashOut)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded bg-amber-500/70" /> Purchase + refurb</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded bg-red-500/70" /> Bridge hold</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded bg-emerald-500/60" /> Post-refi hold</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-foreground" /> Refi event</span>
        </div>
      </div>
    </div>
  );
}

function DealEditorSheet({
  open,
  deal,
  allDeals,
  onClose,
  onSave,
}: {
  open: boolean;
  deal: DealRow | null;
  allDeals: DealRow[];
  onClose: () => void;
  onSave: (patch: Partial<TimelineEntry>) => void;
}) {
  const [purchaseDate, setPurchaseDate] = useState("");
  const [refiOffset, setRefiOffset] = useState<string>("");
  const [assignedTo, setAssignedTo] = useState<string>("__none");
  const [status, setStatus] = useState<TimelineStatus>("planned");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!deal) return;
    setPurchaseDate(deal.entry?.purchase_date ?? deal.purchaseDate.toISOString().slice(0, 10));
    setRefiOffset(String(deal.entry?.refi_month_offset ?? (deal.useBridge ? deal.bridgeMonths : deal.refurbMonths)));
    setAssignedTo(deal.assignedTo ?? "__none");
    setStatus(deal.status);
    setNotes(deal.entry?.notes ?? "");
  }, [deal]);

  if (!deal) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{deal.property.name}</SheetTitle>
          <SheetDescription>
            Cash in {fmtGBP(deal.totalCashIn)} • Refi pulls out {fmtGBP(deal.cashOut)} • Left in {fmtGBP(deal.cashLeftIn)}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="pdate">Purchase date</Label>
            <Input id="pdate" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="roff">Refi month (from purchase)</Label>
            <Input id="roff" type="number" min={0} value={refiOffset} onChange={(e) => setRefiOffset(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Default {deal.useBridge ? deal.bridgeMonths : deal.refurbMonths}m from the deal model.</p>
          </div>
          <div>
            <Label>Assigned to</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Reserve</SelectItem>
                {allDeals.filter((d) => d.property.id !== deal.property.id).map((d) => (
                  <SelectItem key={d.property.id} value={d.property.id}>{d.property.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TimelineStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>

        <SheetFooter className="mt-6 flex-row gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              onSave({
                purchase_date: purchaseDate || null,
                refi_month_offset: refiOffset === "" ? null : Number(refiOffset),
                assigned_to_property_id: assignedTo === "__none" ? null : assignedTo,
                status,
                notes: notes || null,
              });
              onClose();
            }}
          >
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}