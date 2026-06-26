import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { UK_PROPERTY_LEGAL_SYSTEM_PROMPT, UK_SOURCE_SITES } from "./legal-review.uk-prompt";

const PdfInput = z.object({
  pdfBase64: z.string().min(1).max(20_000_000),
  filename: z.string().max(255).optional(),
});

const ChatInput = z.object({
  documentText: z.string().min(1).max(200_000),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      })
    )
    .min(1)
    .max(40),
});

const AttachInput = z.object({
  propertyId: z.string().uuid(),
  pdfBase64: z.string().min(1).max(20_000_000),
  filename: z.string().min(1).max(255),
  review: z.object({
    documentType: z.string(),
    jurisdiction: z.enum(["england-wales", "scotland", "northern-ireland", "unknown"]).optional(),
    summary: z.string(),
    parties: z.array(z.string()),
    keyTerms: z.array(z.object({ label: z.string(), value: z.string() })),
    obligations: z.array(z.object({ party: z.string(), obligation: z.string() })),
    redFlags: z.array(
      z.object({
        severity: z.enum(["high", "medium", "low"]),
        clause: z.string(),
        concern: z.string(),
        source: z
          .object({ title: z.string(), url: z.string().optional() })
          .optional(),
      })
    ),
    missingClauses: z.array(z.string()),
    recommendedQuestions: z.array(z.string()),
  }),
});

async function extractPdfText(pdfBase64: string): Promise<string> {
  const binary = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(binary);
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n") : text).slice(0, 180_000);
}

async function ocrPdfWithGemini(pdfBase64: string, apiKey: string): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract ALL text from this PDF document, preserving structure (headings, clauses, tables). Return only the extracted text, no commentary.",
            },
            {
              type: "file",
              file: {
                filename: "document.pdf",
                file_data: `data:application/pdf;base64,${pdfBase64}`,
              },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw gatewayError(res.status, await res.text());
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content;
  return typeof text === "string" ? text.slice(0, 180_000) : "";
}

function gatewayError(status: number, body: string): Error {
  if (status === 429) return new Error("AI rate limit reached, try again shortly.");
  if (status === 402) return new Error("AI credits exhausted. Add credits in Lovable Cloud.");
  return new Error(`AI gateway error ${status}: ${body.slice(0, 200)}`);
}

export type LegalReview = {
  documentType: string;
  jurisdiction?: "england-wales" | "scotland" | "northern-ireland" | "unknown";
  summary: string;
  parties: string[];
  keyTerms: { label: string; value: string }[];
  obligations: { party: string; obligation: string }[];
  redFlags: {
    severity: "high" | "medium" | "low";
    clause: string;
    concern: string;
    source?: { title: string; url?: string };
  }[];
  missingClauses: string[];
  recommendedQuestions: string[];
};

async function resolveUkSourceUrl(title: string): Promise<string | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;
  const trimmed = title.trim().slice(0, 200);
  if (!trimmed) return null;

  // Check cache (server-side, via admin client).
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cached = await supabaseAdmin
      .from("legal_source_cache")
      .select("url")
      .eq("title", trimmed)
      .maybeSingle();
    if (cached.data?.url) return cached.data.url;
  } catch {
    // ignore cache failures
  }

  // Live lookup via Firecrawl REST API (Worker-safe), constrained to UK official sources.
  try {
    const { createFirecrawl } = await import("./firecrawl-client");
    const fc = createFirecrawl(apiKey);
    const siteFilter = UK_SOURCE_SITES.map((s) => `site:${s}`).join(" OR ");
    const result: any = await fc.search(`${trimmed} (${siteFilter})`, { limit: 1 });
    const first =
      result?.web?.[0]?.url ??
      result?.data?.[0]?.url ??
      (Array.isArray(result) ? result[0]?.url : null) ??
      null;
    if (first) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("legal_source_cache")
          .upsert({ title: trimmed, url: first, fetched_at: new Date().toISOString() });
      } catch {
        // ignore cache write failures
      }
      return first;
    }
  } catch {
    // Firecrawl errors are non-fatal; review still renders.
  }
  return null;
}

async function enrichRedFlagSources(review: LegalReview): Promise<LegalReview> {
  const flagsNeedingUrl = review.redFlags
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.source?.title && !f.source.url)
    .slice(0, 5);
  if (flagsNeedingUrl.length === 0) return review;

  const urls = await Promise.all(
    flagsNeedingUrl.map(({ f }) => resolveUkSourceUrl(f.source!.title))
  );
  const updated = review.redFlags.map((f) => ({ ...f }));
  flagsNeedingUrl.forEach(({ i }, n) => {
    const url = urls[n];
    if (url && updated[i].source) updated[i].source = { ...updated[i].source!, url };
  });
  return { ...review, redFlags: updated };
}

