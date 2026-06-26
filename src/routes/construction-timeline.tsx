import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  HardHat, Plus, Calendar as CalendarIcon, ListTree, BarChart3, LayoutGrid,
  Diamond, Link2, Trash2, Save, Copy, AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay, isBefore, isAfter } from "date-fns";

export const Route = createFileRoute("/construction-timeline")({
  head: () => ({
    meta: [
      { title: "Construction Timeline — Renoject" },
      { name: "description", content: "Plan, schedule and track UK construction projects with a live Gantt timeline, phases, tasks, dependencies, milestones, daily logs and reusable templates." },
      { property: "og:title", content: "Construction Timeline — Renoject" },
      { property: "og:description", content: "Live construction scheduling: phases, tasks, dependencies and progress tracking — built for UK property projects." },
    ],
  }),
  component: ConstructionTimelinePage,
});

// ============ Types ============
type Schedule = {
  id: string; user_id: string; name: string; property_id: string | null;
  planned_start: string | null; planned_finish: string | null;
  working_days: number[]; non_working_dates: string[];
  colour_palette: Record<string, string>;
  template_of_id: string | null; is_template: boolean;
  client_id: string | null;
  created_at: string; updated_at: string;
};
type Phase = { id: string; schedule_id: string; name: string; position: number; colour: string | null };
type Task = {
  id: string; schedule_id: string; phase_id: string | null; name: string;
  trade: string | null; assignee_tradesman_id: string | null;
  planned_start: string | null; planned_finish: string | null; duration_days: number;
  actual_start: string | null; actual_finish: string | null;
  percent_complete: number; is_milestone: boolean;
  priority: "low" | "normal" | "high" | "critical";
  notes: string | null; position: number;
};
type Link = { id: string; schedule_id: string; from_task_id: string; to_task_id: string; link_type: "FS"|"SS"|"FF"|"SF"; lag_days: number };
type DailyLog = { id: string; schedule_id: string; task_id: string | null; log_date: string; weather: string | null; crew_count: number | null; hours_worked: number | null; notes: string | null; delay_reason: string | null };

// ============ Constants ============
const TRADE_COLOURS: Record<string, string> = {
  Demolition: "#9CA3AF", Groundworks: "#A16207", Structural: "#374151",
  Electrical: "#F59E0B", Plumbing: "#0EA5E9", Plastering: "#EC4899",
  Joinery: "#8B5CF6", Kitchen: "#10B981", Bathroom: "#06B6D4",
  Decorating: "#F472B6", Flooring: "#B45309", Roofing: "#DC2626",
  Windows: "#6366F1", Landscaping: "#65A30D", Snagging: "#64748B",
};
const DEFAULT_TRADE = "#F7791E";

const STARTER_TEMPLATES = {
  "Cosmetic refurb": [
    { phase: "Strip out", tasks: [["Clearance", "Demolition", 3], ["Skip hire", "Demolition", 1]] },
    { phase: "First fix", tasks: [["Electrics first fix", "Electrical", 4], ["Plumbing first fix", "Plumbing", 3]] },
    { phase: "Finishes", tasks: [["Plaster", "Plastering", 5], ["Decorate", "Decorating", 6], ["Flooring", "Flooring", 3]] },
    { phase: "Snagging", tasks: [["Final clean", "Snagging", 1], ["Snagging walk-through", "Snagging", 1]] },
  ],
  "Full BRRR refurb": [
    { phase: "Strip & enabling", tasks: [["Strip out", "Demolition", 5], ["Structural alterations", "Structural", 8]] },
    { phase: "First fix", tasks: [["Plumbing first fix", "Plumbing", 5], ["Electrics first fix", "Electrical", 5], ["Heating first fix", "Plumbing", 3]] },
    { phase: "Plaster & screed", tasks: [["Plaster walls", "Plastering", 7], ["Screed floors", "Plastering", 2]] },
    { phase: "Second fix", tasks: [["Kitchen fit", "Kitchen", 5], ["Bathroom fit", "Bathroom", 5], ["Joinery", "Joinery", 6]] },
    { phase: "Finishes", tasks: [["Decorate", "Decorating", 8], ["Flooring", "Flooring", 4]] },
    { phase: "External", tasks: [["Windows", "Windows", 3], ["Roof repairs", "Roofing", 4], ["Landscaping", "Landscaping", 5]] },
    { phase: "Completion", tasks: [["EICR & Gas certs", "Electrical", 1], ["Final clean", "Snagging", 1], ["Snag list", "Snagging", 2]] },
  ],
  "HMO conversion": [
    { phase: "Design & approvals", tasks: [["Article 4 / planning check", "Snagging", 7], ["HMO licence app", "Snagging", 5]] },
    { phase: "Structural", tasks: [["Stud walls / partitions", "Structural", 10], ["Fire-rated ceilings", "Structural", 6]] },
    { phase: "Compliance", tasks: [["Fire doors", "Joinery", 4], ["Mains-wired alarms", "Electrical", 3], ["Emergency lighting", "Electrical", 2]] },
    { phase: "First fix", tasks: [["Plumbing first fix", "Plumbing", 6], ["Electrics first fix", "Electrical", 6]] },
    { phase: "Finishes", tasks: [["Kitchens (x rooms)", "Kitchen", 6], ["Ensuites", "Bathroom", 8], ["Decorate", "Decorating", 8]] },
    { phase: "Sign-off", tasks: [["Fire risk assessment", "Snagging", 1], ["HMO inspection", "Snagging", 1]] },
  ],
} as const;

