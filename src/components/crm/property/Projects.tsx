import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  type Project, type ProjectStage, type Property,
  PROJECT_STAGES, PROJECT_STAGE_LABEL, PROJECT_STAGE_COLOR, fmtGBP,
} from "./types";

export function ProjectsBoard({ onOpenProperty }: { onOpenProperty: (id: string) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [props, setProps] = useState<Record<string, Property>>({});
  const [completion, setCompletion] = useState<{ project: Project; property?: Property } | null>(null);

  const load = async () => {
    const [pj, pr] = await Promise.all([
      supabase.from("crm_projects").select("*").order("created_at", { ascending: false }),
      supabase.from("crm_properties").select("*"),
    ]);
    setProjects((pj.data as Project[]) ?? []);
    const map: Record<string, Property> = {};
    (pr.data ?? []).forEach((p: any) => { map[p.id] = p; });
    setProps(map);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const onChanged = () => load();
    window.addEventListener("crm:data-changed", onChanged);
    return () => window.removeEventListener("crm:data-changed", onChanged);
  }, []);

  const grouped = useMemo(() => {
    const m = Object.fromEntries(PROJECT_STAGES.map((s) => [s, [] as Project[]])) as Record<ProjectStage, Project[]>;
    projects.forEach((p) => {
      if (!m[p.stage]) m[p.stage] = [];
      m[p.stage].push(p);
    });
    return m;
  }, [projects]);

  const move = async (id: string, stage: ProjectStage) => {
    const { error } = await supabase.from("crm_projects").update({ stage }).eq("id", id);
    if (error) return toast.error(error.message);
    setProjects((xs) => xs.map((x) => (x.id === id ? { ...x, stage } : x)));
    if (stage === "complete") {
      const project = projects.find((p) => p.id === id);
      if (project) setCompletion({ project: { ...project, stage }, property: props[project.property_id] });
    }
  };

  const totalBudget = projects.reduce((a, b) => a + (b.budget ?? 0), 0);
  const totalSpent = projects.reduce((a, b) => a + (b.spent ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>{projects.length} projects</span>
        <span>Budget: <span className="text-foreground font-semibold">{fmtGBP(totalBudget)}</span></span>
        <span>Spent: <span className={`font-semibold ${totalSpent > totalBudget ? "text-rose-400" : "text-foreground"}`}>{fmtGBP(totalSpent)}</span></span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {PROJECT_STAGES.map((stage) => (
          <div key={stage} className="rounded-lg border border-border bg-muted/20 p-2">
            <div className="mb-2">
              <Badge variant="outline" className={PROJECT_STAGE_COLOR[stage]}>{PROJECT_STAGE_LABEL[stage]}</Badge>
              <span className="ml-2 text-xs text-muted-foreground">{grouped[stage].length}</span>
            </div>
            <div className="space-y-2">
              {grouped[stage].map((pj) => {
                const burn = pj.budget > 0 ? (pj.spent / pj.budget) * 100 : 0;
                const prop = props[pj.property_id];
                return (
                  <Card key={pj.id} className="cursor-pointer p-2"
                    onClick={() => prop && onOpenProperty(prop.id)}>
                    <p className="truncate text-xs font-medium">{pj.name}</p>
                    {prop && <p className="truncate text-[10px] text-muted-foreground">{prop.address}</p>}
                    <div className="mt-1 text-[10px] text-muted-foreground">{fmtGBP(pj.spent)} / {fmtGBP(pj.budget)}</div>
                    {pj.budget > 0 && (
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className={`h-full ${burn > 100 ? "bg-rose-500" : burn > 85 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(100, burn)}%` }} />
                      </div>
                    )}
                    <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                      <Select value={pj.stage} onValueChange={(v) => move(pj.id, v as ProjectStage)}>
                        <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PROJECT_STAGES.map((s) => <SelectItem key={s} value={s}>{PROJECT_STAGE_LABEL[s]}</SelectItem>)}
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
      <CompletionDialog
        open={!!completion}
        onClose={() => setCompletion(null)}
        project={completion?.project ?? null}
        property={completion?.property ?? null}
        onDone={() => { setCompletion(null); window.dispatchEvent(new Event("crm:data-changed")); }}
      />
    </div>
  );
}

function CompletionDialog({
  open, onClose, project, property, onDone,
}: {
  open: boolean;
  onClose: () => void;
  project: Project | null;
  property: Property | null;
  onDone: () => void;
}) {
  const [tab, setTab] = useState<"lettings" | "flip">("lettings");
  const [unitLabel, setUnitLabel] = useState("Whole house");
  const [beds, setBeds] = useState<string>("");
  const [rent, setRent] = useState<string>("");
  const [tenantName, setTenantName] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenancyStart, setTenancyStart] = useState("");
  const [deposit, setDeposit] = useState("");
  const [lettingNotes, setLettingNotes] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [saleDate, setSaleDate] = useState("");
  const [saleNotes, setSaleNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && property) {
      setBeds(property.beds ? String(property.beds) : "");
      setSalePrice(property.current_value ? String(property.current_value) : "");
    }
  }, [open, property]);

  const sendToLettings = async () => {
    if (!project || !property) return;
    setSaving(true);
    const rentNum = rent ? Number(rent) : null;
    const { data: unit, error: unitErr } = await supabase.from("crm_units").insert({
      property_id: property.id,
      label: unitLabel || "Whole house",
      beds: beds ? Number(beds) : null,
      rent_pcm: rentNum,
      status: tenantName ? "let" : "marketing",
      marketed_at: new Date().toISOString(),
    }).select().single();
    if (unitErr) { setSaving(false); return toast.error(unitErr.message); }

    if (tenantName) {
      const { error: tErr } = await supabase.from("crm_tenants").insert({
        unit_id: unit.id,
        full_name: tenantName,
        email: tenantEmail || null,
        tenancy_start: tenancyStart || null,
        rent_pcm: rentNum,
        deposit: deposit ? Number(deposit) : null,
        status: "current",
        arrears_amount: 0,
        notes: lettingNotes || null,
      });
      if (tErr) { setSaving(false); return toast.error(tErr.message); }
    }

    await supabase.from("crm_properties").update({ status: tenantName ? "let" : "owned" }).eq("id", property.id);
    setSaving(false);
    toast.success(tenantName ? "Moved to Lettings — tenancy created" : "Unit created in Lettings (marketing)");
    onDone();
  };

  const markSold = async () => {
    if (!property) return;
    setSaving(true);
    const { error } = await supabase.from("crm_properties").update({
      status: "sold",
      current_value: salePrice ? Number(salePrice) : property.current_value,
      notes: [property.notes, saleNotes && `Sold ${saleDate || ""}: ${saleNotes}`].filter(Boolean).join("\n"),
    }).eq("id", property.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Marked as sold");
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Project complete — what next?</DialogTitle>
          <DialogDescription>
            {property?.address ?? "Property"} — review and confirm before moving.
          </DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "lettings" | "flip")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="lettings">Send to Lettings</TabsTrigger>
            <TabsTrigger value="flip">Flip / Sold</TabsTrigger>
          </TabsList>

          <TabsContent value="lettings" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Unit label</Label><Input value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} /></div>
              <div><Label>Beds</Label><Input type="number" value={beds} onChange={(e) => setBeds(e.target.value)} /></div>
              <div><Label>Rent (pcm)</Label><Input type="number" value={rent} onChange={(e) => setRent(e.target.value)} /></div>
              <div><Label>Tenancy start</Label><Input type="date" value={tenancyStart} onChange={(e) => setTenancyStart(e.target.value)} /></div>
              <div className="col-span-2"><Label>Tenant name (optional)</Label><Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="Leave blank if still marketing" /></div>
              <div><Label>Tenant email</Label><Input type="email" value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)} /></div>
              <div><Label>Deposit</Label><Input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} /></div>
              <div className="col-span-2"><Label>Notes</Label><Textarea value={lettingNotes} onChange={(e) => setLettingNotes(e.target.value)} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={sendToLettings} disabled={saving}>{saving ? "Saving…" : "Confirm & send to Lettings"}</Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="flip" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Sale price</Label><Input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} /></div>
              <div><Label>Sale date</Label><Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} /></div>
              <div className="col-span-2"><Label>Notes</Label><Textarea value={saleNotes} onChange={(e) => setSaleNotes(e.target.value)} rows={3} placeholder="Buyer, agent, completion notes…" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={markSold} disabled={saving}>{saving ? "Saving…" : "Confirm & mark sold"}</Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}