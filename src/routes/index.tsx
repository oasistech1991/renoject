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
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hartstone Holdings — Property investment toolkit" },
      { name: "description", content: "A single workspace for UK property investors: deal calculators, HMO compliance, market search, renovation costs and tradesmen." },
      { property: "og:title", content: "Hartstone Holdings" },
      { property: "og:description", content: "A single workspace for UK property investors — calculators, compliance, market search and tradesmen." },
      { property: "og:url", content: "https://hartstoneholdings.com/" },
    ],
    links: [
      { rel: "canonical", href: "https://hartstoneholdings.com/" },
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
      {/* Hero workspace panel */}
      <section className="mb-10 rounded-2xl border border-border bg-card/40 p-8 lg:p-10">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-muted bg-background/40 px-3 py-1 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">
              Hartstone Holdings
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
