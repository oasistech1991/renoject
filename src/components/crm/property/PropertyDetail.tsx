import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  type Property, type PropertyStatus, type Project, type Unit, type Tenant,
  PROPERTY_STATUSES, PROPERTY_STATUS_LABEL, PROPERTY_STATUS_COLOR,
  PROJECT_STAGE_LABEL, PROJECT_STAGE_COLOR,
  UNIT_STATUS_LABEL, UNIT_STATUS_COLOR,
  fmtGBP,
} from "./types";

export function PropertyDetailSheet({ propertyId, onClose, onChanged }: {
  propertyId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [p, setP] = useState<Property | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  const load = async (id: string) => {
    const [pr, pj, u] = await Promise.all([
      supabase.from("crm_properties").select("*").eq("id", id).single(),
      supabase.from("crm_projects").select("*").eq("property_id", id).order("created_at", { ascending: false }),
      supabase.from("crm_units").select("*").eq("property_id", id).order("label"),
    ]);
    setP((pr.data as Property) ?? null);
    setProjects((pj.data as Project[]) ?? []);
    setUnits((u.data as Unit[]) ?? []);
    const unitIds = (u.data ?? []).map((x: any) => x.id);
    if (unitIds.length) {
      const { data: t } = await supabase.from("crm_tenants").select("*").in("unit_id", unitIds);
      setTenants((t as Tenant[]) ?? []);
    } else setTenants([]);
  };

  useEffect(() => { if (propertyId) load(propertyId); }, [propertyId]);

  const save = async (patch: Partial<Property>) => {
    if (!p) return;
    const { error } = await supabase.from("crm_properties").update(patch).eq("id", p.id);
    if (error) return toast.error(error.message);
    setP({ ...p, ...patch });
    onChanged?.();
  };

  const addUnit = async () => {
    if (!p) return;
    const { data, error } = await supabase.from("crm_units").insert({
      property_id: p.id, label: `Unit ${units.length + 1}`, status: "vacant",
    }).select().single();
    if (error) return toast.error(error.message);
    setUnits([...units, data as Unit]);
  };

  const addProject = async () => {
    if (!p) return;
    const { data, error } = await supabase.from("crm_projects").insert({
      property_id: p.id, name: `Refurb — ${p.address}`, stage: "planning",
    }).select().single();
    if (error) return toast.error(error.message);
    setProjects([data as Project, ...projects]);
  };

  return (
    <Sheet open={!!propertyId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        {!p ? <div className="p-6 text-sm text-muted-foreground">Loading…</div> : (
          <>
            <SheetHeader>
              <SheetTitle className="text-left text-lg">{p.address}</SheetTitle>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="outline" className={PROPERTY_STATUS_COLOR[p.status]}>{PROPERTY_STATUS_LABEL[p.status]}</Badge>
                <span className="text-xs text-muted-foreground">{p.property_type.toUpperCase()}</span>
                {p.postcode && <span className="text-xs text-muted-foreground">{p.postcode}</span>}
              </div>
            </SheetHeader>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <KPI label="Purchase" value={fmtGBP(p.purchase_price)} />
              <KPI label="Value" value={fmtGBP(p.current_value)} />
              <KPI label="Equity" value={fmtGBP(p.equity)} />
            </div>

            <Tabs defaultValue="overview" className="mt-4">
              <TabsList className="flex w-full flex-wrap">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="project">Project</TabsTrigger>
                <TabsTrigger value="units">Units & Tenants</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-3">
                <Card className="p-3 space-y-3">
                  <Row label="Status">
                    <Select value={p.status} onValueChange={(v) => save({ status: v as PropertyStatus })}>
                      <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PROPERTY_STATUSES.map((s) => <SelectItem key={s} value={s}>{PROPERTY_STATUS_LABEL[s]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Row>
                  <Row label="Purchase price"><EditableNum value={p.purchase_price} onSave={(n) => save({ purchase_price: n })} /></Row>
                  <Row label="Current value"><EditableNum value={p.current_value} onSave={(n) => save({ current_value: n })} /></Row>
                  <Row label="Equity"><EditableNum value={p.equity} onSave={(n) => save({ equity: n })} /></Row>
                  <Row label="Owner entity"><EditableText value={p.owner_entity ?? ""} onSave={(s) => save({ owner_entity: s })} /></Row>
                </Card>
              </TabsContent>

              <TabsContent value="project" className="space-y-3">
                <div className="flex justify-end"><Button size="sm" onClick={addProject}>+ New project</Button></div>
                {projects.map((pj) => (
                  <Card key={pj.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground">{pj.name}</p>
                      <Badge variant="outline" className={PROJECT_STAGE_COLOR[pj.stage]}>{PROJECT_STAGE_LABEL[pj.stage]}</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>Budget: <span className="text-foreground font-semibold">{fmtGBP(pj.budget)}</span></div>
                      <div>Spent: <span className="text-foreground font-semibold">{fmtGBP(pj.spent)}</span></div>
                    </div>
                    {pj.budget > 0 && (
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div className={`h-full ${pj.spent > pj.budget ? "bg-rose-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(100, (pj.spent / pj.budget) * 100)}%` }} />
                      </div>
                    )}
                  </Card>
                ))}
                {projects.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No projects yet</p>}
              </TabsContent>

              <TabsContent value="units" className="space-y-3">
                <div className="flex justify-end"><Button size="sm" onClick={addUnit}>+ Add unit</Button></div>
                {units.map((u) => {
                  const t = tenants.find((x) => x.unit_id === u.id);
                  return (
                    <Card key={u.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{u.label}</p>
                          <p className="text-xs text-muted-foreground">{fmtGBP(u.rent_pcm)} pcm</p>
                        </div>
                        <Badge variant="outline" className={UNIT_STATUS_COLOR[u.status]}>{UNIT_STATUS_LABEL[u.status]}</Badge>
                      </div>
                      {t && (
                        <div className="mt-2 border-t border-border pt-2 text-xs">
                          <span className="text-foreground font-medium">{t.full_name}</span>
                          {t.arrears_amount > 0 && <span className="ml-2 text-rose-400">Arrears: {fmtGBP(t.arrears_amount)}</span>}
                        </div>
                      )}
                    </Card>
                  );
                })}
                {units.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No units yet</p>}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">{label}</span>{children}</div>;
}
function EditableNum({ value, onSave }: { value: number | null; onSave: (n: number | null) => void }) {
  const [v, setV] = useState(value?.toString() ?? "");
  useEffect(() => { setV(value?.toString() ?? ""); }, [value]);
  return (
    <Input className="h-8 w-32 text-right" type="number" value={v} onChange={(e) => setV(e.target.value)}
      onBlur={() => { const n = v === "" ? null : Number(v); if (n !== value) onSave(n); }} />
  );
}
function EditableText({ value, onSave }: { value: string; onSave: (s: string | null) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <Input className="h-8 w-48" value={v} onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== value) onSave(v.trim() || null); }} />
  );
}