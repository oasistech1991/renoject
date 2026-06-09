import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Entitlement = {
  loading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  isSubscriber: boolean;
  isEntitled: boolean;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

const DEFAULT: Entitlement = {
  loading: true,
  isAdmin: false,
  isAuthenticated: false,
  userId: null,
  email: null,
  isSubscriber: false,
  isEntitled: true,
  subscriptionStatus: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

function readAdminFlag(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem("hh_unlocked") === "1";
}

export function useEntitlement(): Entitlement {
  const [state, setState] = useState<Entitlement>({ ...DEFAULT, loading: true });

  useEffect(() => {
    let active = true;

    const load = async () => {
      const isAdmin = readAdminFlag();
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;

      if (!active) return;
      setState({
        ...DEFAULT,
        loading: false,
        isAdmin,
        isAuthenticated: !!user,
        userId: user?.id ?? null,
        email: user?.email ?? null,
        isEntitled: true,
      });
    };

    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        load();
      }
    });

    const onAdmin = () => load();
    window.addEventListener("hh-admin-changed", onAdmin);

    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener("hh-admin-changed", onAdmin);
    };
  }, []);

  return state;
}