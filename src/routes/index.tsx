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
  Coins,
  Wallet,
  Users,
} from "lucide-react";

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
  { to: "/market", title: "Market Search", desc: "Find live deals matched to your investment criteria.", icon: Search },
  { to: "/properties", title: "View Deals", desc: "Curated property opportunities ready to underwrite.", icon: Building2 },
  { to: "/forecast", title: "Forecast", desc: "Project long-term cashflow, equity and yield trajectories.", icon: LineChart },
  { to: "/hmo-compliance", title: "HMO Compliance", desc: "Check floorplans against UK HMO licensing rules.", icon: ShieldCheck },
  { to: "/tradesmen", title: "Tradesmen", desc: "Trusted contractors for refurbs, BTL and HMO conversions.", icon: Wrench },
  { to: "/tokenize", title: "Tokenize", desc: "Fractionalise property equity for syndicated investment.", icon: Coins },
];

function Index() {
  return (
    <div className="px-6 py-8 lg:px-10 lg:py-10 max-w-7xl mx-auto w-full">
      <AdminCashPipeline />
      {/* Hero workspace panel */}
      <section className="mb-10 rounded-2xl border border-border bg-card/40 p-8 lg:p-10">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-muted bg-background/40 px-3 py-1 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">
              Renoject
            </span>
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground leading-[1.1] mb-6">
            The complete toolkit for{" "}
            <span className="text-muted-foreground">serious</span> UK property investors.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            Underwrite deals, check HMO compliance, estimate refurb costs and find tradesmen —
            all in one workspace, for £1/month.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/refinance"
              search={{}}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-all hover:opacity-90"
            >
              Open Property Calculator
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
            <Link
              to="/market"
              className="inline-flex items-center rounded-lg border border-muted px-6 py-3 text-sm font-bold text-foreground transition-all hover:bg-accent"
            >
              Browse Market
            </Link>
          </div>
        </div>
      </section>

      {/* Tools grid */}
      <section>
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-foreground mb-1">Explore the tools</h2>
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
