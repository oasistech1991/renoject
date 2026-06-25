import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { fmtGBP } from "./types";

export function Reports() {
  const [stats, setStats] = useState({
    totalGDV: 0, totalCost: 0, totalEquity: 0,
    propsByType: {} as Record<string, number>,
    refurbOverrun: 0, avgBudget: 0, projectCount: 0,
    occupancy: 0, monthlyRent: 0, arrears: 0,
    leadConversion: 0,
  });

  useEffect(() => {
    (async () => {
      const [pr, pj, u, t, l] = await Promise.all([
        supabase.from("crm_properties").select("*"),
        supabase.from("crm_projects").select("*"),
        supabase.from("crm_units").select("*"),
        supabase.from("crm_tenants").select("*"),
        supabase.from("crm_leads").select("status"),
      ]);
      const props = (pr.data ?? []) as any[];
      const projs = (pj.data ?? []) as any[];
      const units = (u.data ?? []) as any[];
      const tenants = (t.data ?? []) as any[];
      const leads = (l.data ?? []) as any[];
      const byType: Record<string, number> = {};
      props.forEach((p) => { byType[p.property_type] = (byType[p.property_type] ?? 0) + 1; });
      const overrun = projs.reduce((a, b) => a + Math.max(0, (b.spent ?? 0) - (b.budget ?? 0)), 0);
      const occ = units.length ? units.filter((x) => x.status === "let").length / units.length * 100 : 0;
      const conv = leads.length ? leads.filter((x) => x.status === "converted").length / leads.length * 100 : 0;
      setStats({
        totalGDV: props.reduce((a, b) => a + (b.current_value ?? 0), 0),
        totalCost: props.reduce((a, b) => a + (b.purchase_price ?? 0), 0),
        totalEquity: props.reduce((a, b) => a + (b.equity ?? 0), 0),
        propsByType: byType,
        refurbOverrun: overrun,
        avgBudget: projs.length ? projs.reduce((a, b) => a + (b.budget ?? 0), 0) / projs.length : 0,
        projectCount: projs.length,
        occupancy: occ,
        monthlyRent: tenants.filter((x) => x.status === "current").reduce((a, b) => a + (b.rent_pcm ?? 0), 0),
        arrears: tenants.reduce((a, b) => a + (b.arrears_amount ?? 0), 0),
        leadConversion: conv,
      });
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Portfolio GDV" value={fmtGBP(stats.totalGDV)} />
        <Stat label="Total acquisition cost" value={fmtGBP(stats.totalCost)} />
        <Stat label="Total equity" value={fmtGBP(stats.totalEquity)} />
        <Stat label="Avg project budget" value={fmtGBP(stats.avgBudget)} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Occupancy" value={`${Math.round(stats.occupancy)}%`} />
        <Stat label="Monthly rent" value={fmtGBP(stats.monthlyRent)} />
        <Stat label="Total arrears" value={fmtGBP(stats.arrears)} accent={stats.arrears > 0 ? "danger" : undefined} />
        <Stat label="Lead → investor" value={`${Math.round(stats.leadConversion)}%`} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
        <Card className="p-4">
          <p className="text-sm font-semibold text-foreground">Properties by type</p>
          <div className="mt-3 space-y-2">
            {Object.entries(stats.propsByType).map(([k, v]) => (
              <div key={k} className="flex items-center gap-3 text-sm">
                <span className="w-24 capitalize text-muted-foreground">{k}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-orange-500" style={{ width: `${(v / Math.max(...Object.values(stats.propsByType))) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-foreground">{v}</span>
              </div>
            ))}
            {Object.keys(stats.propsByType).length === 0 && <p className="text-xs text-muted-foreground">No data</p>}
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-semibold text-foreground">Refurb performance</p>
          <div className="mt-3 space-y-2 text-sm">
            <Row k="Active projects" v={stats.projectCount.toString()} />
            <Row k="Total over-budget" v={fmtGBP(stats.refurbOverrun)} danger={stats.refurbOverrun > 0} />
            <Row k="Avg budget" v={fmtGBP(stats.avgBudget)} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "danger" }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accent === "danger" ? "text-rose-400" : "text-foreground"}`}>{value}</p>
    </Card>
  );
}
function Row({ k, v, danger }: { k: string; v: string; danger?: boolean }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className={`font-semibold ${danger ? "text-rose-400" : "text-foreground"}`}>{v}</span></div>;
}