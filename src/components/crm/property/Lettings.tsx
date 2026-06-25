import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  type Unit, type UnitStatus, type Tenant, type Property,
  UNIT_STATUSES, UNIT_STATUS_LABEL, UNIT_STATUS_COLOR, fmtGBP,
} from "./types";

export function LettingsBoard() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [props, setProps] = useState<Record<string, Property>>({});

  useEffect(() => {
    (async () => {
      const [u, t, p] = await Promise.all([
        supabase.from("crm_units").select("*"),
        supabase.from("crm_tenants").select("*"),
        supabase.from("crm_properties").select("*"),
      ]);
      setUnits((u.data as Unit[]) ?? []);
      setTenants((t.data as Tenant[]) ?? []);
      const map: Record<string, Property> = {};
      (p.data ?? []).forEach((x: any) => { map[x.id] = x; });
      setProps(map);
    })();
  }, []);

  const grouped = useMemo(() => {
    const m = Object.fromEntries(UNIT_STATUSES.map((s) => [s, [] as Unit[]])) as Record<UnitStatus, Unit[]>;
    units.forEach((u) => m[u.status].push(u));
    return m;
  }, [units]);

  const move = async (id: string, status: UnitStatus) => {
    const { error } = await supabase.from("crm_units").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    setUnits((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)));
  };

  const totalRent = tenants.filter((t) => t.status === "current").reduce((a, b) => a + (b.rent_pcm ?? 0), 0);
  const arrears = tenants.reduce((a, b) => a + (b.arrears_amount ?? 0), 0);
  const occupied = units.filter((u) => u.status === "let").length;
  const occRate = units.length ? Math.round((occupied / units.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI label="Units" value={units.length.toString()} />
        <KPI label="Occupancy" value={`${occRate}%`} />
        <KPI label="Monthly rent" value={fmtGBP(totalRent)} />
        <KPI label="Arrears" value={fmtGBP(arrears)} className={arrears > 0 ? "border-rose-500/30" : ""} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {UNIT_STATUSES.map((s) => (
          <div key={s} className="rounded-lg border border-border bg-muted/20 p-2">
            <div className="mb-2">
              <Badge variant="outline" className={UNIT_STATUS_COLOR[s]}>{UNIT_STATUS_LABEL[s]}</Badge>
              <span className="ml-2 text-xs text-muted-foreground">{grouped[s].length}</span>
            </div>
            <div className="space-y-2">
              {grouped[s].map((u) => {
                const prop = props[u.property_id];
                const t = tenants.find((x) => x.unit_id === u.id);
                return (
                  <Card key={u.id} className="p-2">
                    <p className="truncate text-xs font-medium">{prop?.address ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{u.label} · {fmtGBP(u.rent_pcm)} pcm</p>
                    {t && <p className="mt-1 truncate text-[10px] text-foreground">{t.full_name}</p>}
                    {t && t.arrears_amount > 0 && <p className="text-[10px] text-rose-400">Arrears: {fmtGBP(t.arrears_amount)}</p>}
                    <div className="mt-1">
                      <Select value={u.status} onValueChange={(v) => move(u.id, v as UnitStatus)}>
                        <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UNIT_STATUSES.map((x) => <SelectItem key={x} value={x}>{UNIT_STATUS_LABEL[x]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KPI({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <Card className={`p-3 ${className}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </Card>
  );
}