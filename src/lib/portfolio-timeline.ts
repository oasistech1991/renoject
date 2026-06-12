import { calculateRefinance, type RefinanceInputs } from "./refinance";

export type TimelineStatus = "planned" | "live" | "refinanced" | "sold";

export interface TimelineEntry {
  id: string;
  property_id: string;
  purchase_date: string | null; // YYYY-MM-DD
  refi_month_offset: number | null;
  assigned_to_property_id: string | null;
  status: TimelineStatus;
  notes: string | null;
}

export interface PropertyLite {
  id: string;
  name: string;
  inputs: Partial<RefinanceInputs> & Record<string, any>;
  metrics: any;
  in_portfolio?: boolean | null;
  created_at: string;
}

export interface DealRow {
  property: PropertyLite;
  entry: TimelineEntry | null;
  purchaseDate: Date;
  refiDate: Date;
  endDate: Date;
  refurbMonths: number;
  bridgeMonths: number;
  useBridge: boolean;
  totalCashIn: number;
  cashOut: number;
  cashLeftIn: number;
  gdv: number;
  purchasePrice: number;
  status: TimelineStatus;
  assignedTo: string | null;
}

function parseDate(s: string | null | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

function addMonths(d: Date, m: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + m);
  return r;
}

export function buildDealRow(property: PropertyLite, entry: TimelineEntry | null): DealRow {
  const inputs = property.inputs || {};
  const refurbMonths = Number(inputs.refurbMonths ?? 0);
  const useBridge = !!inputs.useBridge;
  const bridgeMonths = useBridge ? Math.max(refurbMonths, Number(inputs.bridgeTermMonths ?? refurbMonths)) : 0;
  const refiOffset = entry?.refi_month_offset ?? (useBridge ? bridgeMonths : refurbMonths);

  const purchaseDate = parseDate(entry?.purchase_date, new Date(property.created_at));
  const refiDate = addMonths(purchaseDate, refiOffset || 0);
  const endDate = addMonths(refiDate, 24); // 2yr post-refi hold for display

  // Compute fresh metrics
  let totalCashIn = Number(property.metrics?.totalCashIn ?? 0);
  let cashLeftIn = Number(property.metrics?.cashLeftIn ?? 0);
  let cashReleased = Number(property.metrics?.cashReleased ?? 0);
  try {
    if (inputs.purchasePrice) {
      const r = calculateRefinance(inputs as RefinanceInputs);
      totalCashIn = r.totalCashIn;
      cashLeftIn = r.cashLeftIn;
      cashReleased = r.cashReleased;
    }
  } catch {}

  return {
    property,
    entry,
    purchaseDate,
    refiDate,
    endDate,
    refurbMonths,
    bridgeMonths,
    useBridge,
    totalCashIn,
    cashOut: Math.max(0, cashReleased),
    cashLeftIn,
    gdv: Number(inputs.gdv ?? 0),
    purchasePrice: Number(inputs.purchasePrice ?? 0),
    status: (entry?.status as TimelineStatus) ?? "planned",
    assignedTo: entry?.assigned_to_property_id ?? null,
  };
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

export interface CapitalInjection {
  id?: string;
  date: string; // YYYY-MM-DD
  amount: number;
  label?: string | null;
}

export interface BalancePoint {
  month: string;
  date: Date;
  deployed: number;
  released: number;
  injected: number;
  balance: number;
}

/** Running monthly cash balance = starting capital + injections + refi releases - deployments. */
export function buildBalanceSeries(
  deals: DealRow[],
  startingCapital: number,
  startingDate: Date,
  injections: CapitalInjection[],
  axisMonths?: Date[],
): BalancePoint[] {
  // Determine the month range
  let months: Date[];
  if (axisMonths && axisMonths.length) {
    months = axisMonths.map((d) => {
      const r = new Date(d); r.setDate(1); r.setHours(0, 0, 0, 0); return r;
    });
  } else {
    const candidates: number[] = [startingDate.getTime()];
    for (const d of deals) {
      candidates.push(d.purchaseDate.getTime(), d.refiDate.getTime());
    }
    for (const inj of injections) {
      const dt = new Date(inj.date).getTime();
      if (!isNaN(dt)) candidates.push(dt);
    }
    const start = new Date(Math.min(...candidates));
    start.setDate(1); start.setHours(0, 0, 0, 0);
    const end = new Date(Math.max(...candidates));
    end.setMonth(end.getMonth() + 6);
    months = [];
    for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
      months.push(new Date(d));
    }
  }

  const deployByKey = new Map<string, number>();
  const releaseByKey = new Map<string, number>();
  const injectByKey = new Map<string, number>();
  for (const deal of deals) {
    const pk = monthKey(deal.purchaseDate);
    deployByKey.set(pk, (deployByKey.get(pk) ?? 0) + deal.totalCashIn);
    if (deal.cashOut > 0) {
      const rk = monthKey(deal.refiDate);
      releaseByKey.set(rk, (releaseByKey.get(rk) ?? 0) + deal.cashOut);
    }
  }
  for (const inj of injections) {
    const dt = new Date(inj.date);
    if (isNaN(dt.getTime())) continue;
    const k = monthKey(dt);
    injectByKey.set(k, (injectByKey.get(k) ?? 0) + Number(inj.amount || 0));
  }

  const startKey = monthKey(startingDate);
  let balance = 0;
  let seeded = false;
  return months.map((d) => {
    const k = monthKey(d);
    if (!seeded && k >= startKey) {
      balance += startingCapital;
      seeded = true;
    }
    const deployed = deployByKey.get(k) ?? 0;
    const released = releaseByKey.get(k) ?? 0;
    const injected = injectByKey.get(k) ?? 0;
    balance += injected + released - deployed;
    return {
      month: monthLabel(d),
      date: new Date(d),
      deployed,
      released,
      injected,
      balance,
    };
  });
}

