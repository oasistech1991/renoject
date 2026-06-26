/// <reference types="google.maps" />
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { geocodeProperties } from "@/lib/geocode.functions";
import { fmtGBP } from "@/lib/btl";
import { DEAL_TYPES, dealTypeMeta, type DealTypeKey } from "@/lib/feed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, Loader2, LayoutGrid } from "lucide-react";

const REGIONS = [
  { key: "nw", label: "North West", prefixes: ["M", "BL", "OL", "SK", "WA", "WN", "PR", "BB", "FY", "LA", "L", "CH", "CW"] },
  { key: "ne", label: "North East", prefixes: ["NE", "SR", "DH", "DL", "TS"] },
  { key: "yh", label: "Yorkshire", prefixes: ["LS", "BD", "HX", "HD", "WF", "S", "DN", "HU", "YO", "HG"] },
  { key: "mid", label: "Midlands", prefixes: ["B", "CV", "DY", "WS", "WV", "DE", "NG", "LE", "NN", "LN", "ST", "TF", "WR", "HR"] },
  { key: "ldn", label: "London", prefixes: ["E", "EC", "N", "NW", "SE", "SW", "W", "WC"] },
  { key: "sth", label: "South", prefixes: ["BN", "RH", "TN", "ME", "CT", "PO", "SO", "BH", "DT", "GU", "RG", "OX", "SL", "HP", "MK", "LU", "AL", "SG", "CB", "IP", "NR", "CO", "SS", "RM", "IG", "DA", "BR", "CR", "KT", "SM", "TW", "UB", "HA", "EN", "WD", "BA", "BS", "EX", "PL", "TQ", "TR"] },
] as const;

type RegionKey = typeof REGIONS[number]["key"];

function regionFor(name: string): RegionKey | null {
  const m = name.toUpperCase().match(/\b([A-Z]{1,2})\d/);
  const prefix = m?.[1];
  if (!prefix) return null;
  for (const r of REGIONS) if (r.prefixes.includes(prefix as never)) return r.key;
  return null;
}

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  minPrice: fallback(z.number(), undefined as unknown as number).optional(),
  maxPrice: fallback(z.number(), undefined as unknown as number).optional(),
  minBeds: fallback(z.number(), undefined as unknown as number).optional(),
  minRoi: fallback(z.number(), undefined as unknown as number).optional(),
  minCash: fallback(z.number(), undefined as unknown as number).optional(),
  status: fallback(z.enum(["all", "live", "upcoming", "sold"]), "all").default("all"),
  types: fallback(z.string().array(), []).default([]),
  regions: fallback(z.string().array(), []).default([]),
});

export const Route = createFileRoute("/market")({
  head: () => ({
    meta: [
      { title: "Deal locations — Renoject" },
      { name: "description", content: "Browse Renoject deals by location on an interactive map." },
    ],
  }),
  validateSearch: zodValidator(searchSchema),
  component: DealLocationPage,
});

type Deal = {
  postId: string;
  propertyId: string;
  name: string;
  dealType: string | null;
  isUpcoming: boolean;
  isSold: boolean;
  price: number;
  rent: number;
  gdv: number;
  beds: number | null;
  roi: number | null;
  cashflow: number | null;
  region: RegionKey | null;
  lat: number | null;
  lng: number | null;
  cover: string | null;
};

