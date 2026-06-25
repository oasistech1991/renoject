import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Account — RENOJECT" }] }),
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (!data.session) navigate({ to: "/auth" });
    });
  }, [navigate]);

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Your account</h1>
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <div className="text-xs uppercase text-muted-foreground">Signed in as</div>
        <div className="mt-1 text-base font-medium">{session?.user.email ?? "—"}</div>
        <div className="mt-5">
          <Button variant="outline" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    </div>
  );
}