import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Calculator,
  Hammer,
  LineChart,
  Search,
  Building2,
  ShieldCheck,
  Wrench,
  Coins,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hartstone Holdings — Property investment toolkit" },
      { name: "description", content: "A single workspace for UK property investors: deal calculators, HMO compliance, market search, renovation costs and tradesmen." },
      { property: "og:title", content: "Hartstone Holdings" },
      { property: "og:description", content: "A single workspace for UK property investors — calculators, compliance, market search and tradesmen." },
    ],
  }),
  component: Index,
});

const tools: Array<{ to: string; title: string; desc: string; icon: typeof Calculator; free?: boolean }> = [
  { to: "/refinance", title: "Property Calculator", desc: "Model BTL, BRRR, mortgage and cash purchases in one place.", icon: Calculator, free: true },
  { to: "/condition", title: "Renovation Calculator", desc: "Estimate refurb costs room-by-room with current UK rates.", icon: Hammer },
  { to: "/forecast", title: "Forecast", desc: "Project long-term cashflow, equity and yield trajectories.", icon: LineChart },
  { to: "/market", title: "Market Search", desc: "Find live deals matched to your investment criteria.", icon: Search },
  { to: "/properties", title: "View Deals", desc: "Curated property opportunities ready to underwrite.", icon: Building2 },
  { to: "/hmo-compliance", title: "HMO Compliance", desc: "Check floorplans against UK HMO licensing rules.", icon: ShieldCheck },
  { to: "/tradesmen", title: "Tradesmen", desc: "Trusted contractors for refurbs, BTL and HMO conversions.", icon: Wrench },
  { to: "/tokenize", title: "Tokenize", desc: "Fractionalise property equity for syndicated investment.", icon: Coins },
];

function Index() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-background to-background" />
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Hartstone Holdings
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            The complete toolkit for serious UK property investors.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Underwrite deals, check HMO compliance, estimate refurb costs and find tradesmen — all in one workspace, for £1/month.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/refinance"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Open Property Calculator
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center rounded-md border border-input bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Tools grid */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Explore the tools</h2>
            <p className="mt-1 text-sm text-muted-foreground">Jump straight into any workflow.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className="group relative flex flex-col rounded-xl border border-border bg-card/40 p-5 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card/70 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  {t.free && (
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                      Free
                    </span>
                  )}
                </div>
                <h3 className="text-base font-semibold text-foreground">{t.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
                <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Open <ArrowRight className="h-3 w-3" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
