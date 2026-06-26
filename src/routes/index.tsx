import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtGBP } from "@/lib/btl";
import {
  Calculator,
  Hammer,
  LineChart,
  Search,
  Building2,
  ShieldCheck,
  Wrench,
  Wallet,
  Users,
  Briefcase,
  ListChecks,
  TrendingUp,
  Activity,
} from "lucide-react";
import {
  PROJECT_STAGES,
  PROJECT_STAGE_LABEL,
  PROJECT_STAGE_COLOR,
  type ProjectStage,
} from "@/components/crm/property/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Renoject — Property investment toolkit" },
      { name: "description", content: "A single workspace for UK property investors: deal calculators, HMO compliance, market search, renovation costs and tradesmen." },
      { property: "og:title", content: "Renoject" },
      { property: "og:description", content: "A single workspace for UK property investors — calculators, compliance, market search and tradesmen." },
      { property: "og:url", content: "https://renojectholdings.com/" },
    ],
    links: [
      { rel: "canonical", href: "https://renojectholdings.com/" },
    ],
  }),
  component: Index,
});

const tools: Array<{ to: string; title: string; desc: string; icon: typeof Calculator; free?: boolean }> = [
  { to: "/refinance", title: "Property Calculator", desc: "Model BTL, BRRR, mortgage and cash purchases in one place.", icon: Calculator, free: true },
  { to: "/condition", title: "Renovation Calculator", desc: "Estimate refurb costs room-by-room with current UK rates.", icon: Hammer },
  { to: "/market", title: "Deal Locations", desc: "Browse Renoject deals on an interactive map with filters.", icon: Search },
  { to: "/properties", title: "View Deals", desc: "Curated property opportunities ready to underwrite.", icon: Building2 },
  { to: "/forecast", title: "Forecast", desc: "Project long-term cashflow, equity and yield trajectories.", icon: LineChart },
  { to: "/hmo-compliance", title: "HMO Compliance", desc: "Check floorplans against UK HMO licensing rules.", icon: ShieldCheck },
  { to: "/tradesmen", title: "Tradesmen", desc: "Trusted contractors for refurbs, BTL and HMO conversions.", icon: Wrench },
];

