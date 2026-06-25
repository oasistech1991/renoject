import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, MessageSquare, ShieldCheck } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/messages")({
  validateSearch: z.object({ deal: z.string().optional(), client: z.string().optional() }),
  component: MessagesPage,
});

type DM = {
  id: string;
  client_id: string;
  sender_id: string;
  body: string;
  deal_id: string | null;
  read_at: string | null;
  created_at: string;
};

type ThreadSummary = {
  client_id: string;
  last_body: string;
  last_at: string;
  unread: number;
  email?: string | null;
};

function MessagesPage() {
  const search = useSearch({ from: "/messages" });
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!roleRow);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!userId) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-lg font-semibold text-foreground">Sign in to message the team</h1>
        <p className="mt-1 text-sm text-muted-foreground">You need to be signed in to send and receive direct messages.</p>
        <Button asChild className="mt-4"><a href="/auth">Sign in</a></Button>
      </div>
    );
  }

  if (isAdmin) {
    return <AdminInbox initialClientId={search.client ?? null} />;
  }
  return <ClientThread userId={userId} dealId={search.deal ?? null} />;
}

/* ---------------- Client view ---------------- */

function ClientThread({ userId, dealId }: { userId: string; dealId: string | null }) {
  return (
    <ThreadPanel
      clientId={userId}
      meId={userId}
      isAdmin={false}
      dealId={dealId}
      title="Message the team"
      subtitle="Direct line to a Renoject team member. We usually reply within a few hours."
    />
  );
}

/* ---------------- Admin inbox ---------------- */

function AdminInbox({ initialClientId }: { initialClientId: string | null }) {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeClient, setActiveClient] = useState<string | null>(initialClientId);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setMeId(user?.id ?? null);
    })();
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("direct_messages")
        .select("client_id, body, created_at, read_at, sender_id")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!data) return;
      const map = new Map<string, ThreadSummary>();
      for (const row of data) {
        const cur = map.get(row.client_id);
        if (!cur) {
          map.set(row.client_id, {
            client_id: row.client_id,
            last_body: row.body,
            last_at: row.created_at,
            unread: 0,
          });
        }
        const t = map.get(row.client_id)!;
        if (!row.read_at && row.sender_id === row.client_id) t.unread += 1;
      }
      const list = Array.from(map.values()).sort((a, b) => b.last_at.localeCompare(a.last_at));
      // fetch emails via client_profiles
      const ids = list.map((t) => t.client_id);
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("client_profiles")
          .select("user_id, display_name")
          .in("user_id", ids);
        const nameMap = new Map(profiles?.map((p) => [p.user_id, p.display_name]) ?? []);
        list.forEach((t) => { t.email = nameMap.get(t.client_id) ?? null; });
      }
      setThreads(list);
      if (!activeClient && list.length > 0) setActiveClient(list[0].client_id);
    };
    load();
    const ch = supabase
      .channel("admin-dm-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeClient]);

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] w-full max-w-6xl">
      <aside className="w-72 shrink-0 border-r border-border overflow-y-auto">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" /> Team inbox
          </div>
          <p className="text-xs text-muted-foreground mt-1">{threads.length} conversation{threads.length === 1 ? "" : "s"}</p>
        </div>
        {threads.length === 0 && (
          <p className="p-4 text-xs text-muted-foreground">No client messages yet.</p>
        )}
        {threads.map((t) => (
          <button
            key={t.client_id}
            onClick={() => setActiveClient(t.client_id)}
            className={`block w-full text-left px-4 py-3 border-b border-border hover:bg-accent transition-colors ${
              activeClient === t.client_id ? "bg-accent" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground truncate">
                {t.email ?? t.client_id.slice(0, 8)}
              </span>
              {t.unread > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {t.unread}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground truncate">{t.last_body}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{new Date(t.last_at).toLocaleString()}</p>
          </button>
        ))}
      </aside>
      <div className="flex-1 min-w-0">
        {activeClient && meId ? (
          <ThreadPanel
            clientId={activeClient}
            meId={meId}
            isAdmin
            dealId={null}
            title={threads.find((t) => t.client_id === activeClient)?.email ?? "Client"}
            subtitle="Replying as Renoject team"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a conversation
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Shared thread panel ---------------- */

function ThreadPanel({
  clientId, meId, isAdmin, dealId, title, subtitle,
}: {
  clientId: string;
  meId: string;
  isAdmin: boolean;
  dealId: string | null;
  title: string;
  subtitle: string;
}) {
  const [messages, setMessages] = useState<DM[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [dealName, setDealName] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("direct_messages")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (cancelled) return;
      setMessages(data ?? []);
      // mark inbound as read
      const unreadIds = (data ?? [])
        .filter((m) => !m.read_at && m.sender_id !== meId)
        .map((m) => m.id);
      if (unreadIds.length) {
        await supabase
          .from("direct_messages")
          .update({ read_at: new Date().toISOString() })
          .in("id", unreadIds);
      }
    };
    load();
    const ch = supabase
      .channel(`dm-thread-${clientId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `client_id=eq.${clientId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as DM]);
        },
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [clientId, meId]);

  useEffect(() => {
    if (!dealId) return;
    supabase.from("properties").select("name").eq("id", dealId).maybeSingle().then(({ data }) => {
      setDealName(data?.name ?? null);
    });
  }, [dealId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    const insertRow = {
      client_id: clientId,
      sender_id: meId,
      body,
      deal_id: dealId,
    };
    const { data, error } = await supabase
      .from("direct_messages")
      .insert(insertRow)
      .select()
      .single();
    setSending(false);
    if (error) {
      console.error(error);
      return;
    }
    setText("");
    if (data) setMessages((prev) => prev.some((m) => m.id === data.id) ? prev : [...prev, data]);
  };

  const grouped = useMemo(() => groupByDay(messages), [messages]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full max-w-3xl mx-auto flex-col">
      <header className="border-b border-border bg-background/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">{title}</div>
            <div className="text-[11px] text-muted-foreground">{subtitle}</div>
          </div>
        </div>
        {dealName && !isAdmin && (
          <div className="mt-2 inline-flex items-center rounded-md bg-accent px-2 py-1 text-[11px] text-foreground">
            About deal: <span className="ml-1 font-medium">{dealName}</span>
          </div>
        )}
      </header>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground">Send the first message to start the conversation.</p>
        )}
        {grouped.map((group) => (
          <div key={group.day}>
            <div className="my-2 flex items-center justify-center">
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                {group.day}
              </span>
            </div>
            <div className="space-y-2">
              {group.items.map((m) => {
                const mine = m.sender_id === meId;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                        mine
                          ? "bg-primary text-primary-foreground"
                          : "bg-card text-foreground border border-border"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border bg-background p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={isAdmin ? "Reply to the client…" : "Type a message to the team…"}
            rows={2}
            className="resize-none"
          />
          <Button onClick={send} disabled={sending || !text.trim()} className="gap-1.5">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </Button>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">Press Enter to send, Shift+Enter for a new line.</p>
      </div>
    </div>
  );
}

function groupByDay(messages: DM[]) {
  const out: Array<{ day: string; items: DM[] }> = [];
  for (const m of messages) {
    const day = new Date(m.created_at).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    const last = out[out.length - 1];
    if (last && last.day === day) last.items.push(m);
    else out.push({ day, items: [m] });
  }
  return out;
}