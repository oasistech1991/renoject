import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2, ShieldAlert, Users, LineChart, ListChecks, Phone, Mail,
  StickyNote, CalendarClock, MessageSquare, ThumbsUp, Vote, Bookmark,
  ArrowRightCircle, CheckCircle2, Plus, TrendingUp, AlertCircle, Building2 as BuildingPlus,
} from "lucide-react";
import {
  Home as HomeIcon, Hammer, Building2, KeyRound, Wrench, BarChart3, Inbox,
  Receipt, ShieldCheck, FileText, BadgePoundSterling, Users2,
} from "lucide-react";
import { SalesBoard } from "@/components/crm/property/Sales";
import { PropertiesTable } from "@/components/crm/property/Properties";
import { PropertyDetailSheet } from "@/components/crm/property/PropertyDetail";
import { ProjectsBoard } from "@/components/crm/property/Projects";
import { LettingsBoard } from "@/components/crm/property/Lettings";
import { ContractorsRoster } from "@/components/crm/property/Contractors";
import { LeadsInbox } from "@/components/crm/property/Leads";
import { Reports as PropertyReports } from "@/components/crm/property/Reports";
import { HomeBoard } from "@/components/crm/property/Home";
import { TenanciesView } from "@/components/crm/property/Tenancies";
import { RentLedger } from "@/components/crm/property/Rent";
import { ExpensesView } from "@/components/crm/property/Expenses";
import { ComplianceView } from "@/components/crm/property/Compliance";
import { DocumentsView } from "@/components/crm/property/Documents";

export const Route = createFileRoute("/crm")({ component: CrmPage });

/* ===================== Types ===================== */
type Stage = "new" | "qualified" | "interested" | "negotiating" | "won" | "lost";
const STAGES: Stage[] = ["new", "qualified", "interested", "negotiating", "won", "lost"];
const STAGE_LABEL: Record<Stage, string> = {
  new: "New", qualified: "Qualified", interested: "Interested",
  negotiating: "Negotiating", won: "Won", lost: "Lost",
};
const STAGE_COLOR: Record<Stage, string> = {
  new: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  qualified: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  interested: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  negotiating: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  won: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  lost: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

type Profile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  available_capital: number | null;
  preferred_areas: string[];
  preferred_deal_types: string[];
};
type Meta = {
  client_id: string;
  owner_id: string | null;
  stage: Stage;
  lifecycle_value: number;
  last_contacted_at: string | null;
  next_action_at: string | null;
  tags: string[];
  source: string | null;
  notes: string | null;
};
type Contact = Profile & Partial<Meta>;

type DealClient = {
  id: string;
  client_id: string;
  feed_post_id: string;
  stage: Stage;
  probability: number;
  amount: number | null;
  owner_id: string | null;
  notes: string | null;
};
type Task = {
  id: string;
  title: string;
  body: string | null;
  client_id: string | null;
  assignee_id: string | null;
  due_at: string | null;
  priority: number;
  status: "open" | "done" | "snoozed";
  completed_at: string | null;
};
type Activity = {
  id: string;
  client_id: string;
  team_member_id: string | null;
  type: "note" | "call" | "meeting" | "email" | "dm" | "interest" | "vote" | "save" | "stage_change" | "task_done";
  subject: string | null;
  body: string | null;
  feed_post_id: string | null;
  occurred_at: string;
};
type FeedPost = { id: string; title: string | null; address: string | null };

/* ===================== Helpers ===================== */
const fmtGBP = (n: number | null | undefined) =>
  typeof n === "number" ? `£${Math.round(n).toLocaleString()}` : "—";
