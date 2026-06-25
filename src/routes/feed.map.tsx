import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { geocodeProperties } from "@/lib/geocode.functions";
import { fmtGBP } from "@/lib/btl";
import { dealTypeMeta } from "@/lib/feed";
import { Button } from "@/components/ui/button";
import { LayoutGrid, MapPin, Loader2 } from "lucide-react";

export const Route = createFileRoute("/feed/map")({
  head: () => ({
    meta: [
      { title: "Deal map — Renoject" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: FeedMapPage,
});

type MapPin = {
  postId: string;
  propertyId: string;
  name: string;
  lat: number;
  lng: number;
  price: number;
  dealType: string | null;
};

declare global {
  interface Window { __renojectInitMap?: () => void }
}

let mapsLoader: Promise<typeof google.maps> | null = null;

function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google.maps);
  if (mapsLoader) return mapsLoader;
  mapsLoader = new Promise((resolve, reject) => {
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    if (!key) return reject(new Error("Missing Google Maps browser key"));
    window.__renojectInitMap = () => resolve((window as any).google.maps);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__renojectInitMap${channel ? `&channel=${channel}` : ""}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return mapsLoader;
}

function FeedMapPage() {
  const [pins, setPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const geocode = useServerFn(geocodeProperties);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: posts, error: e1 } = await supabase
          .from("feed_posts")
          .select("id, property_id, deal_type")
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(200);
        if (e1) throw e1;

        const propIds = Array.from(new Set((posts ?? []).map((p) => p.property_id))).filter(Boolean);
        if (!propIds.length) { setLoading(false); return; }

        let { data: props, error: e2 } = await supabase
          .from("properties")
          .select("id, name, inputs, lat, lng")
          .in("id", propIds);
        if (e2) throw e2;

        const missingIds = (props ?? []).filter((p) => p.lat == null || p.lng == null).map((p) => p.id);
        if (missingIds.length) {
          setMissing(missingIds.length);
          try {
            const batches: string[][] = [];
            for (let i = 0; i < missingIds.length; i += 20) batches.push(missingIds.slice(i, i + 20));
            for (const batch of batches) {
              await geocode({ data: { propertyIds: batch } });
            }
            const refresh = await supabase
              .from("properties")
              .select("id, name, inputs, lat, lng")
              .in("id", propIds);
            if (!refresh.error) props = refresh.data;
          } catch (err) {
            console.warn("Geocoding failed", err);
          }
        }

        const propMap = new Map((props ?? []).map((p) => [p.id, p] as const));
        const next: MapPin[] = [];
        for (const post of posts ?? []) {
          const prop = propMap.get(post.property_id);
          if (!prop || prop.lat == null || prop.lng == null) continue;
          const inputs = (prop.inputs ?? {}) as Record<string, any>;
          next.push({
            postId: post.id,
            propertyId: prop.id,
            name: prop.name,
            lat: prop.lat as number,
            lng: prop.lng as number,
            price: Number(inputs.purchasePrice ?? 0),
            dealType: post.deal_type ?? null,
          });
        }
        if (!cancelled) {
          setPins(next);
          setMissing(0);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Failed to load map");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [geocode]);

  // Initialise the map after pins are ready.
  useEffect(() => {
    if (!mapRef.current || !pins.length) return;
    let map: google.maps.Map | null = null;
    let markers: google.maps.Marker[] = [];
    let infoWindow: google.maps.InfoWindow | null = null;

    loadGoogleMaps().then((maps) => {
      if (!mapRef.current) return;
      const bounds = new maps.LatLngBounds();
      pins.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
      map = new maps.Map(mapRef.current, {
        center: bounds.getCenter(),
        zoom: 7,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      infoWindow = new maps.InfoWindow();
      pins.forEach((p) => {
        const meta = dealTypeMeta(p.dealType);
        const marker = new maps.Marker({
          position: { lat: p.lat, lng: p.lng },
          map: map!,
          title: p.name,
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: meta.color,
            fillOpacity: 0.95,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
        marker.addListener("click", () => {
          infoWindow!.setContent(
            `<div style="font-family:system-ui;font-size:13px;min-width:180px">
              <div style="font-weight:600;margin-bottom:4px">${escapeHtml(p.name)}</div>
              <div style="color:#666;margin-bottom:6px">${escapeHtml(meta.label)} · ${fmtGBP(p.price)}</div>
              <a href="/feed?post=${p.postId}" style="color:#F7791E;font-weight:500">View deal →</a>
            </div>`,
          );
          infoWindow!.open({ map: map!, anchor: marker });
        });
        markers.push(marker);
      });
      if (pins.length > 1) map.fitBounds(bounds, 64);
    }).catch((err) => setError(err?.message ?? "Map failed to load"));

    return () => {
      markers.forEach((m) => m.setMap(null));
      infoWindow?.close();
    };
  }, [pins]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    pins.forEach((p) => {
      const key = p.dealType ?? "other";
      m[key] = (m[key] ?? 0) + 1;
    });
    return m;
  }, [pins]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center justify-between border-b border-border bg-card/60 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-sm font-semibold">Deal map</h1>
            <p className="text-xs text-muted-foreground">
              {loading ? (missing ? `Geocoding ${missing} properties…` : "Loading…") : `${pins.length} deal${pins.length === 1 ? "" : "s"} plotted`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/feed">
            <Button size="sm" variant="outline" className="gap-2">
              <LayoutGrid className="h-4 w-4" /> Feed
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="relative flex-1 bg-muted">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing map…
          </div>
        )}
        <div ref={mapRef} className="h-full w-full" />
        {!loading && !pins.length && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            No mappable deals yet. Add an address to a deal and publish it to the feed.
          </div>
        )}
      </div>

      {!!pins.length && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-card/60 px-4 py-2 text-xs">
          {Object.entries(counts).map(([key, n]) => {
            const meta = dealTypeMeta(key);
            return (
              <span key={key} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                {meta.label} · {n}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}