import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { CopilotFab } from "@/components/copilot/CopilotFab";
import { OnboardingTour } from "@/components/OnboardingTour";
import type { Session } from "@supabase/supabase-js";
import {
  Loader2,
  Home,
  Calculator,
  Building2,
  ShieldCheck,
  Menu,
  X,
  LogOut,
  Hammer,
  Search,
  LineChart,
  Wrench,
  UserCircle,
  Users,
  User,
  MessageSquare,
  Briefcase,
  HardHat,
  ScrollText,
} from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "RENOJECT" },
      { name: "description", content: "Property investment tools by RENOJECT — Property calculator, HMO compliance checker and renovation calculator." },
      { name: "author", content: "RENOJECT" },
      { property: "og:title", content: "RENOJECT" },
      { property: "og:description", content: "Property investment tools by RENOJECT — Property calculator, HMO compliance checker and renovation calculator." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@renoject" },
      { name: "twitter:title", content: "RENOJECT" },
      { name: "twitter:description", content: "Property investment tools by RENOJECT — Property calculator, HMO compliance checker and renovation calculator." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c1276a80-d9e7-4e45-ab8c-0ace548ad884/id-preview-f90c6f5c--33ab3ec4-e05b-416f-827e-db8cec69c227.lovable.app-1779874236024.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c1276a80-d9e7-4e45-ab8c-0ace548ad884/id-preview-f90c6f5c--33ab3ec4-e05b-416f-827e-db8cec69c227.lovable.app-1779874236024.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600&family=Sora:wght@600;700&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Renoject",
          url: "https://renojectholdings.com",
          description:
            "UK property investment toolkit — BTL & BRRR calculators, HMO compliance, market search, renovation costs and trusted tradesmen.",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Renoject",
          url: "https://renojectholdings.com",
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: "https://renojectholdings.com/market?q={search_term_string}",
            },
            "query-input": "required name=search_term_string",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Renoject",
          applicationCategory: "FinanceApplication",
          operatingSystem: "Web",
          description:
            "UK property investment toolkit: BTL/BRRR calculators, HMO compliance, market search, renovation costs, forecasting, and trusted tradesmen.",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "GBP",
          },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
    </QueryClientProvider>
  );
}

const PUBLIC_PATHS = new Set([
  "/",
  "/refinance",
  "/auth",
  "/reset-password",
  "/terms",
  "/privacy",
  "/account",
]);

function AuthGate() {
  const location = useLocation();
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("hh_unlocked") === "1") {
      setAdminUnlocked(true);
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  const path = location.pathname.replace(/\/+$/, "") || "/";
  const isPublicPath = PUBLIC_PATHS.has(path);
  const unlocked = adminUnlocked || !!session;

  // All routes are publicly accessible — no sign-in or subscription required.
  void isPublicPath;
  void unlocked;

  if (!sessionLoaded) {
    // Public legal/auth pages don't need to wait, render immediately
  }

  return (
    <>
      <AppShell
        session={session}
        isAdmin={adminUnlocked}
        onSignOut={() => {
          sessionStorage.removeItem("hh_unlocked");
          setAdminUnlocked(false);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("hh-admin-changed"));
          }
          supabase.auth.signOut();
        }}
      >
        <Outlet />
      </AppShell>
      <Toaster />
      <CopilotFab />
      <OnboardingTour />
    </>
  );
}



function SignInScreen({ onUnlock }: { onUnlock: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim().toUpperCase() === "HARTS" && password === "TAYLOR") {
      sessionStorage.setItem("hh_unlocked", "1");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("hh-admin-changed"));
      }
      setError(null);
      onUnlock();
    } else {
      setError("Invalid credentials");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-sm"
      >
        <h1 className="text-xl font-bold tracking-wide text-foreground">RENOJECT</h1>
        <p className="mt-2 text-sm text-muted-foreground">Admin sign-in. Customers should use the public sign-in below.</p>

        <label className="mt-6 block text-xs font-medium text-foreground">Username</label>
        <input
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />

        <label className="mt-4 block text-xs font-medium text-foreground">Password</label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />

        <Button type="submit" className="mt-6 w-full">
          Sign in
        </Button>
        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

        <div className="mt-6 border-t border-border pt-4 text-center text-xs text-muted-foreground">
          Not the admin?{" "}
          <a href="/auth" className="font-medium text-foreground underline">Customer sign in / sign up</a>
        </div>
      </form>
    </div>
  );
}

