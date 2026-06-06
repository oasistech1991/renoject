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
import type { Session } from "@supabase/supabase-js";

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
      { title: "HARTSTONE HOLDINGS" },
      { name: "description", content: "Property investment tools by HARTSTONE HOLDINGS — BTL calculator, HMO compliance checker and renovation calculator." },
      { name: "author", content: "HARTSTONE HOLDINGS" },
      { property: "og:title", content: "HARTSTONE HOLDINGS" },
      { property: "og:description", content: "Property investment tools by HARTSTONE HOLDINGS — BTL calculator, HMO compliance checker and renovation calculator." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@HartstoneHoldings" },
      { name: "twitter:title", content: "HARTSTONE HOLDINGS" },
      { name: "twitter:description", content: "Property investment tools by HARTSTONE HOLDINGS — BTL calculator, HMO compliance checker and renovation calculator." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c1276a80-d9e7-4e45-ab8c-0ace548ad884/id-preview-f90c6f5c--33ab3ec4-e05b-416f-827e-db8cec69c227.lovable.app-1779874236024.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c1276a80-d9e7-4e45-ab8c-0ace548ad884/id-preview-f90c6f5c--33ab3ec4-e05b-416f-827e-db8cec69c227.lovable.app-1779874236024.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
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
  "/auth",
  "/reset-password",
  "/pricing",
  "/terms",
  "/privacy",
  "/refund-policy",
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

  if (!unlocked && !isPublicPath) {
    return (
      <>
        <SignInScreen onUnlock={() => setAdminUnlocked(true)} />
        <Toaster />
      </>
    );
  }

  if (isPublicPath && !sessionLoaded) {
    // Public legal/auth pages don't need to wait, render immediately
  }

  return (
    <>
      <TopNav
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
      />
      <Outlet />
      <Toaster />
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
        <h1 className="text-xl font-bold tracking-wide text-foreground">HARTSTONE HOLDINGS</h1>
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

function TopNav({
  onSignOut,
  session,
  isAdmin,
}: {
  onSignOut: () => void;
  session: Session | null;
  isAdmin: boolean;
}) {
  const linkBase =
    "px-4 py-2 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50";
  const activeCls = "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground";
  return (
    <div className="border-b border-border bg-card/30 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center gap-2 px-6 py-2">
        <Link to="/" className="mr-4 text-sm font-bold tracking-wide text-foreground">
          HARTSTONE HOLDINGS
        </Link>
        <Link to="/hmo-compliance" className={linkBase} activeProps={{ className: `${linkBase} ${activeCls}` }}>
          HMO Floorplan Compliance
        </Link>
        <Link to="/market" className={linkBase} activeProps={{ className: `${linkBase} ${activeCls}` }}>
          Market Search
        </Link>
        <Link to="/condition" className={linkBase} activeProps={{ className: `${linkBase} ${activeCls}` }}>
          Renovation Calculator
        </Link>
        <Link to="/refinance" className={linkBase} activeProps={{ className: `${linkBase} ${activeCls}` }}>
          Property Calculator
        </Link>
        <Link to="/properties" className={linkBase} activeProps={{ className: `${linkBase} ${activeCls}` }}>
          View Deals
        </Link>
        <Link to="/forecast" className={linkBase} activeProps={{ className: `${linkBase} ${activeCls}` }}>
          Forecast
        </Link>
        <Link to="/tokenize" className={linkBase} activeProps={{ className: `${linkBase} ${activeCls}` }}>
          Tokenize
        </Link>
        <Link to="/tradesmen" className={linkBase} activeProps={{ className: `${linkBase} ${activeCls}` }}>
          Tradesmen
        </Link>
        <Link to="/pricing" className={linkBase} activeProps={{ className: `${linkBase} ${activeCls}` }}>
          Pricing
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {session ? (
            <Link to="/account" className="text-xs text-muted-foreground hover:text-foreground">
              {session.user.email}
            </Link>
          ) : !isAdmin ? (
            <Link to="/auth" className={linkBase}>
              Sign in
            </Link>
          ) : null}
          <Button variant="outline" size="sm" onClick={onSignOut}>Sign out</Button>
        </div>
      </nav>
    </div>
  );
}