const initials = (name?: string | null) =>
  (name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const daysSince = (iso: string | null) => {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
};

/* ===================== Page ===================== */
function CrmPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<DealClient[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [posts, setPosts] = useState<Record<string, FeedPost>>({});
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [addPropertyOpen, setAddPropertyOpen] = useState(false);
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);
  const [view, setView] = useState<string>("home");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const { data: roleRow } = await supabase.from("user_roles")
        .select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!roleRow);
      setLoading(false);
    })();
  }, []);

  const refresh = async () => {
    const [profilesRes, metaRes, dealRes, taskRes, postRes] = await Promise.all([
      supabase.from("client_profiles").select("user_id, display_name, avatar_url, available_capital, preferred_areas, preferred_deal_types"),
      supabase.from("crm_contact_meta").select("*"),
      supabase.from("crm_deal_clients").select("*"),
      supabase.from("crm_tasks").select("*").order("due_at", { ascending: true, nullsFirst: false }),
      supabase.from("feed_posts").select("id, title, address"),
    ]);
    const metaMap = new Map<string, Meta>((metaRes.data ?? []).map((m: any) => [m.client_id, m]));
    const merged: Contact[] = (profilesRes.data ?? []).map((p: any) => ({
      ...p,
      ...(metaMap.get(p.user_id) ?? { stage: "new" as Stage, tags: [], lifecycle_value: 0 }),
    }));
    setContacts(merged);
    setDeals((dealRes.data as DealClient[]) ?? []);
    setTasks((taskRes.data as Task[]) ?? []);
    const pMap: Record<string, FeedPost> = {};
    (postRes.data ?? []).forEach((p: any) => { pMap[p.id] = p; });
    setPosts(pMap);
  };

  useEffect(() => { if (isAdmin) refresh(); }, [isAdmin]);

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!userId) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-lg font-semibold text-foreground">Sign in required</h1>
        <Button asChild className="mt-4"><a href="/auth">Sign in</a></Button>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 text-lg font-semibold text-foreground">Team CRM</h1>
        <p className="mt-1 text-sm text-muted-foreground">Only Renoject team members can access the CRM.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1600px] gap-6 p-4 lg:p-6">
      <CrmSidebar view={view} onChange={setView} />

      <div className="min-w-0 flex-1">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{VIEW_TITLE[view] ?? "CRM"}</h1>
            <p className="text-sm text-muted-foreground">{VIEW_DESC[view] ?? ""}</p>
          </div>
          <PrimaryAction
            view={view}
            onAddProperty={() => setAddPropertyOpen(true)}
            onNewTask={() => setNewTaskOpen(true)}
          />
        </div>

        {view === "home" && <HomeBoard onJump={setView} />}
        {view === "properties" && <PropertiesTable onOpenProperty={setActivePropertyId} />}
        {view === "tenancies" && <TenanciesView onOpenProperty={setActivePropertyId} />}
        {view === "rent" && <RentLedger />}
        {view === "expenses" && <ExpensesView />}
        {view === "tasks" && (
          <TasksView tasks={tasks} contacts={contacts} meId={userId} onChanged={refresh} onOpenContact={setActiveContact} />
        )}
        {view === "compliance" && <ComplianceView />}
        {view === "documents" && <DocumentsView />}
        {view === "suppliers" && <ContractorsRoster />}
        {view === "sales" && <SalesBoard onOpenProperty={setActivePropertyId} />}
        {view === "projects" && <ProjectsBoard onOpenProperty={setActivePropertyId} />}
        {view === "lettings_legacy" && <LettingsBoard />}
        {view === "leads" && <LeadsInbox />}
        {view === "investors" && (
          <div className="space-y-6">
            <Dashboard contacts={contacts} deals={deals} tasks={tasks} posts={posts} onOpenContact={setActiveContact} />
            <PipelineBoard contacts={contacts} onOpenContact={setActiveContact} onChanged={refresh} />
            <DealPipeline deals={deals} contacts={contacts} posts={posts} onChanged={refresh} onOpenContact={setActiveContact} />
            <ContactsTable contacts={contacts} tasks={tasks} onOpenContact={setActiveContact} />
          </div>
        )}
        {view === "reports" && <PropertyReports />}
      </div>

      <ContactSheet
        contact={activeContact}
        deals={deals.filter((d) => d.client_id === activeContact?.user_id)}
        tasks={tasks.filter((t) => t.client_id === activeContact?.user_id)}
        posts={posts}
        meId={userId}
        onClose={() => setActiveContact(null)}
        onChanged={async () => { await refresh(); }}
      />

      <PropertyDetailSheet
        propertyId={activePropertyId}
        onClose={() => setActivePropertyId(null)}
      />

      <NewTaskDialog
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
        contacts={contacts}
        meId={userId}
        onCreated={refresh}
      />

      <AddPropertyDialog
        open={addPropertyOpen}
        onOpenChange={setAddPropertyOpen}
        onCreated={() => { setAddPropertyOpen(false); }}
      />
    </div>
  );
}

/* ===================== Contextual primary action ===================== */
function PrimaryAction({
  view, onAddProperty, onNewTask,
}: { view: string; onAddProperty: () => void; onNewTask: () => void }) {
  const dispatch = (key: string) =>
    window.dispatchEvent(new CustomEvent("crm:primary-action", { detail: { view: key } }));

  const map: Record<string, { label: string; onClick: () => void } | null> = {
    home: { label: "Add property", onClick: onAddProperty },
    properties: { label: "Add property", onClick: onAddProperty },
    tenancies: { label: "New tenancy", onClick: () => { dispatch("tenancies"); toast.message("Open a property to add a tenancy"); } },
    rent: { label: "Log payment", onClick: () => { dispatch("rent"); toast.message("Click a cell in the rent grid to log a payment"); } },
    expenses: { label: "Add expense", onClick: () => dispatch("expenses") },
    tasks: { label: "New task", onClick: onNewTask },
    compliance: { label: "Add certificate", onClick: () => dispatch("compliance") },
    documents: { label: "Upload document", onClick: () => dispatch("documents") },
    suppliers: { label: "Add supplier", onClick: () => dispatch("suppliers") },
    sales: { label: "Add deal", onClick: () => dispatch("sales") },
    projects: { label: "Add project", onClick: () => dispatch("projects") },
    lettings_legacy: { label: "Add unit", onClick: () => dispatch("lettings_legacy") },
    leads: { label: "Add lead", onClick: () => dispatch("leads") },
    investors: { label: "Add investor", onClick: () => dispatch("investors") },
    reports: null,
  };
  const a = map[view];
  if (!a) return null;
  return (
    <Button onClick={a.onClick}><Plus className="mr-1 h-4 w-4" /> {a.label}</Button>
  );
}