/** Build month-by-month cash series for cumulative chart. */
export function buildCashSeries(deals: DealRow[]): Array<{
  month: string;
  date: Date;
  deployed: number;
  released: number;
  freeCapital: number;
}> {
  if (deals.length === 0) return [];
  const start = new Date(Math.min(...deals.map((d) => d.purchaseDate.getTime())));
  start.setDate(1);
  const end = new Date(Math.max(...deals.map((d) => d.refiDate.getTime())));
  end.setMonth(end.getMonth() + 6);

  const months: Date[] = [];
  for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
    months.push(new Date(d));
  }

  // Build per-month deltas
  const deployByKey = new Map<string, number>();
  const releaseByKey = new Map<string, number>();
  for (const deal of deals) {
    const pk = monthKey(deal.purchaseDate);
    deployByKey.set(pk, (deployByKey.get(pk) ?? 0) + deal.totalCashIn);
    if (deal.cashOut > 0) {
      const rk = monthKey(deal.refiDate);
      releaseByKey.set(rk, (releaseByKey.get(rk) ?? 0) + deal.cashOut);
    }
  }

  let cum = 0;
  return months.map((d) => {
    const k = monthKey(d);
    const deployed = deployByKey.get(k) ?? 0;
    const released = releaseByKey.get(k) ?? 0;
    cum += released - deployed;
    return {
      month: monthLabel(d),
      date: new Date(d),
      deployed,
      released,
      freeCapital: cum,
    };
  });
}

export interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

export function buildSankey(deals: DealRow[]): { nodes: { name: string }[]; links: SankeyLink[] } {
  const nodes: { name: string }[] = [{ name: "Starting capital" }];
  const idx = new Map<string, number>();
  for (const d of deals) {
    idx.set(d.property.id, nodes.length);
    nodes.push({ name: d.property.name || "Untitled" });
  }
  const reserveIdx = nodes.length;
  nodes.push({ name: "Reserve" });

  const links: SankeyLink[] = [];

  // Starting capital → each deal (totalCashIn) when no source feeds it
  const fundedFrom = new Map<string, number>(); // property_id -> total inflow from other deals

  for (const d of deals) {
    if (d.assignedTo && idx.has(d.assignedTo)) {
      const target = idx.get(d.assignedTo)!;
      const src = idx.get(d.property.id)!;
      const value = Math.max(1, d.cashOut);
      links.push({ source: src, target, value });
      fundedFrom.set(d.assignedTo, (fundedFrom.get(d.assignedTo) ?? 0) + d.cashOut);
    }
  }

  for (const d of deals) {
    const need = d.totalCashIn;
    const received = fundedFrom.get(d.property.id) ?? 0;
    const fromStart = Math.max(0, need - received);
    if (fromStart > 0) {
      links.push({ source: 0, target: idx.get(d.property.id)!, value: Math.max(1, fromStart) });
    }
  }

  // Unassigned surplus from each deal → Reserve
  for (const d of deals) {
    if (!d.assignedTo && d.cashOut > 0) {
      links.push({ source: idx.get(d.property.id)!, target: reserveIdx, value: Math.max(1, d.cashOut) });
    }
  }

  return { nodes, links };
}

export function redeploymentRows(deals: DealRow[]) {
  const byId = new Map(deals.map((d) => [d.property.id, d]));
  return deals
    .filter((d) => d.cashOut > 0)
    .sort((a, b) => a.refiDate.getTime() - b.refiDate.getTime())
    .map((d) => {
      const target = d.assignedTo ? byId.get(d.assignedTo) : null;
      const need = target?.totalCashIn ?? 0;
      const gap = target ? Math.round((target.purchaseDate.getTime() - d.refiDate.getTime()) / (1000 * 60 * 60 * 24 * 30)) : null;
      let status: "on-track" | "short" | "surplus" | "unassigned" = "unassigned";
      let delta = 0;
      if (target) {
        delta = d.cashOut - need;
        if (Math.abs(delta) < 1000) status = "on-track";
        else if (delta < 0) status = "short";
        else status = "surplus";
      }
      return { deal: d, target, gap, status, delta };
    });
}