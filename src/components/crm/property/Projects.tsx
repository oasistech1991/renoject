import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  type Project, type ProjectStage, type Property,
  PROJECT_STAGES, PROJECT_STAGE_LABEL, PROJECT_STAGE_COLOR, fmtGBP,
} from "./types";

export function ProjectsBoard({ onOpenProperty }: { onOpenProperty: (id: string) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [props, setProps] = useState<Record<string, Property>>({});

  useEffect(() => {
    (async () => {
      const [pj, pr] = await Promise.all([
        supabase.from("crm_projects").select("*").order("created_at", { ascending: false }),
        supabase.from("crm_properties").select("*"),
      ]);
      setProjects((pj.data as Project[]) ?? []);
      const map: Record<string, Property> = {};
      (pr.data ?? []).forEach((p: any) => { map[p.id] = p; });
      setProps(map);
    })();
  }, []);

  const grouped = useMemo(() => {
    const m = Object.fromEntries(PROJECT_STAGES.map((s) => [s, [] as Project[]])) as Record<ProjectStage, Project[]>;
    projects.forEach((p) => m[p.stage].push(p));
    return m;
  }, [projects]);

  const move = async (id: string, stage: ProjectStage) => {
    const { error } = await supabase.from("crm_projects").update({ stage }).eq("id", id);
    if (error) return toast.error(error.message);
    setProjects((xs) => xs.map((x) => (x.id === id ? { ...x, stage } : x)));
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
    </div>
  );
}