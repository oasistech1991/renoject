import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

async function geocodeOne(address: string): Promise<{ lat: number; lng: number; formatted: string } | null> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovableKey || !mapsKey) return null;
  const res = await fetch(
    `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=uk`,
    {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": mapsKey,
      },
    },
  );
  if (!res.ok) return null;
  const json: any = await res.json().catch(() => null);
  const r = json?.results?.[0];
  if (!r?.geometry?.location) return null;
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    formatted: r.formatted_address ?? address,
  };
}

export const geocodeProperties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ propertyIds: z.array(z.string().uuid()).min(1).max(25) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("properties")
      .select("id, name, inputs, lat, lng")
      .in("id", data.propertyIds);
    if (error) throw new Error(error.message);

    const updated: Array<{ id: string; lat: number; lng: number }> = [];

    for (const row of rows ?? []) {
      if (row.lat != null && row.lng != null) {
        updated.push({ id: row.id, lat: row.lat, lng: row.lng });
        continue;
      }
      const inputs = (row.inputs ?? {}) as Record<string, any>;
      const parts = [inputs.address, inputs.postcode, inputs.town, inputs.city, row.name]
        .filter((p): p is string => typeof p === "string" && p.trim().length > 0);
      const address = parts.join(", ");
      if (!address) continue;
      const result = await geocodeOne(address);
      if (!result) continue;
      const { error: upErr } = await supabase
        .from("properties")
        .update({
          lat: result.lat,
          lng: result.lng,
          geocoded_address: result.formatted,
          geocoded_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (!upErr) updated.push({ id: row.id, lat: result.lat, lng: result.lng });
    }

    return { updated };
  });