function Index() {
  return (
    <div className="px-6 py-8 lg:px-10 lg:py-10 max-w-7xl mx-auto w-full">
      <TeamDashboard />
      <AdminCashPipeline />

      {/* Tools grid */}
      <section>
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-foreground mb-1">Workspace tools</h2>
            <p className="text-sm text-muted-foreground">Jump straight into any workflow.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {tools.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to as "/refinance"}
                search={{}}
                className="group rounded-xl border border-border bg-card/60 p-5 transition-all hover:border-ring hover:bg-card"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background text-foreground transition-transform group-hover:scale-110">
                    <Icon className="h-5 w-5" />
                  </div>
                  {t.free && (
                    <span className="rounded bg-foreground/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground">
                      Free
                    </span>
                  )}
                </div>
                <h3 className="mb-2 font-display text-sm font-bold text-foreground">{t.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{t.desc}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

type ClientCapital = {
  user_id: string;
  display_name: string | null;
  available_capital: number | null;
  capital_notes: string | null;
  capital_updated_at: string | null;
  preferred_deal_types: string[] | null;
  location: string | null;
};

type DashboardData = {
  propertiesCount: number;
  pipelineValue: number;
  projectsByStage: Record<string, number>;
  openTasks: number;
  overdueTasks: number;
  newLeads: number;
  totalClientCapital: number;
  clientsReady: number;
  totalBudget: number;
  totalSpent: number;
  upcomingTasks: Array<{ id: string; title: string; due_at: string | null }>;
  recentLeads: Array<{ id: string; name: string; status: string; created_at?: string }>;
};

function TeamDashboard() {
  const [isTeam, setIsTeam] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [d, setD] = useState<DashboardData | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoaded(true); return; }
      const { data: role } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", user.id).eq("role", "admin").maybeSingle();
      const team = !!role;
      setIsTeam(team);
      if (!team) { setLoaded(true); return; }

      const [propsRes, projRes, tasksRes, leadsRes, capRes] = await Promise.all([
        supabase.from("crm_properties").select("id,purchase_price,current_value,status"),
        supabase.from("crm_projects").select("id,stage,budget,spent,name,target_end"),
        supabase.from("crm_tasks").select("id,title,status,due_at").neq("status", "done").order("due_at", { ascending: true, nullsFirst: false }).limit(50),
        supabase.from("crm_deal_clients").select("id,name,status,created_at").order("created_at", { ascending: false }).limit(8),
        supabase.from("client_profiles").select("user_id,available_capital").not("available_capital", "is", null),
      ]);

      const properties = (propsRes.data as Array<{ purchase_price: number | null; current_value: number | null }> | null) ?? [];
      const projects = (projRes.data as Array<{ stage: string; budget: number | null; spent: number | null }> | null) ?? [];
      const tasks = (tasksRes.data as Array<{ id: string; title: string; status: string; due_at: string | null }> | null) ?? [];
      const leads = (leadsRes.data as Array<{ id: string; name: string; status: string; created_at: string }> | null) ?? [];
      const caps = (capRes.data as Array<{ user_id: string; available_capital: number | null }> | null) ?? [];

      const projectsByStage: Record<string, number> = {};
      for (const s of PROJECT_STAGES) projectsByStage[s] = 0;
      for (const p of projects) { projectsByStage[p.stage] = (projectsByStage[p.stage] ?? 0) + 1; }

      const now = Date.now();
      const overdueTasks = tasks.filter((t) => t.due_at && new Date(t.due_at).getTime() < now).length;

      const pipelineValue = properties.reduce((s, p) => s + (Number(p.current_value) || Number(p.purchase_price) || 0), 0);
      const totalBudget = projects.reduce((s, p) => s + (Number(p.budget) || 0), 0);
      const totalSpent = projects.reduce((s, p) => s + (Number(p.spent) || 0), 0);
      const totalClientCapital = caps.reduce((s, c) => s + (Number(c.available_capital) || 0), 0);

      setD({
        propertiesCount: properties.length,
        pipelineValue,
        projectsByStage,
        openTasks: tasks.length,
        overdueTasks,
        newLeads: leads.filter((l) => l.status === "new").length,
        totalClientCapital,
        clientsReady: caps.length,
        totalBudget,
        totalSpent,
        upcomingTasks: tasks.slice(0, 5).map((t) => ({ id: t.id, title: t.title, due_at: t.due_at })),
        recentLeads: leads.slice(0, 5).map((l) => ({ id: l.id, name: l.name, status: l.status, created_at: l.created_at })),
      });
      setLoaded(true);
    })();
  }, []);

  if (!loaded) {
    return (
      <section className="mb-10 rounded-2xl border border-border bg-card/40 p-8 animate-pulse">
        <div className="h-6 w-48 bg-muted rounded mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-muted/50 rounded-lg" />)}
        </div>
      </section>
    );
  }

  if (!isTeam || !d) {
    return (
      <section className="mb-10 rounded-2xl border border-border bg-card/40 p-8 lg:p-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-muted bg-background/40 px-3 py-1 mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">Renoject</span>
        </div>
        <h1 className="font-display text-3xl lg:text-4xl font-bold text-foreground mb-3">Welcome back.</h1>
        <p className="text-sm text-muted-foreground">Jump into any tool below.</p>
      </section>
    );
  }

  const kpis = [
    { label: "Portfolio value", value: fmtGBP(d.pipelineValue), sub: `${d.propertiesCount} properties`, icon: Building2, to: "/crm" as const },
    { label: "Client capital ready", value: fmtGBP(d.totalClientCapital), sub: `${d.clientsReady} investors`, icon: Wallet, to: "/crm" as const },
    { label: "Project spend", value: fmtGBP(d.totalSpent), sub: `of ${fmtGBP(d.totalBudget)} budget`, icon: TrendingUp, to: "/crm" as const },
    { label: "Open tasks", value: String(d.openTasks), sub: d.overdueTasks > 0 ? `${d.overdueTasks} overdue` : "On track", icon: ListChecks, to: "/crm" as const },
  ];

  const activeStages = PROJECT_STAGES.filter((s) => (d.projectsByStage[s] ?? 0) > 0);

  return (
    <section className="mb-10 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary mb-3">
            <Activity className="h-3 w-3" /> Team dashboard
          </div>
          <h1 className="font-display text-3xl lg:text-4xl font-bold text-foreground">Renoject command centre</h1>
          <p className="text-sm text-muted-foreground mt-1">Live snapshot across portfolio, projects, leads and capital.</p>
        </div>
        <Link to="/crm" className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/15">
          <Briefcase className="h-3.5 w-3.5" /> Open CRM
        </Link>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const I = k.icon;
          return (
            <Link key={k.label} to={k.to} search={{}} className="group rounded-xl border border-border bg-card/60 p-4 hover:border-ring transition-all">
              <div className="flex items-start justify-between mb-3">
                <I className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold tabular-nums text-foreground">{k.value}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">{k.label}</div>
              <div className="text-xs text-muted-foreground mt-2">{k.sub}</div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Link to="/crm" search={{}} className="lg:col-span-2 rounded-xl border border-border bg-card/60 p-5 hover:border-ring transition-all">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm font-bold">Project pipeline</h3>
            <span className="text-[11px] text-muted-foreground">{Object.values(d.projectsByStage).reduce((a, b) => a + b, 0)} live</span>
          </div>
          {activeStages.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No active projects.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeStages.map((s) => (
                <div key={s} className={`rounded-md border px-3 py-2 text-xs ${PROJECT_STAGE_COLOR[s as ProjectStage]}`}>
                  <div className="font-bold tabular-nums text-base leading-tight">{d.projectsByStage[s]}</div>
                  <div className="text-[10px] uppercase tracking-wider opacity-80">{PROJECT_STAGE_LABEL[s as ProjectStage]}</div>
                </div>
              ))}
            </div>
          )}
        </Link>

        <div className="rounded-xl border border-border bg-card/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm font-bold">Upcoming tasks</h3>
            <Link to="/crm" search={{}} className="text-[11px] text-primary hover:underline">View all</Link>
          </div>
          {d.upcomingTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No open tasks.</p>
          ) : (
            <ul className="space-y-2">
              {d.upcomingTasks.map((t) => {
                const overdue = t.due_at && new Date(t.due_at).getTime() < Date.now();
                return (
                  <li key={t.id} className="flex items-start gap-2 text-xs">
                    <span className={`mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0 ${overdue ? "bg-destructive" : "bg-muted-foreground"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-foreground">{t.title}</div>
                      {t.due_at && (
                        <div className={`text-[10px] ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                          {new Date(t.due_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-sm font-bold">Recent leads</h3>
          <Link to="/crm" search={{}} className="text-[11px] text-primary hover:underline">Open leads</Link>
        </div>
        {d.recentLeads.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No leads yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
            {d.recentLeads.map((l) => (
              <div key={l.id} className="rounded-md border border-border bg-background/40 p-3">
                <div className="truncate text-sm font-semibold">{l.name}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{l.status}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function AdminCashPipeline() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [clients, setClients] = useState<ClientCapital[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoaded(true); return; }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      const admin = !!roles;
      setIsAdmin(admin);
      if (admin) {
        const { data } = await supabase
          .from("client_profiles")
          .select("user_id,display_name,available_capital,capital_notes,capital_updated_at,preferred_deal_types,location")
          .not("available_capital", "is", null)
          .order("available_capital", { ascending: false });
        setClients((data as ClientCapital[]) ?? []);
      }
      setLoaded(true);
    })();
  }, []);

  if (!loaded || !isAdmin) return null;

  const totalCapital = clients.reduce((sum, c) => sum + (Number(c.available_capital) || 0), 0);

  return (
    <section className="mb-10 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
            <Wallet className="h-3 w-3" /> Team dashboard
          </div>
          <h2 className="mt-3 font-display text-2xl font-bold">Client cash pipeline</h2>
          <p className="text-sm text-muted-foreground">
            {clients.length} client{clients.length === 1 ? "" : "s"} ready to deploy · <span className="font-semibold text-foreground">{fmtGBP(totalCapital)}</span> total
          </p>
        </div>
      </div>

      {clients.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No clients have shared their available cash yet.
        </p>
      ) : (
        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {clients.slice(0, 9).map((c) => (
            <div key={c.user_id} className="rounded-xl border border-border bg-background/60 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                    {(c.display_name ?? "?")[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{c.display_name ?? "Unnamed"}</div>
                    {c.location && <div className="truncate text-[11px] text-muted-foreground">{c.location}</div>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold tabular-nums text-primary">{fmtGBP(Number(c.available_capital) || 0)}</div>
                  {c.capital_updated_at && (
                    <div className="text-[10px] text-muted-foreground">{new Date(c.capital_updated_at).toLocaleDateString()}</div>
                  )}
                </div>
              </div>
              {c.capital_notes && (
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{c.capital_notes}</p>
              )}
              {c.preferred_deal_types && c.preferred_deal_types.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.preferred_deal_types.slice(0, 3).map((t) => (
                    <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <Link
                to="/messages"
                search={{ client: c.user_id }}
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                <Users className="h-3 w-3" /> Message client
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
