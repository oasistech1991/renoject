import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative" | "accent";
  className?: string;
}

export function MetricCard({ label, value, hint, tone = "default", className }: Props) {
  const toneClass = {
    default: "text-foreground",
    positive: "text-primary",
    negative: "text-destructive",
    accent: "text-accent-foreground",
  }[tone];

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md",
        className,
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-2 text-2xl font-semibold tabular-nums", toneClass)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}