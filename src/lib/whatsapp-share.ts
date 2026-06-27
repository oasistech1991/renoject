import { fmtGBP, fmtPct } from "@/lib/btl";
import { dealTypeMeta } from "@/lib/feed";

export type ShareablePost = {
  id: string;
  caption: string | null;
  deal_type: string | null;
  hidden_fields: string[];
  property: {
    name: string;
    inputs: any;
    metrics: any;
  } | null;
};

/**
 * Build the WhatsApp caption for a feed deal.
 * Respects `hidden_fields` so teaser deals don't leak price/address.
 */
export function buildWhatsAppCaption(post: ShareablePost, shareUrl: string): string {
  const meta = dealTypeMeta(post.deal_type);
  const prop = post.property;
  const inputs = prop?.inputs ?? {};
  const metrics = prop?.metrics ?? {};
  const hidden = new Set(post.hidden_fields ?? []);

  const name = prop?.name ?? "New Renoject deal";

  const stats: string[] = [];
  if (!hidden.has("purchasePrice") && inputs.purchasePrice) {
    stats.push(`PP ${fmtGBP(inputs.purchasePrice)}`);
  }
  if (inputs.bedrooms) stats.push(`${inputs.bedrooms} bed`);
  if (metrics.roiOnCashLeftIn) stats.push(`${fmtPct(metrics.roiOnCashLeftIn)} ROI`);
  if (metrics.monthlyCashflowIO) stats.push(`${fmtGBP(metrics.monthlyCashflowIO)}/m cashflow`);

  const teaser = (post.caption ?? "").trim().slice(0, 240);

  return [
    `🏠 *${meta.label}* — ${name}`,
    stats.length ? stats.join(" · ") : null,
    teaser || null,
    "",
    `👉 Full breakdown: ${shareUrl}`,
    "",
    "— Renoject",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Build a wa.me link. If `phone` is provided, sends to that number/group. */
export function buildWhatsAppLink(caption: string, phone?: string | null): string {
  const base = phone ? `https://wa.me/${phone.replace(/[^0-9]/g, "")}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(caption)}`;
}

/** Build the trackable feed deep-link for a shared post. */
export function buildTrackedShareUrl(opts: {
  origin: string;
  postId: string;
  linkId: string;
}): string {
  return `${opts.origin}/feed?post=${opts.postId}&src=wa&c=${opts.linkId}`;
}