const LIFECYCLE = [
  { key: "planning", label: "1. Planning & Setup", icon: ListTree },
  { key: "pre", label: "2. Pre-Construction", icon: CalendarIcon },
  { key: "live", label: "3. Live Management", icon: BarChart3 },
  { key: "progress", label: "4. Progress & Control", icon: Clock },
  { key: "complete", label: "5. Completion", icon: CheckCircle2 },
];

// ============ Helpers ============
const fmtDate = (d: Date) => format(d, "yyyy-MM-dd");
const today = startOfDay(new Date());
const tradeColour = (palette: Record<string, string>, trade: string | null) =>
  (trade && (palette[trade] || TRADE_COLOURS[trade])) || DEFAULT_TRADE;

function computeKpis(tasks: Task[]) {
  const total = tasks.length;
  const done = tasks.filter(t => t.percent_complete >= 100).length;
  const atRisk = tasks.filter(t => {
    if (t.percent_complete >= 100 || !t.planned_finish) return false;
    return isBefore(parseISO(t.planned_finish), today) && t.percent_complete < 100;
  }).length;
  const slipped = tasks.reduce((acc, t) => {
    if (!t.planned_finish) return acc;
    if (t.percent_complete >= 100) return acc;
    const d = differenceInCalendarDays(today, parseISO(t.planned_finish));
    return acc + Math.max(0, d);
  }, 0);
  const onTimePct = total ? Math.round(((total - atRisk) / total) * 100) : 100;
  return { total, done, atRisk, slipped, onTimePct };
}