/* ===================== Add property dialog ===================== */
function AddPropertyDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (b: boolean) => void; onCreated: () => void }) {
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [propertyType, setPropertyType] = useState<"btl" | "hmo" | "flip" | "commercial" | "mixed" | "dev_site" | "other">("btl");
  const [status, setStatus] = useState<"sourcing" | "under_offer" | "owned" | "refurb" | "let" | "sold">("sourcing");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [beds, setBeds] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!address.trim()) { toast.error("Address is required"); return; }
    setSaving(true);
    const { error } = await supabase.from("crm_properties").insert({
      address: address.trim(),
      postcode: postcode.trim() || null,
      property_type: propertyType,
      status,
      purchase_price: purchasePrice ? Number(purchasePrice) : null,
      current_value: currentValue ? Number(currentValue) : null,
      beds: beds ? Number(beds) : null,
      notes: notes || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Property added");
    setAddress(""); setPostcode(""); setPurchasePrice(""); setCurrentValue(""); setBeds(""); setNotes("");
    setPropertyType("btl"); setStatus("sourcing");
    onCreated();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>Add property</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-3">
          <Input placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
          <Input placeholder="Postcode" value={postcode} onChange={(e) => setPostcode(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={propertyType} onValueChange={(v) => setPropertyType(v as typeof propertyType)}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="btl">Buy to let</SelectItem>
                <SelectItem value="hmo">HMO</SelectItem>
                <SelectItem value="flip">Flip</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="mixed">Mixed use</SelectItem>
                <SelectItem value="dev_site">Dev site</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sourcing">Sourcing</SelectItem>
                <SelectItem value="under_offer">Under offer</SelectItem>
                <SelectItem value="owned">Owned</SelectItem>
                <SelectItem value="refurb">In refurb</SelectItem>
                <SelectItem value="let">Let</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input type="number" placeholder="Purchase £" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
            <Input type="number" placeholder="Value £" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
            <Input type="number" placeholder="Beds" value={beds} onChange={(e) => setBeds(e.target.value)} />
          </div>
          <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button onClick={save} disabled={saving} className="w-full">{saving ? "Saving…" : "Create property"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ===================== Sidebar ===================== */
const NAV_GROUPS: { label: string; items: { key: string; label: string; icon: any }[] }[] = [
  { label: "Operations", items: [
    { key: "home", label: "Home", icon: HomeIcon },
    { key: "properties", label: "Properties", icon: Building2 },
    { key: "tenancies", label: "Tenancies", icon: Users2 },
    { key: "rent", label: "Rent", icon: BadgePoundSterling },
    { key: "expenses", label: "Expenses", icon: Receipt },
    { key: "tasks", label: "Tasks", icon: ListChecks },
    { key: "compliance", label: "Compliance", icon: ShieldCheck },
    { key: "documents", label: "Documents", icon: FileText },
    { key: "suppliers", label: "Suppliers", icon: Wrench },
  ]},
  { label: "Growth", items: [
    { key: "sales", label: "Sales pipeline", icon: HomeIcon },
    { key: "projects", label: "Projects", icon: Hammer },
    { key: "lettings_legacy", label: "Lettings board", icon: KeyRound },
    { key: "leads", label: "Leads", icon: Inbox },
    { key: "investors", label: "Investors", icon: Users },
  ]},
  { label: "Insights", items: [
    { key: "reports", label: "Reports", icon: BarChart3 },
  ]},
];

const VIEW_TITLE: Record<string, string> = {
  home: "Home", properties: "Properties", tenancies: "Tenancies", rent: "Rent ledger",
  expenses: "Expenses", tasks: "Tasks", compliance: "Compliance", documents: "Documents",
  suppliers: "Suppliers", sales: "Sales pipeline", projects: "Projects",
  lettings_legacy: "Lettings board", leads: "Leads", investors: "Investors", reports: "Reports",
};
const VIEW_DESC: Record<string, string> = {
  home: "What needs your attention today.",
  properties: "Operational record of every property you own or are sourcing.",
  tenancies: "Active and recent tenancies across the portfolio.",
  rent: "Six-month rent collection grid. Click a cell to log a payment.",
  expenses: "Track running costs by property and category.",
  tasks: "Today, this week, and overdue work.",
  compliance: "Gas, EICR, EPC and other certificates with expiry tracking.",
  documents: "Tenancy agreements, certificates and statements per property.",
  suppliers: "Contractor roster, ratings and preferred status.",
  sales: "Sourcing → under offer → owned kanban.",
  projects: "Refurb project board with budget burn.",
  lettings_legacy: "Units board by status.",
  leads: "Top-of-funnel leads to convert into investors.",
  investors: "Investor pipeline, deals and contact list.",
  reports: "Portfolio KPIs and performance.",
};

function CrmSidebar({ view, onChange }: { view: string; onChange: (v: string) => void }) {
  // Use SalesBoard's icon look swap: pick distinct icons for sales
  return (
    <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-56 shrink-0 overflow-y-auto rounded-lg border border-border bg-card/40 p-3 md:block">
      {NAV_GROUPS.map((g) => (
        <div key={g.label} className="mb-4">
          <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</div>
          <div className="space-y-0.5">
            {g.items.map((it) => {
              const Icon = it.icon;
              const active = view === it.key;
              return (
                <button key={it.key} onClick={() => onChange(it.key)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition ${
                    active ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}>
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{it.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="border-t border-border pt-3">
        <Link to="/feed" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground">
          ← Back to feed
        </Link>
      </div>
    </aside>
  );
}

/* ===================== Dashboard ===================== */
function Dashboard({ contacts, deals, tasks, posts, onOpenContact }: {
  contacts: Contact[]; deals: DealClient[]; tasks: Task[]; posts: Record<string, FeedPost>;
  onOpenContact: (c: Contact) => void;
}) {
  const valueByStage = useMemo(() => {
    const map = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
    deals.forEach((d) => { map[d.stage] += (d.amount ?? 0) * (d.probability / 100); });
    return map;
  }, [deals]);
  const totalPipeline = Object.values(valueByStage).reduce((a, b) => a + b, 0);

  const funnel = useMemo(() => {
    const counts = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
    contacts.forEach((c) => { counts[(c.stage ?? "new") as Stage] += 1; });
    return counts;
  }, [contacts]);
  const leadCount = funnel.new + funnel.qualified + funnel.interested + funnel.negotiating + funnel.won;
  const wonRate = leadCount > 0 ? Math.round((funnel.won / leadCount) * 100) : 0;

  const stale = useMemo(() => {
    const buckets = { d14: [] as Contact[], d30: [] as Contact[], d60: [] as Contact[] };
    contacts.forEach((c) => {
      const d = daysSince(c.last_contacted_at ?? null);
      if (d >= 60) buckets.d60.push(c);
      else if (d >= 30) buckets.d30.push(c);
      else if (d >= 14) buckets.d14.push(c);
    });
    return buckets;
  }, [contacts]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
  const openTasks = tasks.filter((t) => t.status === "open");
  const dueToday = openTasks.filter((t) => t.due_at && new Date(t.due_at) <= new Date(today.getTime() + 86400000));
  const dueWeek = openTasks.filter((t) => t.due_at && new Date(t.due_at) <= weekEnd);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Pipeline value" value={fmtGBP(totalPipeline)} hint="Weighted by probability" />
        <Kpi label="Total contacts" value={contacts.length.toString()} hint={`${funnel.won} won · ${funnel.lost} lost`} />
        <Kpi label="Win rate" value={`${wonRate}%`} hint="Won / (new+qual+int+neg+won)" />
        <Kpi label="Open tasks" value={openTasks.length.toString()} hint={`${dueToday.length} today · ${dueWeek.length} this week`} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Pipeline value by stage</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {STAGES.filter((s) => s !== "lost").map((s) => {
              const v = valueByStage[s];
              const pct = totalPipeline > 0 ? Math.round((v / totalPipeline) * 100) : 0;
              return (
                <div key={s} className="flex items-center gap-3">
                  <div className="w-28 text-xs"><Badge variant="outline" className={STAGE_COLOR[s]}>{STAGE_LABEL[s]}</Badge></div>
                  <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-24 text-right text-xs text-foreground">{fmtGBP(v)}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Conversion funnel</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(["new","qualified","interested","negotiating","won"] as Stage[]).map((s) => {
                const max = Math.max(...STAGES.map((x) => funnel[x]), 1);
                const pct = Math.round((funnel[s] / max) * 100);
                return (
                  <div key={s} className="flex items-center gap-3">
                    <div className="w-28 text-xs"><Badge variant="outline" className={STAGE_COLOR[s]}>{STAGE_LABEL[s]}</Badge></div>
                    <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="w-10 text-right text-xs text-foreground">{funnel[s]}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Stale clients</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {([
              ["No contact in 14+ days", stale.d14],
              ["No contact in 30+ days", stale.d30],
              ["No contact in 60+ days", stale.d60],
            ] as [string, Contact[]][]).map(([label, list]) => (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold text-foreground">{list.length}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {list.slice(0, 6).map((c) => (
                    <button key={c.user_id} onClick={() => onOpenContact(c)}
                      className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] hover:bg-accent">
                      {c.display_name || "Unnamed"}
                    </button>
                  ))}
                  {list.length === 0 && <span className="text-xs text-muted-foreground">All caught up</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {dueToday.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="h-4 w-4 text-amber-500" />Due today</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {dueToday.map((t) => {
                const c = contacts.find((x) => x.user_id === t.client_id);
                return (
                  <div key={t.id} className="flex items-center justify-between rounded border border-border p-2 text-sm">
                    <div>
                      <div className="font-medium text-foreground">{t.title}</div>
                      {c && <button onClick={() => onOpenContact(c)} className="text-xs text-muted-foreground hover:text-foreground">{c.display_name}</button>}
                    </div>
                    <Badge variant="outline">{t.due_at ? new Date(t.due_at).toLocaleDateString() : ""}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {void posts}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
        {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

/* ===================== Pipeline Kanban ===================== */
function PipelineBoard({ contacts, onOpenContact, onChanged }: {
  contacts: Contact[]; onOpenContact: (c: Contact) => void; onChanged: () => void;
}) {
  const grouped = useMemo(() => {
    const map: Record<Stage, Contact[]> = { new: [], qualified: [], interested: [], negotiating: [], won: [], lost: [] };
    contacts.forEach((c) => map[(c.stage ?? "new") as Stage].push(c));
    return map;
  }, [contacts]);

  const changeStage = async (c: Contact, stage: Stage) => {
    const { error } = await supabase
      .from("crm_contact_meta")
      .upsert({ client_id: c.user_id, stage }, { onConflict: "client_id" });
    if (error) toast.error(error.message); else { toast.success(`Moved to ${STAGE_LABEL[stage]}`); onChanged(); }
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {STAGES.map((s) => (
        <div key={s} className="rounded-lg border border-border bg-card/50 p-2">
          <div className="mb-2 flex items-center justify-between">
            <Badge variant="outline" className={STAGE_COLOR[s]}>{STAGE_LABEL[s]}</Badge>
            <span className="text-xs text-muted-foreground">{grouped[s].length}</span>
          </div>
          <div className="space-y-2">
            {grouped[s].map((c) => (
              <div key={c.user_id} className="rounded border border-border bg-background p-2 text-xs">
                <button onClick={() => onOpenContact(c)} className="flex w-full items-center gap-2 text-left">
                  <div className="h-7 w-7 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
                    {initials(c.display_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">{c.display_name || "Unnamed"}</div>
                    <div className="truncate text-[10px] text-muted-foreground">{fmtGBP(c.available_capital)} avail.</div>
                  </div>
                </button>
                <Select value={s} onValueChange={(v) => changeStage(c, v as Stage)}>
                  <SelectTrigger className="mt-2 h-7 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((x) => <SelectItem key={x} value={x}>Move to {STAGE_LABEL[x]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            {grouped[s].length === 0 && <div className="py-4 text-center text-[11px] text-muted-foreground">Empty</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ===================== Deal × Client pipeline ===================== */
function DealPipeline({ deals, contacts, posts, onChanged, onOpenContact }: {
  deals: DealClient[]; contacts: Contact[]; posts: Record<string, FeedPost>;
  onChanged: () => void; onOpenContact: (c: Contact) => void;
}) {
  const dealPostIds = Array.from(new Set(deals.map((d) => d.feed_post_id)));
  const [selectedPost, setSelectedPost] = useState<string | null>(dealPostIds[0] ?? null);
  useEffect(() => { if (!selectedPost && dealPostIds[0]) setSelectedPost(dealPostIds[0]); }, [dealPostIds, selectedPost]);

  const dealOptions = dealPostIds.map((id) => posts[id]).filter(Boolean);
  const rows = deals.filter((d) => d.feed_post_id === selectedPost);
  const grouped: Record<Stage, DealClient[]> = { new: [], qualified: [], interested: [], negotiating: [], won: [], lost: [] };
  rows.forEach((r) => grouped[r.stage].push(r));

  const updateRow = async (id: string, patch: Partial<DealClient>) => {
    const { error } = await supabase.from("crm_deal_clients").update(patch).eq("id", id);
    if (error) toast.error(error.message); else onChanged();
  };

  if (dealOptions.length === 0) {
    return <div className="rounded border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No deal interest yet. When clients tap "I'm interested" on the feed, deals appear here automatically.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground">Deal:</label>
        <Select value={selectedPost ?? undefined} onValueChange={setSelectedPost}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Pick a deal" /></SelectTrigger>
          <SelectContent>
            {dealOptions.map((p) => <SelectItem key={p.id} value={p.id}>{p.title || p.address || p.id.slice(0, 8)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {STAGES.map((s) => (
          <div key={s} className="rounded-lg border border-border bg-card/50 p-2">
            <div className="mb-2 flex items-center justify-between">
              <Badge variant="outline" className={STAGE_COLOR[s]}>{STAGE_LABEL[s]}</Badge>
              <span className="text-xs text-muted-foreground">{grouped[s].length}</span>
            </div>
            <div className="space-y-2">
              {grouped[s].map((row) => {
                const c = contacts.find((x) => x.user_id === row.client_id);
                return (
                  <div key={row.id} className="rounded border border-border bg-background p-2 text-xs">
                    <button onClick={() => c && onOpenContact(c)} className="text-left">
                      <div className="font-medium text-foreground">{c?.display_name || "Unknown"}</div>
                    </button>
                    <div className="mt-1 flex items-center gap-1">
                      <Input type="number" value={row.amount ?? ""} placeholder="£ amount" className="h-7 text-[11px]"
                        onChange={(e) => updateRow(row.id, { amount: e.target.value ? Number(e.target.value) : null })} />
                      <Input type="number" value={row.probability} min={0} max={100} className="h-7 w-16 text-[11px]"
                        onChange={(e) => updateRow(row.id, { probability: Math.max(0, Math.min(100, Number(e.target.value))) })} />
                      <span className="text-[10px] text-muted-foreground">%</span>
                    </div>
                    <Select value={row.stage} onValueChange={(v) => updateRow(row.id, { stage: v as Stage })}>
                      <SelectTrigger className="mt-1 h-7 text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STAGES.map((x) => <SelectItem key={x} value={x}>Move to {STAGE_LABEL[x]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
              {grouped[s].length === 0 && <div className="py-3 text-center text-[11px] text-muted-foreground">Empty</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===================== Contacts Table ===================== */
function ContactsTable({ contacts, tasks, onOpenContact }: {
  contacts: Contact[]; tasks: Task[]; onOpenContact: (c: Contact) => void;
}) {
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const filtered = contacts.filter((c) => {
    if (stageFilter !== "all" && (c.stage ?? "new") !== stageFilter) return false;
    if (!q) return true;
    const hay = `${c.display_name ?? ""} ${(c.tags ?? []).join(" ")} ${c.source ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });
  const nextTaskFor = (id: string) => tasks.find((t) => t.status === "open" && t.client_id === id && t.due_at);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search name, tag, source…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} contacts</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Stage</th>
              <th className="p-2 text-right">Capital</th>
              <th className="p-2 text-left">Last contact</th>
              <th className="p-2 text-left">Next task</th>
              <th className="p-2 text-left">Tags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const nt = nextTaskFor(c.user_id);
              const d = daysSince(c.last_contacted_at ?? null);
              return (
                <tr key={c.user_id} className="cursor-pointer border-t border-border hover:bg-accent/40" onClick={() => onOpenContact(c)}>
                  <td className="p-2 font-medium text-foreground">{c.display_name || "Unnamed"}</td>
                  <td className="p-2"><Badge variant="outline" className={STAGE_COLOR[(c.stage ?? "new") as Stage]}>{STAGE_LABEL[(c.stage ?? "new") as Stage]}</Badge></td>
                  <td className="p-2 text-right">{fmtGBP(c.available_capital)}</td>
                  <td className="p-2 text-xs text-muted-foreground">{d === Infinity ? "Never" : `${d}d ago`}</td>
                  <td className="p-2 text-xs">{nt ? `${nt.title} · ${nt.due_at ? new Date(nt.due_at).toLocaleDateString() : ""}` : "—"}</td>
                  <td className="p-2 text-xs">{(c.tags ?? []).join(", ") || "—"}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">No contacts match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===================== Tasks View ===================== */
function TasksView({ tasks, contacts, meId, onChanged, onOpenContact }: {
  tasks: Task[]; contacts: Contact[]; meId: string; onChanged: () => void; onOpenContact: (c: Contact) => void;
}) {
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const filtered = tasks.filter((t) => t.status === "open" && (scope === "team" || t.assignee_id === meId));
  const buckets = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
    const out = { overdue: [] as Task[], today: [] as Task[], week: [] as Task[], later: [] as Task[] };
    filtered.forEach((t) => {
      if (!t.due_at) { out.later.push(t); return; }
      const d = new Date(t.due_at);
      if (d < today) out.overdue.push(t);
      else if (d < tomorrow) out.today.push(t);
      else if (d < weekEnd) out.week.push(t);
      else out.later.push(t);
    });
    return out;
  }, [filtered]);

  const complete = async (t: Task) => {
    const { error } = await supabase.from("crm_tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", t.id);
    if (error) toast.error(error.message); else { toast.success("Task completed"); onChanged(); }
  };

  const Bucket = ({ label, items, accent }: { label: string; items: Task[]; accent?: string }) => (
    <div>
      <div className={`mb-2 flex items-center gap-2 text-xs font-semibold ${accent ?? "text-foreground"}`}>{label}<span className="text-muted-foreground">({items.length})</span></div>
      <div className="space-y-2">
        {items.map((t) => {
          const c = contacts.find((x) => x.user_id === t.client_id);
          return (
            <div key={t.id} className="flex items-center justify-between gap-2 rounded border border-border bg-card p-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground">{t.title}</div>
                <div className="text-xs text-muted-foreground">
                  {c ? <button onClick={() => onOpenContact(c)} className="hover:text-foreground">{c.display_name}</button> : "Unassigned client"}
                  {t.due_at && <span> · due {new Date(t.due_at).toLocaleDateString()}</span>}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => complete(t)}><CheckCircle2 className="h-4 w-4" /></Button>
            </div>
          );
        })}
        {items.length === 0 && <div className="rounded border border-dashed border-border p-3 text-center text-xs text-muted-foreground">Nothing here</div>}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Tabs value={scope} onValueChange={(v) => setScope(v as "mine" | "team")}>
          <TabsList>
            <TabsTrigger value="mine">My tasks</TabsTrigger>
            <TabsTrigger value="team">Team tasks</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Bucket label="Overdue" items={buckets.overdue} accent="text-rose-400" />
        <Bucket label="Today" items={buckets.today} accent="text-amber-400" />
        <Bucket label="This week" items={buckets.week} />
        <Bucket label="Later / undated" items={buckets.later} />
      </div>
    </div>
  );
}

/* ===================== New Task dialog ===================== */
function NewTaskDialog({ open, onOpenChange, contacts, meId, onCreated }: {
  open: boolean; onOpenChange: (b: boolean) => void;
  contacts: Contact[]; meId: string; onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [due, setDue] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("2");

  const save = async () => {
    if (!title.trim()) return;
    const { error } = await supabase.from("crm_tasks").insert({
      title: title.trim(),
      body: body || null,
      client_id: clientId || null,
      assignee_id: meId,
      created_by: meId,
      due_at: due ? new Date(due).toISOString() : null,
      priority: Number(priority),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Task created");
    setTitle(""); setClientId(""); setDue(""); setBody(""); setPriority("2");
    onOpenChange(false); onCreated();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader><SheetTitle>New task</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-3">
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger><SelectValue placeholder="Linked contact (optional)" /></SelectTrigger>
            <SelectContent>
              {contacts.map((c) => <SelectItem key={c.user_id} value={c.user_id}>{c.display_name || "Unnamed"}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">High priority</SelectItem>
              <SelectItem value="2">Normal</SelectItem>
              <SelectItem value="3">Low</SelectItem>
            </SelectContent>
          </Select>
          <Textarea placeholder="Notes" value={body} onChange={(e) => setBody(e.target.value)} />
          <Button onClick={save} className="w-full">Create task</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ===================== Contact detail sheet ===================== */
function ContactSheet({ contact, deals, tasks, posts, meId, onClose, onChanged }: {
  contact: Contact | null;
  deals: DealClient[];
  tasks: Task[];
  posts: Record<string, FeedPost>;
  meId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [logType, setLogType] = useState<"note" | "call" | "meeting" | "email">("note");
  const [logBody, setLogBody] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [quickTask, setQuickTask] = useState("");

  useEffect(() => {
    (async () => {
      if (!contact) { setActivities([]); return; }
      const { data } = await supabase.from("crm_activities").select("*")
        .eq("client_id", contact.user_id).order("occurred_at", { ascending: false }).limit(50);
      setActivities((data as Activity[]) ?? []);
    })();
  }, [contact]);

  if (!contact) return null;

  const updateMeta = async (patch: Partial<Meta>) => {
    const { error } = await supabase.from("crm_contact_meta")
      .upsert({ client_id: contact.user_id, ...patch }, { onConflict: "client_id" });
    if (error) toast.error(error.message); else await onChanged();
  };

  const logActivity = async () => {
    if (!logBody.trim()) return;
    const { error } = await supabase.from("crm_activities").insert({
      client_id: contact.user_id,
      team_member_id: meId,
      type: logType,
      subject: logBody.slice(0, 80),
      body: logBody,
    });
    if (error) { toast.error(error.message); return; }
    await updateMeta({ last_contacted_at: new Date().toISOString() });
    setLogBody("");
    const { data } = await supabase.from("crm_activities").select("*")
      .eq("client_id", contact.user_id).order("occurred_at", { ascending: false }).limit(50);
    setActivities((data as Activity[]) ?? []);
    toast.success("Logged");
  };

  const addTag = async () => {
    if (!tagInput.trim()) return;
    const next = Array.from(new Set([...(contact.tags ?? []), tagInput.trim()]));
    await updateMeta({ tags: next });
    setTagInput("");
  };

  const addQuickTask = async () => {
    if (!quickTask.trim()) return;
    const { error } = await supabase.from("crm_tasks").insert({
      title: quickTask.trim(), client_id: contact.user_id, assignee_id: meId, created_by: meId,
    });
    if (error) toast.error(error.message);
    else { toast.success("Task added"); setQuickTask(""); await onChanged(); }
  };

  const completeTask = async (t: Task) => {
    const { error } = await supabase.from("crm_tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", t.id);
    if (error) toast.error(error.message); else await onChanged();
  };

  return (
    <Sheet open={!!contact} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center">{initials(contact.display_name)}</div>
            <div>
              <div>{contact.display_name || "Unnamed"}</div>
              <div className="text-xs font-normal text-muted-foreground">Capital: {fmtGBP(contact.available_capital)}</div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Stage + DM */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={(contact.stage ?? "new") as Stage} onValueChange={(v) => updateMeta({ stage: v as Stage })}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button asChild variant="outline" size="sm">
              <Link to="/messages" search={{ client: contact.user_id }}><MessageSquare className="mr-1 h-4 w-4" />DM</Link>
            </Button>
          </div>

          {/* About */}
          <Card>
            <CardHeader><CardTitle className="text-sm">About</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-xs">
              <div><span className="text-muted-foreground">Preferred areas:</span> {(contact.preferred_areas ?? []).join(", ") || "—"}</div>
              <div><span className="text-muted-foreground">Deal types:</span> {(contact.preferred_deal_types ?? []).join(", ") || "—"}</div>
              <div><span className="text-muted-foreground">Source:</span>{" "}
                <input className="ml-1 rounded border border-border bg-background px-2 py-0.5 text-xs"
                  defaultValue={contact.source ?? ""} onBlur={(e) => updateMeta({ source: e.target.value || null })} />
              </div>
              <div className="flex flex-wrap items-center gap-1 pt-1">
                <span className="text-muted-foreground">Tags:</span>
                {(contact.tags ?? []).map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
                <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTag()} placeholder="add tag…" className="h-7 w-28 text-[11px]" />
              </div>
            </CardContent>
          </Card>

          {/* Deals */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Deals in flight</CardTitle></CardHeader>
            <CardContent>
              {deals.length === 0 ? (
                <div className="text-xs text-muted-foreground">No deals yet.</div>
              ) : (
                <div className="space-y-1">
                  {deals.map((d) => {
                    const p = posts[d.feed_post_id];
                    return (
                      <div key={d.id} className="flex items-center justify-between rounded border border-border p-2 text-xs">
                        <div>
                          <div className="font-medium text-foreground">{p?.title || p?.address || d.feed_post_id.slice(0, 8)}</div>
                          <div className="text-muted-foreground">{fmtGBP(d.amount)} · {d.probability}%</div>
                        </div>
                        <Badge variant="outline" className={STAGE_COLOR[d.stage]}>{STAGE_LABEL[d.stage]}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Log activity */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Log activity</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-1">
                {(["note","call","meeting","email"] as const).map((t) => (
                  <Button key={t} type="button" size="sm" variant={logType === t ? "default" : "outline"} onClick={() => setLogType(t)}>
                    {t === "note" && <StickyNote className="mr-1 h-3 w-3" />}
                    {t === "call" && <Phone className="mr-1 h-3 w-3" />}
                    {t === "meeting" && <CalendarClock className="mr-1 h-3 w-3" />}
                    {t === "email" && <Mail className="mr-1 h-3 w-3" />}
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Button>
                ))}
              </div>
              <Textarea placeholder="What happened?" value={logBody} onChange={(e) => setLogBody(e.target.value)} />
              <Button size="sm" onClick={logActivity}>Save</Button>
            </CardContent>
          </Card>

          {/* Tasks */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Tasks</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Input placeholder="Quick add task…" value={quickTask} onChange={(e) => setQuickTask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addQuickTask()} />
                <Button size="sm" onClick={addQuickTask}><Plus className="h-3 w-3" /></Button>
              </div>
              {tasks.length === 0 ? (
                <div className="text-xs text-muted-foreground">No tasks.</div>
              ) : (
                <div className="space-y-1">
                  {tasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded border border-border p-2 text-xs">
                      <div>
                        <div className={`font-medium ${t.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</div>
                        {t.due_at && <div className="text-muted-foreground">Due {new Date(t.due_at).toLocaleDateString()}</div>}
                      </div>
                      {t.status === "open" && (
                        <Button size="sm" variant="ghost" onClick={() => completeTask(t)}><CheckCircle2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Activity timeline</CardTitle></CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <div className="text-xs text-muted-foreground">No activity yet.</div>
              ) : (
                <ul className="space-y-2">
                  {activities.map((a) => (
                    <li key={a.id} className="flex gap-3 text-xs">
                      <ActivityIcon type={a.type} />
                      <div className="flex-1">
                        <div className="text-foreground">{a.subject || a.type}</div>
                        {a.body && <div className="text-muted-foreground">{a.body}</div>}
                        <div className="text-[10px] text-muted-foreground">{new Date(a.occurred_at).toLocaleString()}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ActivityIcon({ type }: { type: Activity["type"] }) {
  const cls = "h-4 w-4 mt-0.5 text-muted-foreground shrink-0";
  switch (type) {
    case "note": return <StickyNote className={cls} />;
    case "call": return <Phone className={cls} />;
    case "meeting": return <CalendarClock className={cls} />;
    case "email": return <Mail className={cls} />;
    case "dm": return <MessageSquare className={cls} />;
    case "interest": return <ThumbsUp className={cls} />;
    case "vote": return <Vote className={cls} />;
    case "save": return <Bookmark className={cls} />;
    case "stage_change": return <ArrowRightCircle className={cls} />;
    case "task_done": return <CheckCircle2 className={cls} />;
    default: return <StickyNote className={cls} />;
  }
}