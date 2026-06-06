import { createServerFn } from "@tanstack/react-start";
import { gatewayFetch, getPaddleClient, type PaddleEnv } from "@/lib/paddle.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data: { priceId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data }) => {
    const response = await gatewayFetch(
      data.environment,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`,
    );
    const result = await response.json();
    if (!result.data?.length) throw new Error("Price not found");
    return result.data[0].id as string;
  });

export const openCustomerPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: sub, error } = await supabase
      .from("subscriptions")
      .select("paddle_customer_id, paddle_subscription_id, environment")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!sub) throw new Error("No subscription found");

    const env = sub.environment as PaddleEnv;
    const paddle = getPaddleClient(env);
    const portal = await paddle.customerPortalSessions.create(
      sub.paddle_customer_id,
      [sub.paddle_subscription_id],
    );
    return { url: portal.urls.general.overview as string };
  });