import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { fmtGBP, type Tenant, type Unit, type Property } from "./types";

const TENANT_COLOR: Record<string, string> = {
  current: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  past: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  arrears: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  notice: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

export function TenanciesView({ onOpenProperty }: { onOpenProperty: (id: string) => void }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<Record<string, Unit>>({});
  const [props, setProps] = useState<Record<string, Property>>({});
  const [q, setQ] = useState("");

  const load = async () => {
    const [t, u, p] = await Promise.all([
      supabase.from("crm_tenants").select("*").order("tenancy_end", { ascending: true, nullsFirst: false }),
      supabase.from("crm_units").select("*"),
      supabase.from("crm_properties").select("*"),
    ]);
    setTenants((t.data as Tenant[]) ?? []);
    const um: Record<string, Unit> = {}; (u.data ?? []).forEach((x: any) => { um[x.id] = x; });
    const pm: Record<string, Property> = {}; (p.data ?? []).forEach((x: any) => { pm[x.id] = x; });
    setUnits(um); setProps(pm);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const onChanged = () => load();
    window.addEventListener("crm:data-changed", onChanged);
    return () => window.removeEventListener("crm:data-changed", onChanged);
  }, []);

  const filtered = tenants.filter((t) => {
    if (!q) return true;
    const u = t.unit_id ? units[t.unit_id] : null;
    const p = u ? props[u.property_id] : null;
    return [t.full_name, t.email, p?.address].some((s) => s?.toLowerCase().includes(q.toLowerCase()));
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tenant or address…" className="max-w-sm" />
        <span className="text-sm text-muted-foreground">{filtered.length} tenancies</span>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Property / unit</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead className="text-right">Rent pcm</TableHead>
              <TableHead className="text-right">Arrears</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => {
              const u = t.unit_id ? units[t.unit_id] : null;
              const p = u ? props[u.property_id] : null;
              return (
                <TableRow key={t.id} className="cursor-pointer" onClick={() => p && onOpenProperty(p.id)}>
                  <TableCell className="font-medium">{t.full_name}<div className="text-xs text-muted-foreground">{t.email ?? ""}</div></TableCell>
                  <TableCell>{p?.address ?? "—"}<div className="text-xs text-muted-foreground">{u?.label ?? ""}</div></TableCell>
                  <TableCell>{t.tenancy_start ? new Date(t.tenancy_start).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>{t.tenancy_end ? new Date(t.tenancy_end).toLocaleDateString() : "—"}</TableCell>
                  <TableCell className="text-right">{fmtGBP(t.rent_pcm)}</TableCell>
                  <TableCell className={`text-right ${t.arrears_amount > 0 ? "text-rose-400" : ""}`}>{fmtGBP(t.arrears_amount)}</TableCell>
                  <TableCell><Badge variant="outline" className={TENANT_COLOR[t.status] ?? ""}>{t.status}</Badge></TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No tenancies</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}