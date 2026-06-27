import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/track-share-click")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { linkId?: string };
          const linkId = String(body.linkId ?? "").trim();
          // basic UUID-ish guard
          if (!/^[0-9a-f-]{36}$/i.test(linkId)) {
            return new Response("Bad request", { status: 400 });
          }
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // increment click_count atomically
          const { data: row } = await supabaseAdmin
            .from("feed_share_links")
            .select("click_count")
            .eq("id", linkId)
            .maybeSingle();
          if (!row) return new Response("Not found", { status: 404 });
          await supabaseAdmin
            .from("feed_share_links")
            .update({ click_count: (row.click_count ?? 0) + 1 })
            .eq("id", linkId);
          return Response.json({ ok: true });
        } catch (err) {
          console.error("track-share-click failed", err);
          return new Response("Server error", { status: 500 });
        }
      },
    },
  },
});