declare global { interface Window { __renojectMarketInit?: () => void } }
let mapsLoader: Promise<typeof google.maps> | null = null;
function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google.maps);
  if (mapsLoader) return mapsLoader;
  mapsLoader = new Promise((resolve, reject) => {
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    if (!key) return reject(new Error("Missing Google Maps browser key"));
    window.__renojectMarketInit = () => resolve((window as any).google.maps);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__renojectMarketInit${channel ? `&channel=${channel}` : ""}`;
    s.async = true; s.defer = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return mapsLoader;
}

type Status = "all" | "live" | "upcoming" | "sold";

function DealLocationPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const setParam = <K extends keyof typeof search>(k: K, v: (typeof search)[K]) =>
    navigate({ search: (prev: typeof search) => ({ ...prev, [k]: v }), replace: true });

  const query = search.q;
  const minPrice = search.minPrice;
  const maxPrice = search.maxPrice;
  const minBeds = search.minBeds;
  const minRoi = search.minRoi;
  const minCash = search.minCash;
  const status = search.status;
  const types = useMemo(() => new Set(search.types as DealTypeKey[]), [search.types]);
  const regions = useMemo(() => new Set(search.regions as RegionKey[]), [search.regions]);

  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasSoldField, setHasSoldField] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const geocode = useServerFn(geocodeProperties);
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapInst = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Try a select that includes `status`; fall back gracefully if the
        // column doesn't exist (so the "Sold" chip stays hidden).
        let posts: any[] | null = null;
        let soldField = false;
        const withStatus = await supabase
          .from("feed_posts")
          .select("id, property_id, deal_type, is_upcoming, cover_url, status")
          .eq("is_published", true)
          .order("created_at", { ascending: false })
          .limit(200);
        if (!withStatus.error) {
          posts = withStatus.data as any[];
          soldField = true;
        } else {
          const basic = await supabase
            .from("feed_posts")
            .select("id, property_id, deal_type, is_upcoming, cover_url")
            .eq("is_published", true)
            .order("created_at", { ascending: false })
            .limit(200);
          if (basic.error) throw basic.error;
          posts = basic.data as any[];
        }
        if (!cancelled) setHasSoldField(soldField);
        const ids = Array.from(new Set((posts ?? []).map((p) => p.property_id))).filter(Boolean);
        if (!ids.length) { setLoading(false); return; }
        let { data: props, error: e2 } = await supabase
          .from("properties").select("id, name, inputs, lat, lng").in("id", ids);
        if (e2) throw e2;
        const missingIds = (props ?? []).filter((p) => p.lat == null || p.lng == null).map((p) => p.id);
        if (missingIds.length) {
          try {
            for (let i = 0; i < missingIds.length; i += 20) {
              await geocode({ data: { propertyIds: missingIds.slice(i, i + 20) } });
            }
            const r = await supabase.from("properties").select("id, name, inputs, lat, lng").in("id", ids);
            if (!r.error) props = r.data;
          } catch (err) { console.warn("Geocode failed", err); }
        }
        const map = new Map((props ?? []).map((p) => [p.id, p] as const));
        const next: Deal[] = [];
        for (const post of posts ?? []) {
          const prop = map.get(post.property_id);
          if (!prop) continue;
          const inputs = (prop.inputs ?? {}) as Record<string, any>;
          const rent = Number(inputs.monthlyRent ?? 0);
          const opex = Number(inputs.monthlyOpex ?? inputs.opex ?? 0);
          const cashflow = rent ? Math.round(rent - opex) : null;
          const roi = inputs.roi != null
            ? Number(inputs.roi)
            : inputs.roiAnnual != null
              ? Number(inputs.roiAnnual)
              : null;
          next.push({
            postId: post.id,
            propertyId: prop.id,
            name: prop.name,
            dealType: post.deal_type ?? null,
            isUpcoming: !!post.is_upcoming,
            isSold: post.status === "sold",
            price: Number(inputs.purchasePrice ?? 0),
            rent,
            gdv: Number(inputs.gdv ?? 0),
            beds: inputs.beds != null ? Number(inputs.beds) : (inputs.rooms != null ? Number(inputs.rooms) : null),
            roi,
            cashflow,
            region: regionFor(prop.name ?? ""),
            lat: prop.lat as number | null,
            lng: prop.lng as number | null,
            cover: post.cover_url ?? null,
          });
        }
        if (!cancelled) setDeals(next);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Failed to load deals");
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [geocode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deals.filter((d) => {
      if (q && !d.name.toLowerCase().includes(q)) return false;
      if (minPrice != null && d.price < minPrice) return false;
      if (maxPrice != null && d.price > maxPrice) return false;
      if (minBeds != null && (d.beds == null || d.beds < minBeds)) return false;
      if (minRoi != null && (d.roi == null || d.roi < minRoi)) return false;
      if (minCash != null && (d.cashflow == null || d.cashflow < minCash)) return false;
      if (status === "live" && (d.isUpcoming || d.isSold)) return false;
      if (status === "upcoming" && !d.isUpcoming) return false;
      if (status === "sold" && !d.isSold) return false;
      if (types.size > 0 && !types.has((d.dealType ?? "other") as DealTypeKey)) return false;
      if (regions.size > 0 && (!d.region || !regions.has(d.region))) return false;
      return true;
    });
  }, [deals, query, minPrice, maxPrice, minBeds, minRoi, minCash, status, types, regions]);

  const mappable = useMemo(() => filtered.filter((d) => d.lat != null && d.lng != null), [filtered]);

  // Init map
  useEffect(() => {
    if (!mapEl.current || mapInst.current) return;
    loadGoogleMaps().then((maps) => {
      if (!mapEl.current) return;
      mapInst.current = new maps.Map(mapEl.current, {
        center: { lat: 53.2, lng: -2.0 }, zoom: 6,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
      });
    }).catch((e) => setError(e?.message ?? "Map failed to load"));
  }, []);

  // Sync markers
  useEffect(() => {
    const map = mapInst.current;
    if (!map || typeof google === "undefined") return;
    const next = new Map<string, google.maps.Marker>();
    const bounds = new google.maps.LatLngBounds();
    for (const d of mappable) {
      const meta = dealTypeMeta(d.dealType);
      const existing = markersRef.current.get(d.postId);
      const marker = existing ?? new google.maps.Marker({
        position: { lat: d.lat!, lng: d.lng! }, map, title: d.name,
      });
      const isActive = d.postId === selectedId;
      marker.setIcon({
        path: google.maps.SymbolPath.CIRCLE, scale: isActive ? 11 : 8,
        fillColor: meta.color, fillOpacity: 0.95,
        strokeColor: isActive ? "#ffffff" : "#111", strokeWeight: 2,
      });
      if (!existing) marker.addListener("click", () => setSelectedId(d.postId));
      next.set(d.postId, marker);
      bounds.extend({ lat: d.lat!, lng: d.lng! });
    }
    for (const [id, m] of markersRef.current) if (!next.has(id)) m.setMap(null);
    markersRef.current = next;
    if (mappable.length > 0 && !selectedId) map.fitBounds(bounds, 64);
    else if (selectedId) {
      const sel = mappable.find((d) => d.postId === selectedId);
      if (sel) map.panTo({ lat: sel.lat!, lng: sel.lng! });
    }
  }, [mappable, selectedId]);

  const toggleType = (k: DealTypeKey) => {
    const next = new Set(types);
    next.has(k) ? next.delete(k) : next.add(k);
    setParam("types", Array.from(next));
  };
  const toggleRegion = (k: RegionKey) => {
    const next = new Set(regions);
    next.has(k) ? next.delete(k) : next.add(k);
    setParam("regions", Array.from(next));
  };
  const reset = () => navigate({
    search: { q: "", status: "all", types: [], regions: [], minPrice: undefined, maxPrice: undefined, minBeds: undefined, minRoi: undefined, minCash: undefined },
    replace: true,
  });

  return (
    <div className="min-h-[calc(100vh-49px)] bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-[1600px] space-y-2 px-4 py-3">
          {/* Row 1 — find a deal */}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search by deal name, town or postcode…"
              className="h-9 w-72"
              value={query}
              onChange={(e) => setParam("q", e.target.value)}
            />
            <Sep />
            <span className="text-xs text-muted-foreground">Region:</span>
            {REGIONS.map((r) => (
              <Chip key={r.key} active={regions.has(r.key)} onClick={() => toggleRegion(r.key)}>
                {r.label}
              </Chip>
            ))}
            <Sep />
            <span className="text-xs text-muted-foreground">Status:</span>
            {(["all", "live", "upcoming", ...(hasSoldField ? ["sold" as const] : [])] as Status[]).map((s) => (
              <Chip key={s} active={status === s} onClick={() => setParam("status", s)}>{s}</Chip>
            ))}
            <div className="ml-auto flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">
                <b className="text-foreground">{filtered.length}</b> deal{filtered.length === 1 ? "" : "s"} · <b className="text-foreground">{mappable.length}</b> on map
              </span>
              <Link to="/feed"><Button size="sm" variant="outline" className="gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Feed</Button></Link>
              <Button size="sm" variant="outline" onClick={reset}>Reset</Button>
            </div>
          </div>
          {/* Row 2 — refine */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Deal type:</span>
            {DEAL_TYPES.map((t) => (
              <Chip key={t.key} active={types.has(t.key)} onClick={() => toggleType(t.key)}>
                <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: t.color }} />
                {t.label}
              </Chip>
            ))}
            <Sep />
            <NumInput placeholder="Min £" value={minPrice} onChange={(v) => setParam("minPrice", v)} />
            <NumInput placeholder="Max £" value={maxPrice} onChange={(v) => setParam("maxPrice", v)} />
            <NumInput placeholder="Min beds" value={minBeds} onChange={(v) => setParam("minBeds", v)} className="w-24" />
            <NumInput placeholder="Min ROI %" value={minRoi} onChange={(v) => setParam("minRoi", v)} className="w-28" />
            <NumInput placeholder="Min cashflow £/m" value={minCash} onChange={(v) => setParam("minCash", v)} className="w-36" />
          </div>
        </div>
      </div>

      {error && (
        <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
      )}

      <div className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 lg:grid-cols-[1fr_440px]">
        <div className="relative hidden h-[calc(100vh-220px)] overflow-hidden rounded-xl border border-border bg-card lg:block">
          <div ref={mapEl} className="absolute inset-0" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading deals…
            </div>
          )}
          {!loading && !mappable.length && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
              No deals match these filters. Try resetting or check published deals on the feed.
            </div>
          )}
        </div>

        <div className="h-[calc(100vh-220px)] overflow-y-auto rounded-xl border border-border bg-card p-3">
          {loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No deals match your filters.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((d) => (
                <DealCard key={d.postId} deal={d} active={d.postId === selectedId} onSelect={() => setSelectedId(d.postId)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DealCard({ deal, active, onSelect }: { deal: Deal; active: boolean; onSelect: () => void }) {
  const meta = dealTypeMeta(deal.dealType);
  return (
    <button
      onClick={onSelect}
      className={`flex w-full gap-3 overflow-hidden rounded-lg border bg-background p-2 text-left transition-colors ${active ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"}`}
    >
      {deal.cover ? (
        <img src={deal.cover} alt={deal.name} className="h-20 w-24 flex-shrink-0 rounded-md object-cover" loading="lazy" />
      ) : (
        <div className="flex h-20 w-24 flex-shrink-0 items-center justify-center rounded-md bg-muted">
          <MapPin className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold">{deal.name}</p>
          {deal.isUpcoming && <Badge variant="outline" className="text-[10px]">Upcoming</Badge>}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
          <span className="text-[11px] text-muted-foreground">{meta.label}</span>
          {deal.beds != null && <span className="text-[11px] text-muted-foreground">· {deal.beds} bed</span>}
        </div>
        <div className="mt-1 grid grid-cols-3 gap-1 text-[11px]">
          <Stat label="Price" value={deal.price ? fmtGBP(deal.price) : "—"} />
          <Stat label="GDV" value={deal.gdv ? fmtGBP(deal.gdv) : "—"} />
          <Stat label="Rent" value={deal.rent ? `${fmtGBP(deal.rent)}/m` : "—"} />
        </div>
        <Link to={`/feed`} search={{ post: deal.postId } as never} className="mt-1.5 inline-block text-[11px] font-medium text-primary hover:underline">
          View deal →
        </Link>
      </div>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function NumInput({ placeholder, value, onChange, className }: { placeholder: string; value?: number; onChange: (v?: number) => void; className?: string }) {
  return (
    <Input
      type="number" placeholder={placeholder}
      className={`h-9 w-28 ${className ?? ""}`}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
    />
  );
}
function Sep() { return <span className="mx-1 h-5 w-px bg-border" />; }
function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
    >{children}</button>
  );
}
