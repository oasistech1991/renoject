import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, ScrollText, AlertTriangle, Send, FileWarning, Paperclip, Check, ExternalLink } from "lucide-react";
import {
  analyzeLegalPdf,
  chatWithLegalDoc,
  attachLegalPackToProperty,
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
  const attach = useServerFn(attachLegalPackToProperty);
  const [loading, setLoading] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string>("");
  const [docText, setDocText] = useState<string>("");
  const [review, setReview] = useState<LegalReview | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [properties, setProperties] = useState<{ id: string; address: string; status: string }[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [attaching, setAttaching] = useState(false);
  const [attachedTo, setAttachedTo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
        setIsDragging(true);
      }
    };
    const onDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) setIsDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) onFile(f);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return;
      const { data } = await supabase
        .from("crm_properties")
        .select("id,address,status")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!cancelled && data) setProperties(data as any);
    })();
    return () => { cancelled = true; };
  }, []);

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
    setAttachedTo(null);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary);
      setPdfBase64(b64);
      const result = await analyze({ data: { pdfBase64: b64, filename: file.name } });
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

  const onAttach = async () => {
    if (!selectedProperty || !review || !pdfBase64 || !filename) return;
    setAttaching(true);
    try {
      await attach({
        data: { propertyId: selectedProperty, pdfBase64, filename, review },
      });
      const addr = properties.find((p) => p.id === selectedProperty)?.address ?? "property";
      setAttachedTo(addr);
      toast.success(`Attached to ${addr}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to attach");
    } finally {
      setAttaching(false);
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
    <div className="relative mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-orange-500/10 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-orange-500 bg-background/95 px-10 py-8 text-center shadow-2xl">
            <Upload className="mx-auto h-10 w-10 text-orange-500" />
            <p className="mt-3 text-lg font-semibold">Drop PDF to review</p>
            <p className="text-xs text-muted-foreground">Auto-uploads and analyses on drop</p>
          </div>
        </div>
      )}
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">Legal Document Review</h1>
          <Badge variant="outline" className="ml-1 border-orange-500/40 text-orange-500">
            UK Property v2
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Upload a PDF (lease, AST, auction pack, JV, bridging or sale contract). Reviewed against UK property law with citations to legislation.gov.uk and GOV.UK.
        </p>
      </header>

      <Card
        className={`cursor-pointer border-2 border-dashed p-6 transition-colors ${
          isDragging ? "border-orange-500 bg-orange-500/5" : "border-border hover:border-orange-500/50"
        }`}
        onClick={() => !loading && fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer?.files?.[0];
          if (f) onFile(f);
        }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">{filename ?? "Upload a legal PDF"}</p>
            <p className="text-xs text-muted-foreground">
              Drag & drop a PDF anywhere, or click to choose. Max 15MB.
            </p>
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
          <Button
            onClick={(e) => {
              e.stopPropagation();
              fileRef.current?.click();
            }}
            disabled={loading}
          >
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reviewing…</> : "Choose PDF"}
          </Button>
        </div>
      </Card>

      {review && (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-orange-500" />
                <h3 className="font-semibold">Attach to a property</h3>
              </div>
              {properties.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Add a property in CRM to attach legal packs.
                </p>
              ) : attachedTo ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-emerald-500">
                  <Check className="h-4 w-4" /> Attached to {attachedTo}
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                    <SelectTrigger className="sm:flex-1">
                      <SelectValue placeholder="Choose a property…" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.address}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={onAttach} disabled={!selectedProperty || attaching}>
                    {attaching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Attach pack"}
                  </Button>
                </div>
              )}
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{review.documentType}</h2>
                <div className="flex items-center gap-1.5">
                  {review.jurisdiction && (
                    <Badge variant="outline" className="border-orange-500/40 text-orange-500">
                      {review.jurisdiction === "england-wales"
                        ? "England & Wales"
                        : review.jurisdiction === "scotland"
                          ? "Scotland"
                          : review.jurisdiction === "northern-ireland"
                            ? "Northern Ireland"
                            : "Jurisdiction unclear"}
                    </Badge>
                  )}
                  <Badge variant="outline">{review.parties.length} parties</Badge>
                </div>
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
                      {f.source?.title && (
                        <div className="mt-2 text-xs">
                          {f.source.url ? (
                            <a
                              href={f.source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-orange-500 hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {f.source.title}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">Source: {f.source.title}</span>
                          )}
                        </div>
                      )}
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

            <p className="text-xs text-muted-foreground">
              Draft for solicitor review — not legal advice. UK-qualified solicitor must verify any clause, citation, or risk before reliance.
            </p>
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