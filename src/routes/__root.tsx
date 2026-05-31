import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";

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
      { name: "description", content: "Property investment tools by HARTSTONE HOLDINGS — BTL calculator, HMO compliance checker and property condition analyser." },
      { name: "author", content: "HARTSTONE HOLDINGS" },
      { property: "og:title", content: "HARTSTONE HOLDINGS" },
      { property: "og:description", content: "Property investment tools by HARTSTONE HOLDINGS — BTL calculator, HMO compliance checker and property condition analyser." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@HartstoneHoldings" },
      { name: "twitter:title", content: "HARTSTONE HOLDINGS" },
      { name: "twitter:description", content: "Property investment tools by HARTSTONE HOLDINGS — BTL calculator, HMO compliance checker and property condition analyser." },
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
    <html lang="en">
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
      <TopNav />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}

function TopNav() {
  const linkBase =
    "px-4 py-2 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50";
  const activeCls = "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground";
  return (
    <div className="border-b border-border bg-card/30 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center gap-2 px-6 py-2">
        <Link to="/" className="mr-4 text-sm font-bold tracking-wide text-foreground">
          HARTSTONE HOLDINGS
        </Link>
        <Link to="/" className={linkBase} activeOptions={{ exact: true }} activeProps={{ className: `${linkBase} ${activeCls}` }}>
          BTL Calculator
        </Link>
        <Link to="/hmo-compliance" className={linkBase} activeProps={{ className: `${linkBase} ${activeCls}` }}>
          HMO Floorplan Compliance
        </Link>
        <Link to="/condition" className={linkBase} activeProps={{ className: `${linkBase} ${activeCls}` }}>
          Condition Analyser
        </Link>
      </nav>
    </div>
  );
}
