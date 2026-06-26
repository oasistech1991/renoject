import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Upload, ScrollText, AlertTriangle, Send, FileWarning } from "lucide-react";
import {
  analyzeLegalPdf,
  chatWithLegalDoc,
  type LegalReview,
} from "@/lib/legal-review.functions";

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: [
      { title: "Legal Document Review — Renoject" },
      {
        name: "description",
        content:
          "AI-powered legal review for leases, ASTs, JV agreements and bridging contracts. Risk report plus chat-with-your-document.",
      },
    ],
  }),
  component: LegalPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <FileWarning className="mx-auto h-10 w-10 text-destructive" />
        <p className="mt-4 text-sm text-muted-foreground">{error.message}</p>
        <Button
          className="mt-4"
          onClick={() => {
            reset();
            router.invalidate();
          }}
        >
          Try again
        </Button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-8">Page not found.</div>,
});

type ChatMsg = { role: "user" | "assistant"; content: string };

function LegalPage() {
  const analyze = useServerFn(analyzeLegalPdf);
  const chat = useServerFn(chatWithLegalDoc);
  const [loading, setLoading] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);
  const [docText, setDocText] = useState<string>("");
  const [review, setReview] = useState<LegalReview | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("PDF must be under 15MB");
      return;
    }
    setLoading(true);
    setFilename(file.name);
    setReview(null);
    setMessages([]);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const pdfBase64 = btoa(binary);
      const result = await analyze({ data: { pdfBase64, filename: file.name } });
      setDocText(result.documentText);
      setReview(result.review);
      if (result.warning) toast.warning(result.warning);
      else toast.success("Review complete");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to review document");
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || !docText || sending) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const { reply } = await chat({
        data: { documentText: docText, messages: next },
      });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e: any) {
      toast.error(e?.message ?? "Chat failed");
      setMessages(next.slice(0, -1));
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">Legal Document Review</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Upload a PDF (lease, AST, JV, bridging or sale contract). Get a risk report plus chat with the document.
        </p>
      </header>

      <Card className="p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">{filename ?? "Upload a legal PDF"}</p>
            <p className="text-xs text-muted-foreground">Max 15MB. Stored only in this session.</p>
          </div>
          <Input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reviewing…</> : "Choose PDF"}
          </Button>
        </div>
      </Card>

      {review && (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{review.documentType}</h2>
                <Badge variant="outline">{review.parties.length} parties</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{review.summary}</p>
              {review.parties.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {review.parties.map((p, i) => (
                    <Badge key={i} variant="secondary">{p}</Badge>
                  ))}
                </div>
              )}
            </Card>

            {review.keyTerms.length > 0 && (
              <Card className="p-5">
                <h3 className="font-semibold">Key terms</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {review.keyTerms.map((t, i) => (
                    <div key={i} className="rounded border border-border bg-muted/30 p-3">
                      <div className="text-xs uppercase text-muted-foreground">{t.label}</div>
                      <div className="mt-0.5 text-sm font-medium">{t.value}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {review.redFlags.length > 0 && (
              <Card className="p-5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <h3 className="font-semibold">Red flags</h3>
                </div>
                <ul className="mt-3 space-y-3">
                  {review.redFlags.map((f, i) => (
                    <li key={i} className="rounded border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{f.clause}</span>
                        <Badge
                          variant="outline"
                          className={
                            f.severity === "high"
                              ? "border-red-500/40 text-red-500"
                              : f.severity === "medium"
                                ? "border-amber-500/40 text-amber-500"
                                : "border-muted-foreground/40 text-muted-foreground"
                          }
                        >
                          {f.severity}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{f.concern}</p>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {review.obligations.length > 0 && (
              <Card className="p-5">
                <h3 className="font-semibold">Obligations</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {review.obligations.map((o, i) => (
                    <li key={i} className="flex gap-2">
                      <Badge variant="secondary" className="shrink-0">{o.party}</Badge>
                      <span className="text-muted-foreground">{o.obligation}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {review.missingClauses.length > 0 && (
              <Card className="p-5">
                <h3 className="font-semibold">Potentially missing</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {review.missingClauses.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </Card>
            )}
          </div>

          <div className="lg:col-span-2">
            <Card className="flex h-[640px] flex-col p-0">
              <div className="border-b border-border p-4">
                <h3 className="font-semibold">Ask the document</h3>
                <p className="text-xs text-muted-foreground">e.g. "What's the break clause?"</p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 && review.recommendedQuestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Suggested questions:</p>
                    {review.recommendedQuestions.slice(0, 5).map((q, i) => (
                      <button
                        key={i}
                        onClick={() => setInput(q)}
                        className="block w-full rounded border border-border p-2 text-left text-sm hover:bg-muted"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`rounded-lg p-3 text-sm ${
                      m.role === "user"
                        ? "ml-6 bg-orange-500/10 text-foreground"
                        : "mr-6 bg-muted text-foreground"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                ))}
                {sending && (
                  <div className="mr-6 flex items-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>
              <div className="border-t border-border p-3">
                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything about this document…"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                  />
                  <Button onClick={send} disabled={sending || !input.trim()} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}