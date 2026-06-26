import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, RotateCcw, ArrowRight, Wrench } from "lucide-react";
import copilotMark from "@/assets/copilot-mark.png";
import { clearCopilotHistory, getCopilotHistory } from "@/lib/copilot.functions";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

const SUGGESTIONS = [
  "Show me my deals",
  "Run a refinance: £180k purchase, £40k refurb, £290k GDV, £1,650 pcm",
  "Where do I add a new lead?",
  "Summarise my portfolio capital",
];

export function CopilotPanel({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const fetchHistory = useServerFn(getCopilotHistory);
  const clearHistoryFn = useServerFn(clearCopilotHistory);
  const [userId, setUserId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setUserId(data.session?.user.id ?? null);
      setToken(data.session?.access_token ?? null);
      if (data.session) {
        try {
          const rows = await fetchHistory();
          if (cancelled) return;
          const msgs: UIMessage[] = rows.map((r) => ({
            id: r.id,
            role: r.role as "user" | "assistant",
            parts: r.parts as UIMessage["parts"],
          }));
          setInitialMessages(msgs);
        } catch {
          setInitialMessages([]);
        }
      } else {
        setInitialMessages([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchHistory, open]);

  const transport = token
    ? new DefaultChatTransport({
        api: "/api/chat",
        headers: { Authorization: `Bearer ${token}` },
      })
    : undefined;

  const chatId = userId ? `copilot-${userId}` : "copilot-anon";
  const { messages, sendMessage, status, setMessages } = useChat({
    id: chatId,
    messages: initialMessages ?? [],
    transport,
    onError: (err) => {
      const msg = err?.message ?? "Chat failed";
      if (msg.includes("402")) toast.error("AI credits exhausted. Top up in Settings → Plans & credits.");
      else if (msg.includes("429")) toast.error("Rate limited — try again shortly.");
      else toast.error(msg);
    },
  });

  // Sync loaded history into useChat once
  useEffect(() => {
    if (initialMessages && messages.length === 0 && initialMessages.length > 0) {
      setMessages(initialMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessages]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [open, messages.length, status]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const isLoading = status === "submitted" || status === "streaming";

  const handleSend = async (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || !token) return;
    setInput("");
    await sendMessage({ text: value });
  };

  const handleClear = async () => {
    try {
      await clearHistoryFn();
      setMessages([]);
      toast.success("Conversation cleared");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to clear");
    }
  };

  if (!token) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Renoject Copilot</SheetTitle>
            <SheetDescription>Sign in to chat with your AI property assistant.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-4">
          <div className="flex items-center gap-3">
            <img src={copilotMark} alt="Copilot" width={32} height={32} className="rounded-full" />
            <div className="flex-1">
              <SheetTitle className="text-base">Renoject Copilot</SheetTitle>
              <SheetDescription className="text-xs">Your AI property assistant</SheetDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClear} title="Clear conversation">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1" ref={scrollRef as any}>
          <div className="space-y-4 p-4">
            {messages.length === 0 && (
              <div className="space-y-4 pt-4">
                <div className="text-center text-sm text-muted-foreground">
                  Hi — I'm your Renoject Copilot. Ask me about your deals, run a quick refinance, or get help finding a tool.
                </div>
                <div className="space-y-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-orange-500/60 hover:bg-orange-500/5"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} onNavigate={(p) => { navigate({ to: p as any }); onOpenChange(false); }} />
            ))}

            {status === "submitted" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Renoject Copilot…"
              rows={2}
              className="resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button onClick={() => handleSend()} disabled={isLoading || !input.trim()} size="icon" className="bg-orange-500 text-white hover:bg-orange-600">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MessageBubble({
  message,
  onNavigate,
}: {
  message: UIMessage;
  onNavigate: (path: string) => void;
}) {
  const isUser = message.role === "user";
  const textParts = message.parts.filter((p: any) => p.type === "text") as Array<{ text: string }>;
  const text = textParts.map((p) => p.text).join("");
  const toolParts = message.parts.filter((p: any) => typeof p.type === "string" && p.type.startsWith("tool-")) as any[];

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start gap-2"}>
      {!isUser && (
        <img src={copilotMark} alt="" width={24} height={24} className="mt-1 h-6 w-6 shrink-0 rounded-full" />
      )}
      <div className={isUser ? "max-w-[85%]" : "max-w-[90%] flex-1 space-y-2"}>
        {text && (
          <div
            className={
              isUser
                ? "rounded-2xl rounded-tr-sm bg-orange-500 px-3 py-2 text-sm text-white"
                : "text-sm text-foreground"
            }
          >
            {isUser ? (
              <span className="whitespace-pre-wrap">{text}</span>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-headings:mt-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
        {toolParts.map((p, i) => {
          const name = String(p.type).replace(/^tool-/, "");
          const output = (p as any).output ?? (p as any).result;
          if (name === "navigate" && output?.path) {
            return (
              <button
                key={i}
                onClick={() => onNavigate(output.path)}
                className="flex w-full items-center justify-between rounded-lg border border-orange-500/40 bg-orange-500/5 px-3 py-2 text-left text-sm font-medium text-orange-600 hover:bg-orange-500/10 dark:text-orange-400"
              >
                <span>{output.label ?? `Open ${output.path}`}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            );
          }
          return (
            <details key={i} className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
              <summary className="flex cursor-pointer items-center gap-1.5 text-muted-foreground">
                <Wrench className="h-3 w-3" /> {name}
              </summary>
              {output && (
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
                  {JSON.stringify(output, null, 2)}
                </pre>
              )}
            </details>
          );
        })}
      </div>
    </div>
  );
}