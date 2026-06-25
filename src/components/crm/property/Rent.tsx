import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { fmtGBP, type Tenant, type Unit, type Property, type RentPayment } from "./types";

function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function monthLabel(k: string) { const [y, m] = k.split("-"); return new Date(+y, +m - 1, 1).toLocaleString(undefined, { month: "short", year: "2-digit" }); }

export function RentLedger() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<Record<string, Unit>>({});
  const [props, setProps] = useState<Record<string, Property>>({});
  const [payments, setPayments] = useState<RentPayment[]>([]);
  const [q, setQ] = useState("");

  const load = async () => {
    const [t, u, p, pay] = await Promise.all([
      supabase.from("crm_tenants").select("*").in("status", ["current", "arrears", "notice"]),
      supabase.from("crm_units").select("*"),
      supabase.from("crm_properties").select("*"),
      supabase.from("crm_rent_payments").select("*"),
    ]);
    setTenants((t.data as Tenant[]) ?? []);
    const um: Record<string, Unit> = {}; (u.data ?? []).forEach((x: any) => { um[x.id] = x; });
    const pm: Record<string, Property> = {}; (p.data ?? []).forEach((x: any) => { pm[x.id] = x; });
    setUnits(um); setProps(pm);
    setPayments((pay.data as RentPayment[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const onChanged = () => load();
    window.addEventListener("crm:data-changed", onChanged);
    return () => window.removeEventListener("crm:data-changed", onChanged);
  }, []);

  const months = useMemo(() => {
    const arr: string[] = [];
    const d = new Date(); d.setDate(1);
    for (let i = 5; i >= 0; i--) {
      const dd = new Date(d); dd.setMonth(dd.getMonth() - i);
      arr.push(monthKey(dd));
    }
    return arr;
  }, []);

  const cellFor = (tenantId: string, mk: string) => {
    const ps = payments.filter((p) => p.tenant_id === tenantId && p.due_date.startsWith(mk));
    if (!ps.length) return { status: "none" as const, paid: 0, due: 0 };
    const paid = ps.reduce((a, b) => a + (b.paid_amount ?? 0), 0);
    const due = ps.reduce((a, b) => a + (b.due_amount ?? 0), 0);
    if (paid >= due && due > 0) return { status: "paid" as const, paid, due };
    if (paid > 0) return { status: "partial" as const, paid, due };
    return { status: "overdue" as const, paid, due };
  };

  const recordPayment = async (tenantId: string, mk: string, rentPcm: number) => {
    const amt = window.prompt(`Mark rent paid for ${monthLabel(mk)} (£):`, String(rentPcm));
    if (!amt) return;
    const due_date = `${mk}-01`;
    const { error } = await supabase.from("crm_rent_payments").insert({
      tenant_id: tenantId, due_date, due_amount: rentPcm, paid_amount: Number(amt),
      paid_on: new Date().toISOString().slice(0, 10), method: "manual",
    });
    if (error) return toast.error(error.message);
    toast.success("Payment recorded");
    load();
  };

  const filtered = tenants.filter((t) => {
    if (!q) return true;
    const u = t.unit_id ? units[t.unit_id] : null;
    const p = u ? props[u.property_id] : null;
    return [t.full_name, p?.address].some((s) => s?.toLowerCase().includes(q.toLowerCase()));
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tenant or property…" className="max-w-sm" />
        <span className="text-sm text-muted-foreground">{filtered.length} tenancies · 6-month view</span>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Tenant</th>
              <th className="p-3">Rent</th>
              {months.map((m) => <th key={m} className="p-3 text-center">{monthLabel(m)}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const u = t.unit_id ? units[t.unit_id] : null;
              const p = u ? props[u.property_id] : null;
              return (
                <tr key={t.id} className="border-b border-border/40">
                  <td className="p-3">
                    <div className="font-medium">{t.full_name}</div>
                    <div className="text-xs text-muted-foreground">{p?.address ?? ""}</div>
                  </td>
                  <td className="p-3">{fmtGBP(t.rent_pcm)}</td>
                  {months.map((mk) => {
                    const c = cellFor(t.id, mk);
                    const cls =
                      c.status === "paid" ? "bg-emerald-500/20 text-emerald-300" :
                      c.status === "partial" ? "bg-amber-500/20 text-amber-300" :
                      c.status === "overdue" ? "bg-rose-500/20 text-rose-300" :
                      "bg-muted text-muted-foreground";
                    return (
                      <td key={mk} className="p-2 text-center">
                        <button
                          onClick={() => recordPayment(t.id, mk, t.rent_pcm ?? 0)}
                          className={`w-full rounded-md px-2 py-1 text-[11px] font-medium hover:opacity-80 ${cls}`}
                          title={c.status === "none" ? "No record — click to log" : `Paid ${fmtGBP(c.paid)} / ${fmtGBP(c.due)}`}
                        >
                          {c.status === "none" ? "—" : c.status === "paid" ? "Paid" : c.status === "partial" ? "Part" : "Due"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={2 + months.length} className="p-8 text-center text-muted-foreground">No active tenancies</td></tr>
            )}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted-foreground">Click any cell to log a payment for that month.</p>
      <div className="hidden"><Button /></div>
    </div>
  );
}