// ============ Main page ============
function ConstructionTimelinePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [view, setView] = useState<"gantt" | "weekly" | "calendar" | "list">("gantt");
  const [zoom, setZoom] = useState<"day" | "week" | "month">("week");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load schedules
  const reloadSchedules = async () => {
    const { data, error } = await supabase
      .from("construction_schedules").select("*").order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    const list = (data ?? []) as Schedule[];
    setSchedules(list);
    if (!activeId && list.length) setActiveId(list[0].id);
    setLoading(false);
  };
  useEffect(() => { reloadSchedules(); /* eslint-disable-next-line */ }, []);

  // Load schedule contents
  const reloadContents = async (sid: string) => {
    const [{ data: p }, { data: t }, { data: l }] = await Promise.all([
      supabase.from("construction_phases").select("*").eq("schedule_id", sid).order("position"),
      supabase.from("construction_tasks").select("*").eq("schedule_id", sid).order("position"),
      supabase.from("construction_task_links").select("*").eq("schedule_id", sid),
    ]);
    setPhases((p ?? []) as Phase[]);
    setTasks((t ?? []) as Task[]);
    setLinks((l ?? []) as Link[]);
  };
  useEffect(() => { if (activeId) reloadContents(activeId); }, [activeId]);

  // Realtime
  useEffect(() => {
    if (!activeId) return;
    const ch = supabase
      .channel(`construction-${activeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "construction_phases", filter: `schedule_id=eq.${activeId}` }, () => reloadContents(activeId))
      .on("postgres_changes", { event: "*", schema: "public", table: "construction_tasks", filter: `schedule_id=eq.${activeId}` }, () => reloadContents(activeId))
      .on("postgres_changes", { event: "*", schema: "public", table: "construction_task_links", filter: `schedule_id=eq.${activeId}` }, () => reloadContents(activeId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId]);

  const active = schedules.find(s => s.id === activeId) || null;
  const kpis = useMemo(() => computeKpis(tasks), [tasks]);

  // ----- Mutations -----
  const saveTask = async (patch: Partial<Task> & { id: string }) => {
    setTasks(prev => prev.map(t => t.id === patch.id ? { ...t, ...patch } as Task : t));
    const { error } = await supabase.from("construction_tasks").update(patch).eq("id", patch.id);
    if (error) toast.error(error.message);
  };
  const deleteTask = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    const { error } = await supabase.from("construction_tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setSelectedTask(null);
  };
  const addPhase = async () => {
    if (!activeId) return;
    const name = prompt("Phase name?"); if (!name) return;
    const pos = phases.length;
    const { error } = await supabase.from("construction_phases").insert({ schedule_id: activeId, name, position: pos });
    if (error) toast.error(error.message);
  };
  const addTask = async (phaseId: string | null) => {
    if (!activeId) return;
    const start = fmtDate(today);
    const { error } = await supabase.from("construction_tasks").insert({
      schedule_id: activeId, phase_id: phaseId, name: "New task",
      planned_start: start, planned_finish: fmtDate(addDays(today, 3)),
      duration_days: 3, position: tasks.filter(t => t.phase_id === phaseId).length,
    });
    if (error) toast.error(error.message);
  };
  const saveAsTemplate = async () => {
    if (!active) return;
    const { error } = await supabase.from("construction_schedules").update({ is_template: true }).eq("id", active.id);
    if (error) return toast.error(error.message);
    toast.success("Saved as template");
    reloadSchedules();
  };

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <HardHat className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Construction Timeline</h1>
              <p className="text-xs text-muted-foreground">Plan, coordinate and deliver UK projects — without the chaos.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {active && (
              <ClientPicker
                scheduleId={active.id}
                value={active.client_id}
                onChange={(client_id) =>
                  setSchedules((xs) => xs.map((s) => (s.id === active.id ? { ...s, client_id } : s)))
                }
              />
            )}
            {active && (
              <Button variant="outline" size="sm" onClick={saveAsTemplate} disabled={active.is_template}>
                <Save className="h-4 w-4 mr-1" /> {active.is_template ? "Template" : "Save as template"}
              </Button>
            )}
            <NewScheduleDialog
              open={createOpen} onOpenChange={setCreateOpen} templates={schedules.filter(s => s.is_template)}
              onCreated={(id) => { setActiveId(id); reloadSchedules(); }}
            />
          </div>
        </div>

        {/* Lifecycle strip */}
        <div className="px-6 pb-3 flex gap-2 overflow-x-auto">
          {LIFECYCLE.map((s) => (
            <div key={s.key} className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2 whitespace-nowrap">
              <s.icon className="h-3.5 w-3.5" />
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex">
        {/* Schedule list */}
        <aside className="w-64 border-r border-border bg-card/40 p-3 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">Schedules</div>
          {schedules.length === 0 && (
            <p className="text-xs text-muted-foreground">No schedules yet. Click <strong>New schedule</strong>.</p>
          )}
          <div className="space-y-1">
            {schedules.map(s => (
              <button key={s.id} onClick={() => setActiveId(s.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between gap-2 ${activeId === s.id ? "bg-accent text-foreground" : "hover:bg-accent/50 text-muted-foreground"}`}>
                <span className="truncate">{s.name}</span>
                {s.is_template && <Badge variant="outline" className="text-[9px] py-0">TPL</Badge>}
              </button>
            ))}
          </div>
        </aside>

        {/* Main canvas */}
        <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-8 text-center">
              <div>
                <HardHat className="h-10 w-10 mx-auto mb-3 text-primary" />
                <p className="font-medium text-foreground mb-1">No schedule selected</p>
                <p>Create your first schedule to get started.</p>
              </div>
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="px-6 py-3 border-b border-border grid grid-cols-2 md:grid-cols-5 gap-3">
                <Kpi label="Tasks" value={kpis.total} />
                <Kpi label="Complete" value={kpis.done} accent="emerald" />
                <Kpi label="At risk" value={kpis.atRisk} accent={kpis.atRisk ? "amber" : undefined} />
                <Kpi label="Total days slipped" value={kpis.slipped} accent={kpis.slipped ? "red" : undefined} />
                <Kpi label="On time" value={`${kpis.onTimePct}%`} accent="primary" />
              </div>

              {/* View toolbar */}
              <div className="px-6 py-3 border-b border-border flex items-center justify-between flex-wrap gap-3">
                <Tabs value={view} onValueChange={(v) => setView(v as any)}>
                  <TabsList>
                    <TabsTrigger value="gantt"><BarChart3 className="h-3.5 w-3.5 mr-1" />Gantt</TabsTrigger>
                    <TabsTrigger value="weekly"><LayoutGrid className="h-3.5 w-3.5 mr-1" />Weekly</TabsTrigger>
                    <TabsTrigger value="calendar"><CalendarIcon className="h-3.5 w-3.5 mr-1" />Calendar</TabsTrigger>
                    <TabsTrigger value="list"><ListTree className="h-3.5 w-3.5 mr-1" />List</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="flex items-center gap-2">
                  {view === "gantt" && (
                    <Select value={zoom} onValueChange={(v) => setZoom(v as any)}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Day zoom</SelectItem>
                        <SelectItem value="week">Week zoom</SelectItem>
                        <SelectItem value="month">Month zoom</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Button size="sm" variant="outline" onClick={addPhase}><Plus className="h-3.5 w-3.5 mr-1" />Phase</Button>
                  <Button size="sm" onClick={() => addTask(phases[0]?.id ?? null)}><Plus className="h-3.5 w-3.5 mr-1" />Task</Button>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                {view === "gantt" && <GanttView schedule={active} phases={phases} tasks={tasks} links={links} zoom={zoom} onSelect={setSelectedTask} onSaveTask={saveTask} />}
                {view === "weekly" && <WeeklyView tasks={tasks} onSelect={setSelectedTask} palette={active.colour_palette} />}
                {view === "calendar" && <CalendarView tasks={tasks} onSelect={setSelectedTask} palette={active.colour_palette} />}
                {view === "list" && <ListView phases={phases} tasks={tasks} onSelect={setSelectedTask} onAddTask={addTask} palette={active.colour_palette} />}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Task drawer */}
      <TaskDrawer
        task={selectedTask}
        schedule={active}
        allTasks={tasks}
        links={links}
        onClose={() => setSelectedTask(null)}
        onSave={saveTask}
        onDelete={deleteTask}
      />
    </div>
  );
}

// ============ KPI card ============
function Kpi({ label, value, accent }: { label: string; value: number | string; accent?: "emerald" | "amber" | "red" | "primary" }) {
  const tone = accent === "emerald" ? "text-emerald-500"
    : accent === "amber" ? "text-amber-500"
    : accent === "red" ? "text-red-500"
    : accent === "primary" ? "text-primary"
    : "text-foreground";
  return (
    <Card className="p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
    </Card>
  );
}

