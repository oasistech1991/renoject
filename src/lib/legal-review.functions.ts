import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

async function extractPdfText(pdfBase64: string): Promise<string> {
  const binary = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(binary);
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n") : text).slice(0, 180_000);
}

function gatewayError(status: number, body: string): Error {
  if (status === 429) return new Error("AI rate limit reached, try again shortly.");
  if (status === 402) return new Error("AI credits exhausted. Add credits in Lovable Cloud.");
  return new Error(`AI gateway error ${status}: ${body.slice(0, 200)}`);
}

export type LegalReview = {
  documentType: string;
  summary: string;
  parties: string[];
  keyTerms: { label: string; value: string }[];
  obligations: { party: string; obligation: string }[];
  redFlags: { severity: "high" | "medium" | "low"; clause: string; concern: string }[];
  missingClauses: string[];
  recommendedQuestions: string[];
};

export const analyzeLegalPdf = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PdfInput.parse(data))
  .handler(async ({ data }): Promise<{
    documentText: string;
    review: LegalReview | null;
    warning: string | null;
  }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured");

    const documentText = await extractPdfText(data.pdfBase64);
    if (!documentText.trim()) {
      return { documentText: "", review: null, warning: "No text could be read from this PDF." };
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content:
              "You are a UK-qualified property solicitor reviewing legal documents (leases, ASTs, JV agreements, loan/bridging contracts, option agreements, sale contracts). Flag risks plainly. Never invent clauses. If a section isn't present, list it under missingClauses. Use plain English.",
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
                      },
                      required: ["severity", "clause", "concern"],
                    },
                  },
                  missingClauses: { type: "array", items: { type: "string" } },
                  recommendedQuestions: { type: "array", items: { type: "string" } },
                },
                required: [
                  "documentType",
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
      return { documentText, review, warning: null };
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