const TOOL_ITEMS: Array<{ to: string; label: string; icon: typeof Home }> = [
  { to: "/crm", label: "Team CRM", icon: Briefcase },
  { to: "/refinance", label: "Property Calculator", icon: Calculator },
  { to: "/condition", label: "Renovation", icon: Hammer },
  { to: "/market", label: "Deal Locations", icon: Search },
  { to: "/properties", label: "View Deals", icon: Building2 },
  { to: "/construction-timeline", label: "Construction Timeline", icon: HardHat },
  { to: "/forecast", label: "Forecast", icon: LineChart },
  { to: "/feed", label: "Client Feed", icon: Users },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/hmo-compliance", label: "HMO Compliance", icon: ShieldCheck },
  { to: "/legal", label: "Legal Review", icon: ScrollText },
  { to: "/tradesmen", label: "Tradesmen", icon: Wrench },
];

const ACCOUNT_ITEMS: Array<{ to: string; label: string; icon: typeof Home; authOnly?: boolean }> = [
  { to: "/profile", label: "My Profile", icon: User, authOnly: true },
  { to: "/account", label: "Account", icon: UserCircle, authOnly: true },
];

function AppShell({
  children,
  session,
  isAdmin,
  onSignOut,
}: {
  children: React.ReactNode;
  session: Session | null;
  isAdmin: boolean;
  onSignOut: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const initial = session?.user.email?.[0]?.toUpperCase() ?? "H";

  const sidebarBody = (
    <>
      <div className="p-6">
        <Link to="/" className="flex items-center gap-2 text-foreground" onClick={() => setMobileOpen(false)}>
          <span className="flex h-8 w-8 items-center justify-center rounded bg-primary font-display text-base font-extrabold text-primary-foreground">
            R
          </span>
          <span className="font-display text-base font-extrabold uppercase tracking-[0.18em] leading-none">
            RENOJECT
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        <Link
          to="/"
          activeOptions={{ exact: true }}
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          activeProps={{ className: "flex items-center gap-3 px-3 py-2 rounded-lg text-sm bg-accent text-foreground font-medium" }}
        >
          <Home className="h-4 w-4" />
          <span>Home</span>
        </Link>

        <div className="pt-4 pb-2 px-3 text-[10px] uppercase tracking-widest font-bold text-muted-foreground opacity-70">
          Tools
        </div>

        {TOOL_ITEMS.map((item) => {
          const Icon = item.icon;
          const isFeatured = item.to === "/crm";
          if (isFeatured) {
            return (
              <Link
                key={item.to}
                to={item.to as "/crm"}
                search={{}}
                onClick={() => setMobileOpen(false)}
                className="group relative flex items-center gap-3 px-3 py-2.5 mb-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/30 hover:shadow-lg hover:shadow-primary/40 transition-all"
                activeProps={{ className: "group relative flex items-center gap-3 px-3 py-2.5 mb-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/40 ring-2 ring-primary/40" }}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                <span className="ml-auto rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                  Live
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={item.to}
              to={item.to as "/refinance"}
              search={{}}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              activeProps={{ className: "flex items-center gap-3 px-3 py-2 rounded-lg text-sm bg-accent text-foreground font-medium" }}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="pt-4 pb-2 px-3 text-[10px] uppercase tracking-widest font-bold text-muted-foreground opacity-70">
          Account
        </div>

        {ACCOUNT_ITEMS.filter((item) => !item.authOnly || session || isAdmin).map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to as "/account"}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              activeProps={{ className: "flex items-center gap-3 px-3 py-2 rounded-lg text-sm bg-accent text-foreground font-medium" }}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        {session || isAdmin ? (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {session?.user.email ?? "Admin"}
              </p>
              <button
                onClick={onSignOut}
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-3 w-3" /> Sign out
              </button>
            </div>
          </div>
        ) : (
          <Link
            to="/auth"
            onClick={() => setMobileOpen(false)}
            className="flex w-full items-center justify-center rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
          >
            Sign in
          </Link>
        )}
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen w-full bg-background text-muted-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-background">
        {sidebarBody}
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-background lg:hidden">
            {sidebarBody}
          </aside>
        </>
      )}

      {/* Main column */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 lg:px-8 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground hover:bg-accent lg:hidden"
              aria-label="Toggle sidebar"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-muted-foreground">Dashboard</span>
              <span className="text-muted-foreground">/</span>
              <span className="font-semibold text-foreground">Overview</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {session ? (
              <Link
                to="/account"
                className="hidden max-w-[200px] truncate rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
              >
                {session.user.email}
              </Link>
            ) : !isAdmin ? (
              <Link
                to="/auth"
                className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
              >
                Sign in
              </Link>
            ) : null}
            {(session || isAdmin) && (
              <Button variant="outline" size="sm" onClick={onSignOut}>
                Sign out
              </Button>
            )}
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