// ============ Gantt ============
function GanttView({ schedule, phases, tasks, links, zoom, onSelect, onSaveTask }: {
  schedule: Schedule; phases: Phase[]; tasks: Task[]; links: Link[];
  zoom: "day" | "week" | "month"; onSelect: (t: Task) => void;
  onSaveTask: (p: Partial<Task> & { id: string }) => void;
}) {
  const cellWidth = zoom === "day" ? 36 : zoom === "week" ? 18 : 6;
  const labelWidth = 240;

  // Range
  const allDates = tasks.flatMap(t => [t.planned_start, t.planned_finish]).filter(Boolean) as string[];
  const minStart = allDates.length ? allDates.reduce((m, d) => d < m ? d : m) : fmtDate(today);
  const maxFinish = allDates.length ? allDates.reduce((m, d) => d > m ? d : m) : fmtDate(addDays(today, 30));
  const start = addDays(parseISO(minStart), -3);
  const finish = addDays(parseISO(maxFinish), 7);
  const totalDays = Math.max(30, differenceInCalendarDays(finish, start) + 1);

  const dayX = (date: string) => differenceInCalendarDays(parseISO(date), start) * cellWidth;

  // Group tasks by phase (no phase last)
  const grouped = useMemo(() => {
    const groups: { phase: Phase | null; tasks: Task[] }[] = phases.map(p => ({
      phase: p, tasks: tasks.filter(t => t.phase_id === p.id),
    }));
    const orphans = tasks.filter(t => !t.phase_id || !phases.find(p => p.id === t.phase_id));
    if (orphans.length) groups.push({ phase: null, tasks: orphans });
    return groups;
  }, [phases, tasks]);

  const allRows = grouped.flatMap(g => [{ kind: "phase" as const, phase: g.phase }, ...g.tasks.map(t => ({ kind: "task" as const, task: t }))]);

  const rowHeight = 36;

  // Drag state
  const dragRef = useRef<{ id: string; mode: "move" | "resize"; startX: number; origStart: string; origFinish: string } | null>(null);

  const onBarMouseDown = (e: React.MouseEvent, t: Task, mode: "move" | "resize") => {
    e.stopPropagation();
    if (!t.planned_start || !t.planned_finish) return;
    dragRef.current = { id: t.id, mode, startX: e.clientX, origStart: t.planned_start, origFinish: t.planned_finish };
    document.body.style.cursor = mode === "resize" ? "ew-resize" : "grabbing";
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current; if (!d) return;
      const deltaDays = Math.round((e.clientX - d.startX) / cellWidth);
      if (!deltaDays) return;
      const newStart = d.mode === "move" ? fmtDate(addDays(parseISO(d.origStart), deltaDays)) : d.origStart;
      const newFinish = fmtDate(addDays(parseISO(d.origFinish), deltaDays));
      const dur = Math.max(1, differenceInCalendarDays(parseISO(newFinish), parseISO(newStart)) + 1);
      onSaveTask({ id: d.id, planned_start: newStart, planned_finish: newFinish, duration_days: dur });
      dragRef.current = { ...d, startX: e.clientX, origStart: newStart, origFinish: newFinish };
    };
    const onUp = () => { dragRef.current = null; document.body.style.cursor = ""; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [cellWidth, onSaveTask]);

  const timelineWidth = totalDays * cellWidth;
  const todayX = differenceInCalendarDays(today, start) * cellWidth;

  return (
    <div className="relative">
      <div className="flex">
        {/* Left labels */}
        <div style={{ width: labelWidth }} className="shrink-0 border-r border-border bg-card/40 sticky left-0 z-10">
          <div style={{ height: 56 }} className="border-b border-border" />
          {allRows.map((r, i) => (
            <div key={i} style={{ height: rowHeight }} className={`px-3 flex items-center border-b border-border text-sm ${r.kind === "phase" ? "bg-muted/40 font-semibold text-foreground" : "text-muted-foreground"}`}>
              {r.kind === "phase" ? (r.phase?.name ?? "Unassigned") : (
                <button className="truncate text-left hover:text-foreground" onClick={() => onSelect(r.task)}>
                  {r.task.is_milestone && <Diamond className="inline h-3 w-3 mr-1 text-amber-500" />}
                  {r.task.name}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="relative" style={{ width: timelineWidth }}>
          {/* Header */}
          <div className="sticky top-0 z-10 bg-card border-b border-border" style={{ height: 56 }}>
            <div className="flex h-full">
              {Array.from({ length: totalDays }).map((_, i) => {
                const d = addDays(start, i);
                const dow = d.getDay();
                const isNonWorking = !schedule.working_days.includes(dow === 0 ? 7 : dow);
                const showLabel = zoom === "day" || (zoom === "week" && d.getDay() === 1) || (zoom === "month" && d.getDate() === 1);
                return (
                  <div key={i} style={{ width: cellWidth }}
                    className={`flex flex-col items-center justify-end pb-1 text-[10px] border-r border-border/40 ${isNonWorking ? "bg-muted/30" : ""}`}>
                    {showLabel && (
                      <>
                        <span className="text-muted-foreground">{format(d, zoom === "month" ? "MMM" : "EEE")}</span>
                        <span className="font-medium">{format(d, zoom === "month" ? "yy" : "d")}</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Today line */}
          {todayX > 0 && todayX < timelineWidth && (
            <div className="absolute top-14 bottom-0 w-px bg-red-500 z-10 pointer-events-none" style={{ left: todayX }}>
              <div className="absolute -top-5 -translate-x-1/2 bg-red-500 text-white text-[9px] px-1 rounded">TODAY</div>
            </div>
          )}

          {/* Rows */}
          {allRows.map((r, i) => (
            <div key={i} style={{ height: rowHeight }} className={`relative border-b border-border ${r.kind === "phase" ? "bg-muted/30" : ""}`}>
              {Array.from({ length: totalDays }).map((_, di) => {
                const d = addDays(start, di);
                const dow = d.getDay();
                const isNonWorking = !schedule.working_days.includes(dow === 0 ? 7 : dow);
                return <div key={di} style={{ width: cellWidth, left: di * cellWidth }} className={`absolute top-0 bottom-0 border-r border-border/30 ${isNonWorking ? "bg-muted/20" : ""}`} />;
              })}

              {r.kind === "task" && r.task.planned_start && r.task.planned_finish && (
                (() => {
                  const t = r.task;
                  const left = dayX(t.planned_start!);
                  const width = Math.max(cellWidth, (differenceInCalendarDays(parseISO(t.planned_finish!), parseISO(t.planned_start!)) + 1) * cellWidth);
                  const colour = tradeColour(schedule.colour_palette, t.trade);
                  const overdue = isAfter(today, parseISO(t.planned_finish!)) && t.percent_complete < 100;
                  if (t.is_milestone) {
                    return (
                      <div onClick={() => onSelect(t)}
                        style={{ left: left - 8, top: 8 }}
                        className="absolute h-5 w-5 rotate-45 cursor-pointer z-[2]"
                        title={t.name}>
                        <div className="h-full w-full" style={{ background: "#F59E0B", border: "2px solid #fff" }} />
                      </div>
                    );
                  }
                  return (
                    <div
                      onMouseDown={(e) => onBarMouseDown(e, t, "move")}
                      onClick={() => onSelect(t)}
                      style={{
                        left, width, top: 6, height: rowHeight - 12,
                        background: colour,
                        border: t.priority === "critical" || t.priority === "high" ? "2px solid #ef4444" : `1px solid ${colour}`,
                        opacity: overdue ? 0.95 : 1,
                      }}
                      className="absolute rounded-md text-[10px] text-white font-medium px-2 flex items-center cursor-grab active:cursor-grabbing shadow z-[2] overflow-hidden"
                      title={`${t.name} — ${t.planned_start} → ${t.planned_finish}`}
                    >
                      {/* Progress */}
                      <div className="absolute inset-y-0 left-0 bg-black/25" style={{ width: `${t.percent_complete}%` }} />
                      <span className="relative truncate">
                        {overdue && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                        {t.name}
                      </span>
                      {/* Resize handle */}
                      <div onMouseDown={(e) => onBarMouseDown(e, t, "resize")}
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize" />
                    </div>
                  );
                })()
              )}
            </div>
          ))}

          {/* Dependency arrows */}
          <svg className="absolute top-14 left-0 pointer-events-none" width={timelineWidth} height={allRows.length * rowHeight} style={{ overflow: "visible" }}>
            {links.map(link => {
              const fromIdx = allRows.findIndex(r => r.kind === "task" && r.task.id === link.from_task_id);
              const toIdx = allRows.findIndex(r => r.kind === "task" && r.task.id === link.to_task_id);
              if (fromIdx < 0 || toIdx < 0) return null;
              const fromTask = tasks.find(t => t.id === link.from_task_id);
              const toTask = tasks.find(t => t.id === link.to_task_id);
              if (!fromTask?.planned_finish || !toTask?.planned_start) return null;
              const x1 = dayX(fromTask.planned_finish) + cellWidth;
              const y1 = fromIdx * rowHeight + rowHeight / 2;
              const x2 = dayX(toTask.planned_start);
              const y2 = toIdx * rowHeight + rowHeight / 2;
              return (
                <path key={link.id} d={`M${x1},${y1} L${x1 + 6},${y1} L${x1 + 6},${y2} L${x2},${y2}`}
                  stroke="#94a3b8" strokeWidth={1.5} fill="none" markerEnd="url(#arr)" />
              );
            })}
            <defs>
              <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 z" fill="#94a3b8" />
              </marker>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  );
}

// ============ Weekly view ============
function WeeklyView({ tasks, onSelect, palette }: { tasks: Task[]; onSelect: (t: Task) => void; palette: Record<string, string> }) {
  const buckets = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.planned_start) continue;
      const d = parseISO(t.planned_start);
      const monday = addDays(d, -((d.getDay() + 6) % 7));
      const key = fmtDate(monday);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries()).sort();
  }, [tasks]);
  return (
    <div className="p-6 space-y-4">
      {buckets.length === 0 && <p className="text-sm text-muted-foreground">No scheduled tasks yet.</p>}
      {buckets.map(([wk, ts]) => (
        <div key={wk}>
          <h3 className="text-sm font-semibold mb-2">Week of {format(parseISO(wk), "d MMM yyyy")}</h3>
          <div className="grid gap-2">
            {ts.map(t => (
              <button key={t.id} onClick={() => onSelect(t)} className="flex items-center gap-3 p-2 rounded border border-border hover:bg-accent text-left">
                <div className="h-3 w-3 rounded" style={{ background: tradeColour(palette, t.trade) }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{t.name}</div>
                  <div className="text-[10px] text-muted-foreground">{t.trade ?? "Untagged"} · {t.duration_days}d</div>
                </div>
                <Badge variant="outline" className="text-[9px]">{t.percent_complete}%</Badge>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============ Calendar view ============
function CalendarView({ tasks, onSelect, palette }: { tasks: Task[]; onSelect: (t: Task) => void; palette: Record<string, string> }) {
  // List by day
  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.planned_start || !t.planned_finish) continue;
      const s = parseISO(t.planned_start); const f = parseISO(t.planned_finish);
      for (let d = s; !isAfter(d, f); d = addDays(d, 1)) {
        const k = fmtDate(d);
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(t);
      }
    }
    return map;
  }, [tasks]);

  const days = Array.from(byDay.keys()).sort();
  return (
    <div className="p-6">
      {days.length === 0 && <p className="text-sm text-muted-foreground">No scheduled tasks yet.</p>}
      <div className="grid gap-2">
        {days.map(d => (
          <div key={d} className="border border-border rounded p-3">
            <div className="text-xs font-semibold mb-2">{format(parseISO(d), "EEE d MMM yyyy")}</div>
            <div className="flex flex-wrap gap-2">
              {byDay.get(d)!.map(t => (
                <button key={t.id} onClick={() => onSelect(t)}
                  style={{ background: tradeColour(palette, t.trade) }}
                  className="text-[10px] text-white px-2 py-1 rounded">{t.name}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ List view ============
function ListView({ phases, tasks, onSelect, onAddTask, palette }: {
  phases: Phase[]; tasks: Task[]; onSelect: (t: Task) => void;
  onAddTask: (phaseId: string | null) => void; palette: Record<string, string>;
}) {
  return (
    <div className="p-6 space-y-5">
      {phases.length === 0 && <p className="text-sm text-muted-foreground">Add a phase to group tasks.</p>}
      {phases.map(p => {
        const ts = tasks.filter(t => t.phase_id === p.id);
        return (
          <div key={p.id}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold">{p.name}</h3>
              <Button variant="ghost" size="sm" onClick={() => onAddTask(p.id)}><Plus className="h-3 w-3 mr-1" />Task</Button>
            </div>
            <div className="border border-border rounded divide-y divide-border">
              {ts.length === 0 && <div className="p-3 text-xs text-muted-foreground">No tasks.</div>}
              {ts.map(t => (
                <button key={t.id} onClick={() => onSelect(t)}
                  className="w-full px-3 py-2 flex items-center gap-3 hover:bg-accent text-left">
                  <div className="h-2 w-2 rounded-full" style={{ background: tradeColour(palette, t.trade) }} />
                  {t.is_milestone && <Diamond className="h-3 w-3 text-amber-500" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{t.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {t.planned_start ? format(parseISO(t.planned_start), "d MMM") : "—"}
                      {" → "}
                      {t.planned_finish ? format(parseISO(t.planned_finish), "d MMM") : "—"}
                      {" · "}{t.trade ?? "Untagged"}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px]">{t.percent_complete}%</Badge>
                  {t.priority !== "normal" && <Badge className="text-[9px] capitalize" variant={t.priority === "critical" || t.priority === "high" ? "destructive" : "secondary"}>{t.priority}</Badge>}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============ Task drawer ============
function TaskNameInput({ task, onSave }: { task: Task; onSave: (p: Partial<Task> & { id: string }) => void }) {
  const [val, setVal] = useState(task.name);
  const taskIdRef = useRef(task.id);
  useEffect(() => {
    if (taskIdRef.current !== task.id) { taskIdRef.current = task.id; setVal(task.name); }
  }, [task.id, task.name]);
  const commit = () => { if (val !== task.name) onSave({ id: task.id, name: val }); };
  return (
    <Input
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className="text-base font-semibold"
    />
  );
}

function TaskDrawer({ task, schedule, allTasks, links, onClose, onSave, onDelete }: {
  task: Task | null; schedule: Schedule | null; allTasks: Task[]; links: Link[];
  onClose: () => void; onSave: (p: Partial<Task> & { id: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [tab, setTab] = useState("details");
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [logForm, setLogForm] = useState({ notes: "", weather: "", hours_worked: "", delay_reason: "" });

  useEffect(() => {
    if (!task) return;
    supabase.from("construction_daily_logs").select("*").eq("task_id", task.id).order("log_date", { ascending: false }).then(({ data }) => setLogs((data ?? []) as DailyLog[]));
  }, [task?.id]);

  if (!task || !schedule) return null;

  const predecessors = links.filter(l => l.to_task_id === task.id);
  const candidates = allTasks.filter(t => t.id !== task.id && !predecessors.find(p => p.from_task_id === t.id));

  const addLink = async (fromId: string) => {
    const { error } = await supabase.from("construction_task_links").insert({
      schedule_id: schedule.id, from_task_id: fromId, to_task_id: task.id, link_type: "FS", lag_days: 0,
    });
    if (error) toast.error(error.message);
  };
  const removeLink = async (id: string) => {
    const { error } = await supabase.from("construction_task_links").delete().eq("id", id);
    if (error) toast.error(error.message);
  };
  const addLog = async () => {
    if (!logForm.notes) return;
    const { error } = await supabase.from("construction_daily_logs").insert({
      schedule_id: schedule.id, task_id: task.id,
      log_date: fmtDate(today),
      notes: logForm.notes, weather: logForm.weather || null,
      hours_worked: logForm.hours_worked ? Number(logForm.hours_worked) : null,
      delay_reason: logForm.delay_reason || null,
    });
    if (error) return toast.error(error.message);
    setLogForm({ notes: "", weather: "", hours_worked: "", delay_reason: "" });
    supabase.from("construction_daily_logs").select("*").eq("task_id", task.id).order("log_date", { ascending: false }).then(({ data }) => setLogs((data ?? []) as DailyLog[]));
    toast.success("Log added");
  };

  return (
    <Sheet open={!!task} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            <TaskNameInput task={task} onSave={onSave} />
          </SheetTitle>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
            <TabsTrigger value="logs">Daily logs</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start</Label>
                <Input type="date" value={task.planned_start ?? ""} onChange={(e) => {
                  const ns = e.target.value;
                  const nf = task.planned_finish ?? ns;
                  onSave({ id: task.id, planned_start: ns, duration_days: ns && nf ? Math.max(1, differenceInCalendarDays(parseISO(nf), parseISO(ns)) + 1) : task.duration_days });
                }} />
              </div>
              <div>
                <Label>Finish</Label>
                <Input type="date" value={task.planned_finish ?? ""} onChange={(e) => {
                  const nf = e.target.value;
                  const ns = task.planned_start ?? nf;
                  onSave({ id: task.id, planned_finish: nf, duration_days: ns && nf ? Math.max(1, differenceInCalendarDays(parseISO(nf), parseISO(ns)) + 1) : task.duration_days });
                }} />
              </div>
            </div>
            <div>
              <Label>Trade</Label>
              <Select value={task.trade ?? "__none"} onValueChange={(v) => onSave({ id: task.id, trade: v === "__none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Pick a trade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Untagged</SelectItem>
                  {Object.keys(TRADE_COLOURS).map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={task.priority} onValueChange={(v) => onSave({ id: task.id, priority: v as Task["priority"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>% Complete: {task.percent_complete}</Label>
              <Slider value={[task.percent_complete]} max={100} step={5}
                onValueChange={([v]) => onSave({ id: task.id, percent_complete: v })} />
            </div>
            <div className="flex items-center justify-between rounded border border-border p-2">
              <Label className="text-sm">Milestone</Label>
              <Switch checked={task.is_milestone} onCheckedChange={(v) => onSave({ id: task.id, is_milestone: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Actual start</Label>
                <Input type="date" value={task.actual_start ?? ""} onChange={(e) => onSave({ id: task.id, actual_start: e.target.value || null })} />
              </div>
              <div>
                <Label>Actual finish</Label>
                <Input type="date" value={task.actual_finish ?? ""} onChange={(e) => onSave({ id: task.id, actual_finish: e.target.value || null })} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={task.notes ?? ""} onChange={(e) => onSave({ id: task.id, notes: e.target.value })} rows={3} />
            </div>
            <Button variant="destructive" size="sm" onClick={() => onDelete(task.id)} className="w-full">
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete task
            </Button>
          </TabsContent>

          <TabsContent value="links" className="space-y-3 mt-4">
            <div className="text-xs text-muted-foreground">Predecessors (must finish before this task starts)</div>
            <div className="space-y-2">
              {predecessors.length === 0 && <p className="text-sm text-muted-foreground">No predecessors.</p>}
              {predecessors.map(l => {
                const t = allTasks.find(x => x.id === l.from_task_id);
                return (
                  <div key={l.id} className="flex items-center gap-2 p-2 border border-border rounded">
                    <Link2 className="h-3.5 w-3.5" />
                    <span className="text-sm flex-1 truncate">{t?.name ?? "?"}</span>
                    <Badge variant="outline" className="text-[9px]">{l.link_type}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => removeLink(l.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                );
              })}
            </div>
            <div>
              <Label>Add predecessor</Label>
              <Select value="" onValueChange={(v) => v && addLink(v)}>
                <SelectTrigger><SelectValue placeholder="Pick a task" /></SelectTrigger>
                <SelectContent>
                  {candidates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="logs" className="space-y-3 mt-4">
            <Card className="p-3 space-y-2">
              <Label className="text-xs">New site log</Label>
              <Textarea placeholder="What happened on site today?" rows={2} value={logForm.notes} onChange={(e) => setLogForm(f => ({ ...f, notes: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Weather" value={logForm.weather} onChange={(e) => setLogForm(f => ({ ...f, weather: e.target.value }))} />
                <Input type="number" placeholder="Hours" value={logForm.hours_worked} onChange={(e) => setLogForm(f => ({ ...f, hours_worked: e.target.value }))} />
              </div>
              <Input placeholder="Delay reason (optional)" value={logForm.delay_reason} onChange={(e) => setLogForm(f => ({ ...f, delay_reason: e.target.value }))} />
              <Button size="sm" onClick={addLog} className="w-full"><Plus className="h-3 w-3 mr-1" />Log entry</Button>
            </Card>
            <div className="space-y-2">
              {logs.map(l => (
                <div key={l.id} className="border border-border rounded p-2 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span>{format(parseISO(l.log_date), "d MMM yyyy")}</span>
                    {l.delay_reason && <Badge variant="destructive" className="text-[9px]">Delay</Badge>}
                  </div>
                  <p className="mt-1">{l.notes}</p>
                  <div className="mt-1 text-muted-foreground">
                    {l.weather && <span>☁ {l.weather} · </span>}
                    {l.hours_worked != null && <span>⏱ {l.hours_worked}h · </span>}
                    {l.delay_reason && <span>⚠ {l.delay_reason}</span>}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// ============ New schedule dialog ============
function NewScheduleDialog({ open, onOpenChange, templates, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; templates: Schedule[];
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [start, setStart] = useState(fmtDate(today));
  const [finish, setFinish] = useState(fmtDate(addDays(today, 56)));
  const [starter, setStarter] = useState<string>("blank");
  const [tplId, setTplId] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!name.trim()) return toast.error("Name required");
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { toast.error("Sign in required"); return; }
      const { data: sch, error } = await supabase.from("construction_schedules").insert({
        user_id: u.user.id, name: name.trim(),
        planned_start: start, planned_finish: finish, colour_palette: TRADE_COLOURS,
      }).select().single();
      if (error || !sch) throw error;

      // Clone from template
      if (tplId !== "none") {
        const [{ data: srcPh }, { data: srcT }] = await Promise.all([
          supabase.from("construction_phases").select("*").eq("schedule_id", tplId).order("position"),
          supabase.from("construction_tasks").select("*").eq("schedule_id", tplId).order("position"),
        ]);
        const phaseIdMap = new Map<string, string>();
        for (const p of (srcPh ?? []) as Phase[]) {
          const { data: np } = await supabase.from("construction_phases").insert({ schedule_id: sch.id, name: p.name, position: p.position, colour: p.colour }).select().single();
          if (np) phaseIdMap.set(p.id, np.id);
        }
        const taskRows = ((srcT ?? []) as Task[]).map(t => ({
          schedule_id: sch.id, phase_id: t.phase_id ? (phaseIdMap.get(t.phase_id) ?? null) : null,
          name: t.name, trade: t.trade, duration_days: t.duration_days,
          planned_start: start, planned_finish: fmtDate(addDays(parseISO(start), t.duration_days)),
          position: t.position, priority: t.priority, is_milestone: t.is_milestone, notes: t.notes,
        }));
        if (taskRows.length) await supabase.from("construction_tasks").insert(taskRows);
      } else if (starter !== "blank") {
        const tpl = STARTER_TEMPLATES[starter as keyof typeof STARTER_TEMPLATES];
        let cursor = parseISO(start);
        let pos = 0;
        for (const grp of tpl) {
          const { data: np } = await supabase.from("construction_phases").insert({ schedule_id: sch.id, name: grp.phase, position: pos++ }).select().single();
          let tpos = 0;
          for (const [tname, trade, dur] of grp.tasks) {
            await supabase.from("construction_tasks").insert({
              schedule_id: sch.id, phase_id: np?.id ?? null, name: tname, trade,
              planned_start: fmtDate(cursor), planned_finish: fmtDate(addDays(cursor, dur - 1)),
              duration_days: dur, position: tpos++,
            });
            cursor = addDays(cursor, dur);
          }
        }
      }

      toast.success("Schedule created");
      onCreated(sch.id);
      onOpenChange(false);
      setName(""); setStarter("blank"); setTplId("none");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" />New schedule</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New construction schedule</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Project name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 12 Brentford Rd — full refurb" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Planned start</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><Label>Planned finish</Label><Input type="date" value={finish} onChange={(e) => setFinish(e.target.value)} /></div>
          </div>
          <div>
            <Label>Starter template</Label>
            <Select value={starter} onValueChange={setStarter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="blank">Blank</SelectItem>
                {Object.keys(STARTER_TEMPLATES).map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {templates.length > 0 && (
            <div>
              <Label>Or clone from your template</Label>
              <Select value={tplId} onValueChange={(v) => { setTplId(v); if (v !== "none") setStarter("blank"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={create} disabled={saving}>
            {saving ? "Creating…" : <><Copy className="h-4 w-4 mr-1" />Create</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Client picker ============
function ClientPicker({
  scheduleId,
  value,
  onChange,
}: {
  scheduleId: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [clients, setClients] = useState<Array<{ user_id: string; display_name: string | null }>>([]);
  useEffect(() => {
    supabase
      .from("client_profiles")
      .select("user_id, display_name")
      .order("display_name")
      .then(({ data }) => setClients((data as any) ?? []));
  }, []);
  const save = async (next: string) => {
    const client_id = next === "none" ? null : next;
    const { error } = await supabase
      .from("construction_schedules")
      .update({ client_id })
      .eq("id", scheduleId);
    if (error) return toast.error(error.message);
    onChange(client_id);
    toast.success(client_id ? "Client assigned" : "Client unassigned");
  };
  return (
    <Select value={value ?? "none"} onValueChange={save}>
      <SelectTrigger className="h-8 w-56 text-xs">
        <SelectValue placeholder="Assign client…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">— No client —</SelectItem>
        {clients.map((c) => (
          <SelectItem key={c.user_id} value={c.user_id}>
            {c.display_name ?? "Unnamed client"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}