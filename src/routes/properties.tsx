import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { fmtGBP, fmtPct } from "@/lib/btl";
import { fmtROI } from "@/lib/refinance";

export const Route = createFileRoute("/properties")({
  head: () => ({
    meta: [
      { title: "Saved properties — BRRR deals" },
      { name: "description", content: "All your saved BRRR / refinance deals in one place." },
      { property: "og:title", content: "Saved properties" },
      { property: "og:description", content: "All your saved BRRR / refinance deals." },
    ],
  }),
  component: PropertiesPage,
});

type PropertyRow = {
  id: string;
  name: string;
  inputs: any;
  metrics: any;
  created_at: string;
  updated_at: string;
};

function PropertiesPage() {
  const [rows, setRows] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) setError(error.message);
    else setRows((data as PropertyRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    setRows((p) => p.filter((r) => r.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-lg font-semibold leading-tight">Saved properties</h1>
            <p className="text-xs text-muted-foreground">All your BRRR / refinance deals</p>
          </div>
          <Link to="/refinance">
            <Button size="sm">+ New property</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <h2 className="text-base font-semibold">No saved properties yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Open the calculator, name a deal and hit Save.
            </p>
            <div className="mt-4">
              <Link to="/refinance">
                <Button>Open calculator</Button>
              </Link>
            </div>
          </div>
        )}
        {!loading && rows.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((r) => {
              const m = r.metrics ?? {};
              const verdict: string = m.verdictLabel ?? "—";
              const verdictTone =
                m.verdict === "full"
                  ? "bg-primary/10 text-primary border-primary/30"
                  : m.verdict === "partial"
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400"
                    : "bg-destructive/10 text-destructive border-destructive/30";
              return (
                <div key={r.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold">{r.name}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Updated {new Date(r.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${verdictTone}`}>
                      {verdict}
                    </span>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">GDV</dt>
                    <dd className="text-right tabular-nums">{fmtGBP(r.inputs?.gdv ?? 0)}</dd>
                    <dt className="text-muted-foreground">Cash left in</dt>
                    <dd className="text-right tabular-nums">{fmtGBP(Math.max(0, m.cashLeftIn ?? 0))}</dd>
                    <dt className="text-muted-foreground">Cash released</dt>
                    <dd className="text-right tabular-nums">{fmtGBP(m.cashReleased ?? 0)}</dd>
                    <dt className="text-muted-foreground">Gross yield</dt>
                    <dd className="text-right tabular-nums">{fmtPct(m.grossYield ?? 0)}</dd>
                    <dt className="text-muted-foreground">Monthly cashflow</dt>
                    <dd className="text-right tabular-nums">{fmtGBP(m.monthlyCashflowIO ?? 0)}</dd>
                  </dl>
                  <div className="mt-4 flex gap-2">
                    <Link to="/refinance" search={{ id: r.id }} className="flex-1">
                      <Button size="sm" className="w-full">Open</Button>
                    </Link>
                    <Button size="sm" variant="outline" onClick={() => remove(r.id, r.name)}>Delete</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}