import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtGBP, expiryStatus, type Tenant, type Unit, type ComplianceItem } from "./types";
import { AlertCircle, Calendar, ShieldCheck, Wallet } from "lucide-react";

type Task = { id: string; title: string; due_at: string | null; status: string };

export function HomeBoard({ onJump }: { onJump: (key: string) => void }) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [comp, setComp] = useState<ComplianceItem[]>([]);

  useEffect(() => {
    (async () => {
      const [u, t, k, c] = await Promise.all([
        supabase.from("crm_units").select("*"),
        supabase.from("crm_tenants").select("*"),
        supabase.from("crm_tasks").select("id,title,due_at,status").eq("status", "open"),
        supabase.from("crm_compliance_items").select("*"),
      ]);
      setUnits((u.data as Unit[]) ?? []);
      setTenants((t.data as Tenant[]) ?? []);
      setTasks((k.data as Task[]) ?? []);
      setComp((c.data as ComplianceItem[]) ?? []);
    })();
  }, []);

  const occRate = units.length ? Math.round((units.filter((x) => x.status === "let").length / units.length) * 100) : 0;
  const monthlyRent = tenants.filter((t) => t.status === "current").reduce((a, b) => a + (b.rent_pcm ?? 0), 0);
  const arrears = tenants.reduce((a, b) => a + (b.arrears_amount ?? 0), 0);
  const now = Date.now();
  const expiringSoon = comp.filter((c) => c.expires_on && (new Date(c.expires_on).getTime() - now) / 86400000 <= 60);
  const overdueTasks = tasks.filter((t) => t.due_at && new Date(t.due_at).getTime() < now);
  const endingTenancies = tenants.filter((t) => t.tenancy_end && (new Date(t.tenancy_end).getTime() - now) / 86400000 <= 60 && t.status === "current");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={<ShieldCheck className="h-4 w-4 text-emerald-400" />} label="Occupancy" value={`${occRate}%`} />
        <Kpi icon={<Wallet className="h-4 w-4 text-orange-400" />} label="Monthly rent" value={fmtGBP(monthlyRent)} />
        <Kpi icon={<AlertCircle className="h-4 w-4 text-rose-400" />} label="Arrears" value={fmtGBP(arrears)} danger={arrears > 0} />
        <Kpi icon={<Calendar className="h-4 w-4 text-amber-400" />} label="Certs expiring 60d" value={expiringSoon.length.toString()} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Tile title="Overdue tasks" count={overdueTasks.length} onClick={() => onJump("tasks")}>
          {overdueTasks.slice(0, 6).map((t) => (
            <Row key={t.id} left={t.title} right={t.due_at ? new Date(t.due_at).toLocaleDateString() : ""} danger />
          ))}
          {overdueTasks.length === 0 && <Empty>All caught up.</Empty>}
        </Tile>
        <Tile title="Tenancies ending in 60 days" count={endingTenancies.length} onClick={() => onJump("tenancies")}>
          {endingTenancies.slice(0, 6).map((t) => (
            <Row key={t.id} left={t.full_name} right={t.tenancy_end ? new Date(t.tenancy_end).toLocaleDateString() : ""} />
          ))}
          {endingTenancies.length === 0 && <Empty>No renewals due.</Empty>}
        </Tile>
        <Tile title="Compliance expiring" count={expiringSoon.length} onClick={() => onJump("compliance")}>
          {expiringSoon.slice(0, 6).map((c) => {
            const s = expiryStatus(c.expires_on);
            return (
              <div key={c.id} className="flex items-center justify-between border-b border-border/40 py-1.5 text-xs last:border-0">
                <span className="text-foreground">{c.type}</span>
                <Badge variant="outline" className={s.color}>{s.label}</Badge>
              </div>
            );
          })}
          {expiringSoon.length === 0 && <Empty>Nothing expiring soon.</Empty>}
        </Tile>
        <Tile title="Cash health" count={null}>
          <Row left="Monthly rent roll" right={fmtGBP(monthlyRent)} />
          <Row left="Arrears" right={fmtGBP(arrears)} danger={arrears > 0} />
          <Row left="Vacant units" right={units.filter((u) => u.status === "vacant").length.toString()} />
          <Row left="Active tenancies" right={tenants.filter((t) => t.status === "current").length.toString()} />
        </Tile>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, danger }: { icon: React.ReactNode; label: string; value: string; danger?: boolean }) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>{icon}
      </div>
      <p className={`mt-1 text-xl font-bold ${danger ? "text-rose-400" : "text-foreground"}`}>{value}</p>
    </Card>
  );
}
function Tile({ title, count, children, onClick }: { title: string; count: number | null; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Card className="p-4">
      <button onClick={onClick} className="mb-2 flex w-full items-center justify-between text-left">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {count !== null && <Badge variant="outline">{count}</Badge>}
      </button>
      <div className="space-y-1">{children}</div>
    </Card>
  );
}
function Row({ left, right, danger }: { left: string; right: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-1.5 text-xs last:border-0">
      <span className="truncate text-foreground">{left}</span>
      <span className={danger ? "text-rose-400" : "text-muted-foreground"}>{right}</span>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-center text-xs text-muted-foreground">{children}</p>;
}