import { supabase } from "@/integrations/supabase/client";

export type ReactionKind = "like" | "love" | "fire";
export const REACTION_EMOJI: Record<ReactionKind, string> = {
  like: "👍",
  love: "❤️",
  fire: "🔥",
};

export const HIDABLE_FIELDS = [
  { key: "address", label: "Exact address" },
  { key: "purchasePrice", label: "Purchase price" },
  { key: "lender", label: "Lender details" },
  { key: "refurbCost", label: "Refurb cost" },
] as const;

export type HidableFieldKey = (typeof HIDABLE_FIELDS)[number]["key"];

export const DEAL_TYPES = [
  { key: "btl", label: "Buy to Let", color: "var(--deal-btl)" },
  { key: "turnkey", label: "Turn Key", color: "var(--deal-turnkey)" },
  { key: "offmarket", label: "Off-Market", color: "var(--deal-offmarket)" },
  { key: "mixeduse", label: "Mixed Use", color: "var(--deal-mixeduse)" },
  { key: "hmo", label: "HMO", color: "var(--deal-hmo)" },
  { key: "brr", label: "BRR / Flip", color: "var(--deal-brr)" },
  { key: "other", label: "Other", color: "var(--deal-other)" },
] as const;

export type DealTypeKey = (typeof DEAL_TYPES)[number]["key"];

export function dealTypeMeta(key: string | null | undefined) {
  return DEAL_TYPES.find((d) => d.key === key) ?? DEAL_TYPES[DEAL_TYPES.length - 1];
}

export type FeedPostRow = {
  id: string;
  property_id: string;
  author_id: string;
  caption: string | null;
  cover_url: string | null;
  display_mode: "teaser" | "full";
  hidden_fields: HidableFieldKey[];
  deal_type: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export async function fetchHeroUrl(propertyId: string): Promise<string | null> {
  const { data } = await supabase
    .from("property_media")
    .select("storage_path")
    .eq("property_id", propertyId)
    .eq("is_hero", true)
    .eq("kind", "image")
    .limit(1)
    .maybeSingle();
  if (!data?.storage_path) return null;
  const { data: signed } = await supabase.storage
    .from("property-media")
    .createSignedUrl(data.storage_path, 60 * 60);
  return signed?.signedUrl ?? null;
}
