import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";

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
  isEntitled: false,
  subscriptionStatus: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

function readAdminFlag(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem("hh_unlocked") === "1";
}

export function useEntitlement(): Entitlement {
  const [state, setState] = useState<Entitlement>(DEFAULT);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const isAdmin = readAdminFlag();
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;

      if (!user) {
        if (!active) return;
        setState({ ...DEFAULT, loading: false, isAdmin, isEntitled: isAdmin });
        return;
      }

      const env = getPaddleEnvironment();
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status, current_period_end, cancel_at_period_end")
        .eq("user_id", user.id)
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const now = Date.now();
      const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end).getTime() : null;
      const isActive =
        !!sub &&
        (
          (["active", "trialing", "past_due"].includes(sub.status) &&
            (!periodEnd || periodEnd > now)) ||
          (sub.status === "canceled" && periodEnd != null && periodEnd > now)
        );

      if (!active) return;
      setState({
        loading: false,
        isAdmin,
        isAuthenticated: true,
        userId: user.id,
        email: user.email ?? null,
        isSubscriber: !!isActive,
        isEntitled: isAdmin || !!isActive,
        subscriptionStatus: sub?.status ?? null,
        currentPeriodEnd: sub?.current_period_end ?? null,
        cancelAtPeriodEnd: !!sub?.cancel_at_period_end,
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