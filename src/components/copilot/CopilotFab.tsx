import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { CopilotPanel } from "./CopilotPanel";
import { supabase } from "@/integrations/supabase/client";

export function CopilotFab() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSignedIn(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setSignedIn(!!session);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const hideOn = ["/auth", "/reset-password"];
  if (!signedIn || hideOn.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/30 transition-transform hover:scale-105 hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
        aria-label="Open Renoject Copilot"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
      <CopilotPanel open={open} onOpenChange={setOpen} />
    </>
  );
}