export const analyzeLegalPdf = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PdfInput.parse(data))
  .handler(async ({ data }): Promise<{
    documentText: string;
    review: LegalReview | null;
    warning: string | null;
  }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured");

    let documentText = await extractPdfText(data.pdfBase64);
    if (documentText.replace(/\s+/g, " ").trim().length < 50) {
      // Likely a scanned/image PDF — fall back to Gemini OCR.
      try {
        documentText = await ocrPdfWithGemini(data.pdfBase64, apiKey);
      } catch (e) {
        return {
          documentText: "",
          review: null,
          warning: `OCR failed: ${e instanceof Error ? e.message : "unknown error"}`,
        };
      }
    }
    if (!documentText.trim()) {
      return { documentText: "", review: null, warning: "No text could be read from this PDF, even with OCR." };
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: UK_PROPERTY_LEGAL_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: `Review this document and return a structured analysis.\n\n--- DOCUMENT ---\n${documentText}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "set_review",
              description: "Submit the structured legal review.",
              parameters: {
                type: "object",
                additionalProperties: false,
                properties: {
                  documentType: { type: "string" },
                  jurisdiction: {
                    type: "string",
                    enum: ["england-wales", "scotland", "northern-ireland", "unknown"],
                  },
                  summary: { type: "string" },
                  parties: { type: "array", items: { type: "string" } },
                  keyTerms: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: { label: { type: "string" }, value: { type: "string" } },
                      required: ["label", "value"],
                    },
                  },
                  obligations: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: { party: { type: "string" }, obligation: { type: "string" } },
                      required: ["party", "obligation"],
                    },
                  },
                  redFlags: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        severity: { type: "string", enum: ["high", "medium", "low"] },
                        clause: { type: "string" },
                        concern: { type: "string" },
                        source: {
                          type: "object",
                          additionalProperties: false,
                          properties: {
                            title: { type: "string" },
                          },
                          required: ["title"],
                        },
                      },
                      required: ["severity", "clause", "concern", "source"],
                    },
                  },
                  missingClauses: { type: "array", items: { type: "string" } },
                  recommendedQuestions: { type: "array", items: { type: "string" } },
                },
                required: [
                  "documentType",
                  "jurisdiction",
                  "summary",
                  "parties",
                  "keyTerms",
                  "obligations",
                  "redFlags",
                  "missingClauses",
                  "recommendedQuestions",
                ],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "set_review" } },
      }),
    });

    if (!res.ok) throw gatewayError(res.status, await res.text());
    const json = await res.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return { documentText, review: null, warning: "AI returned no structured review." };
    }
    try {
      const review = JSON.parse(call.function.arguments) as LegalReview;
      const enriched = await enrichRedFlagSources(review);
      return { documentText, review: enriched, warning: null };
    } catch {
      return { documentText, review: null, warning: "Failed to parse AI response." };
    }
  });

export const chatWithLegalDoc = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ChatInput.parse(data))
  .handler(async ({ data }): Promise<{ reply: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `You are a UK-qualified property solicitor answering questions about the following legal document. Quote clause numbers/text when relevant. If something isn't in the document, say so plainly. Keep answers concise and practical.\n\n--- DOCUMENT ---\n${data.documentText}`,
          },
          ...data.messages,
        ],
      }),
    });

    if (!res.ok) throw gatewayError(res.status, await res.text());
    const json = await res.json();
    const reply = json?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      throw new Error("AI returned no reply.");
    }
    return { reply };
  });

export const attachLegalPackToProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AttachInput.parse(data))
  .handler(async ({ data, context }): Promise<{ id: string; storagePath: string }> => {
    const { userId } = context;
    const bytes = Uint8Array.from(atob(data.pdfBase64), (c) => c.charCodeAt(0));
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    const path = `legal/${data.propertyId}/${crypto.randomUUID()}-${safeName}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const upload = await supabaseAdmin.storage
      .from("property-media")
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (upload.error) throw new Error(upload.error.message);

    const { data: row, error } = await context.supabase
      .from("crm_property_legal_packs")
      .insert({
        property_id: data.propertyId,
        uploaded_by: userId,
        filename: data.filename,
        storage_path: path,
        document_type: data.review.documentType,
        summary: data.review.summary,
        red_flag_count: data.review.redFlags.length,
        review_json: data.review,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, storagePath: path };
  });