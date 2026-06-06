import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useServerFn } from "@tanstack/react-start";
import { openCustomerPortal } from "@/utils/payments.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const search = z.object({ checkout: z.string().optional() });

export const Route = createFileRoute("/account")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "Account — HARTSTONE HOLDINGS" }] }),
  component: AccountPage,
});

function AccountPage() {
  const ent = useEntitlement();
  const navigate = useNavigate();
  const { checkout } = useSearch({ from: "/account" });
  const portal = useServerFn(openCustomerPortal);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (checkout === "success") {
      toast.success("Subscription active — welcome to Hartstone Pro!");
    }
  }, [checkout]);

  useEffect(() => {
    if (!ent.loading && !ent.isAuthenticated && !ent.isAdmin) {
      navigate({ to: "/auth", search: { redirect: "/account" } });
    }
  }, [ent.loading, ent.isAuthenticated, ent.isAdmin, navigate]);

  if (ent.loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const onPortal = async () => {
    setPortalLoading(true);
    try {
      const { url } = await portal();
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Your account</h1>

      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <div className="text-xs uppercase text-muted-foreground">Signed in as</div>
        <div className="mt-1 text-base font-medium">{ent.email ?? "Admin (shared password)"}</div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase text-muted-foreground">Subscription</div>
            <div className="mt-1 text-lg font-semibold">
              {ent.isAdmin && !ent.isSubscriber ? "Admin access" : ent.isSubscriber ? "Hartstone Pro" : "Free"}
            </div>
          </div>
          {ent.subscriptionStatus && (
            <Badge variant={ent.isSubscriber ? "default" : "secondary"} className="capitalize">
              {ent.subscriptionStatus.replace("_", " ")}
            </Badge>
          )}
        </div>
        {ent.currentPeriodEnd && (
          <p className="mt-3 text-sm text-muted-foreground">
            {ent.cancelAtPeriodEnd ? "Ends" : "Renews"} on{" "}
            {new Date(ent.currentPeriodEnd).toLocaleDateString()}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {ent.isSubscriber ? (
            <Button onClick={onPortal} disabled={portalLoading}>
              {portalLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Manage billing
            </Button>
          ) : (
            <Button asChild><Link to="/pricing">Upgrade to Pro</Link></Button>
          )}
          {ent.isAuthenticated && (
            <Button variant="outline" onClick={signOut}>Sign out</Button>
          )}
        </div>
      </div>
    </div>
  );
}