import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { MessageCircle, Copy, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  buildWhatsAppCaption,
  buildWhatsAppLink,
  buildTrackedShareUrl,
  type ShareablePost,
} from "@/lib/whatsapp-share";

export function ShareToWhatsAppButton({
  post,
  userId,
}: {
  post: ShareablePost;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState("");
  const [businessNumber, setBusinessNumber] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("client_profiles")
      .select("whatsapp_business_number")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setBusinessNumber((data as any)?.whatsapp_business_number ?? null);
      });
  }, [open, userId]);

  async function generate(): Promise<{ caption: string; link: string } | null> {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("feed_share_links")
        .insert({ post_id: post.id, channel: "whatsapp", created_by: userId })
        .select("id")
        .single();
      if (error || !data) {
        toast.error(error?.message ?? "Couldn't create share link");
        return null;
      }
      const url = buildTrackedShareUrl({
        origin: window.location.origin,
        postId: post.id,
        linkId: data.id,
      });
      const cap = buildWhatsAppCaption(post, url);
      setCaption(cap);
      return { caption: cap, link: buildWhatsAppLink(cap, businessNumber) };
    } finally {
      setBusy(false);
    }
  }

  async function shareToWhatsApp() {
    const result = await generate();
    if (!result) return;
    window.open(result.link, "_blank", "noopener,noreferrer");
  }

  async function copyCaption() {
    const result = caption ? { caption } : await generate();
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.caption);
      toast.success("Caption copied");
    } catch {
      toast.error("Couldn't copy");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" title="Share to WhatsApp">
          <MessageCircle className="h-4 w-4 text-[#25D366]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div>
          <div className="text-sm font-semibold">Share to WhatsApp</div>
          <p className="text-xs text-muted-foreground">
            Generates a branded caption with a trackable link back to the feed.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={shareToWhatsApp} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            {businessNumber ? "Send to business number" : "Open WhatsApp"}
          </Button>
          <Button onClick={copyCaption} disabled={busy} variant="outline" className="gap-2">
            <Copy className="h-4 w-4" /> Copy caption only
          </Button>
        </div>
        {!businessNumber && (
          <p className="text-[11px] text-muted-foreground">
            Tip: set a default WhatsApp business number on your profile to pre-fill the recipient.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}