import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useEntitlement } from "@/hooks/useEntitlement";
import { Button } from "@/components/ui/button";
import { Lock, Loader2 } from "lucide-react";

export function PaywallGate({ children, feature }: { children: ReactNode; feature: string }) {
  const ent = useEntitlement();

  if (ent.loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (ent.isEntitled) return <>{children}</>;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card">
        <Lock className="h-6 w-6 text-primary" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{feature} is a Pro feature</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {ent.isAuthenticated
          ? "Upgrade to Hartstone Pro to unlock this section, including the full background check workflow."
          : "Create an account and subscribe to Hartstone Pro to unlock this section."}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link to="/pricing">View pricing</Link>
        </Button>
        {!ent.isAuthenticated && (
          <Button asChild variant="outline">
            <Link to="/auth">Sign in</Link>
          </Button>
        )}
      </div>
    </div>
  );
}