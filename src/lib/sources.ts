export const PROPERTY_SOURCES = [
  { value: "open-market", label: "Open market" },
  { value: "off-market", label: "Off market" },
  { value: "auction", label: "Auction" },
  { value: "direct-to-vendor", label: "Direct to vendor" },
  { value: "agent", label: "Estate agent" },
  { value: "other", label: "Other" },
] as const;

export type PropertySource = (typeof PROPERTY_SOURCES)[number]["value"];

export function sourceLabel(value?: string | null): string {
  if (!value) return "Unspecified";
  return PROPERTY_SOURCES.find((s) => s.value === value)?.label ?? value;
}

// Tailwind classes for a small pill/badge per source. Uses semantic borders
// + tinted backgrounds so it works in both light and dark mode without
// hardcoding raw colors against the page background.
export function sourceBadgeClass(value?: string | null): string {
  switch (value) {
    case "open-market":
      return "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-300";
    case "off-market":
      return "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-300";
    case "auction":
      return "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300";
    case "direct-to-vendor":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300";
    case "agent":
      return "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300";
    case "other":
      return "border-zinc-500/40 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}