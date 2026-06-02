import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  pdfBase64: z.string().min(1).max(20_000_000),
  filename: z.string().max(255).optional(),
});

const UrlInputSchema = z.object({
  url: z.string().url().max(2048),
});

const numberOrNull = { type: ["number", "null"] } as const;
const boolOrNull = { type: ["boolean", "null"] } as const;
const strOrNull = { type: ["string", "null"] } as const;

const FIELDS: Record<string, typeof numberOrNull | typeof boolOrNull | typeof strOrNull> = {
  propertyName: strOrNull,
  purchasePrice: numberOrNull,
  deposit: numberOrNull,
  stampDuty: numberOrNull,
  legalFees: numberOrNull,
  surveyFees: numberOrNull,
  purchaseRate: numberOrNull,
  brokerFees: numberOrNull,
  lenderFee: numberOrNull,
  additionalFees: numberOrNull,
  auctionFees: numberOrNull,
  sourcingFee: numberOrNull,
  fixturesFittings: numberOrNull,
  furnishing: numberOrNull,
  refurbCost: numberOrNull,
  refurbMonths: numberOrNull,
  holdingMonthly: numberOrNull,
  useBridge: boolOrNull,
  bridgeLoanPct: numberOrNull,
  bridgeRate: numberOrNull,
  bridgeTermMonths: numberOrNull,
  bridgeArrangementPct: numberOrNull,
  bridgeExitPct: numberOrNull,
  gdv: numberOrNull,
  refiLtv: numberOrNull,
  refiRate: numberOrNull,
  refiTermYears: numberOrNull,
  refiFees: numberOrNull,
  monthlyRent: numberOrNull,
  managementPct: numberOrNull,
  maintenancePct: numberOrNull,
  voidsPct: numberOrNull,
  insurance: numberOrNull,
  groundRent: numberOrNull,
};

export const parsePropertyPdf = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<{
    extracted: Record<string, number | string | boolean>;
    warning: string | null;
  }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured");

    // Decode base64 -> Uint8Array and extract text with unpdf
    const binary = Uint8Array.from(atob(data.pdfBase64), (c) => c.charCodeAt(0));
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(binary);
    const { text } = await extractText(pdf, { mergePages: true });
    const trimmed = (Array.isArray(text) ? text.join("\n") : text).slice(0, 60_000);
    if (!trimmed.trim()) {
      return { extracted: {}, warning: "No text could be read from this PDF." };
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You extract UK BRRR / refinance deal data from property listings, auction packs, or deal sheets. Return numbers in GBP without currency symbols. Use null when a value isn't present. Never invent figures. Percentages are plain numbers (e.g. 75 for 75%).",
          },
          {
            role: "user",
            content: `Extract deal details from the following PDF text. Suggest a short propertyName from the address. Text:\n\n${trimmed}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "set_deal",
              description: "Submit the extracted BRRR deal fields.",
              parameters: {
                type: "object",
                additionalProperties: false,
                properties: FIELDS,
                required: Object.keys(FIELDS),
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "set_deal" } },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("AI rate limit reached, try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Lovable Cloud.");
      throw new Error(`AI gateway error ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = await res.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return { extracted: {}, warning: "AI returned no structured data." };
    }
    let extracted: Record<string, unknown> = {};
    try {
      extracted = JSON.parse(call.function.arguments);
    } catch {
      return { extracted: {}, warning: "Failed to parse AI response." };
    }
    // Strip nulls and coerce to a serializable shape
    const clean: Record<string, number | string | boolean> = {};
    for (const [k, v] of Object.entries(extracted)) {
      if (v === null || v === undefined || v === "") continue;
      if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") {
        clean[k] = v;
      }
    }
    return { extracted: clean, warning: null };
  });

export const parsePropertyUrl = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => UrlInputSchema.parse(data))
  .handler(async ({ data }): Promise<{
    extracted: Record<string, number | string | boolean>;
    warning: string | null;
  }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured");

    let html = "";
    try {
      const res = await fetch(data.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; HartstoneDealBot/1.0; +https://hartstoneholdings.com)",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });
      if (!res.ok) {
        return { extracted: {}, warning: `Couldn't fetch URL (HTTP ${res.status}).` };
      }
      html = await res.text();
    } catch (e: any) {
      return { extracted: {}, warning: `Couldn't fetch URL: ${e?.message ?? "network error"}` };
    }

    // Strip scripts/styles, then tags. Collapse whitespace.
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60_000);

    if (!text) {
      return { extracted: {}, warning: "No readable content at that URL." };
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You extract UK BRRR / refinance deal data from property listings (Rightmove, Zoopla, OnTheMarket, auction packs, agent sites). Return numbers in GBP without currency symbols. Use null when a value isn't present. Never invent figures. Percentages are plain numbers (e.g. 75 for 75%).",
          },
          {
            role: "user",
            content: `Extract deal details from this listing. Suggest a short propertyName from the address. Source URL: ${data.url}\n\nPage text:\n\n${text}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "set_deal",
              description: "Submit the extracted BRRR deal fields.",
              parameters: {
                type: "object",
                additionalProperties: false,
                properties: FIELDS,
                required: Object.keys(FIELDS),
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "set_deal" } },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("AI rate limit reached, try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Lovable Cloud.");
      throw new Error(`AI gateway error ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = await res.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return { extracted: {}, warning: "AI returned no structured data." };
    }
    let extracted: Record<string, unknown> = {};
    try {
      extracted = JSON.parse(call.function.arguments);
    } catch {
      return { extracted: {}, warning: "Failed to parse AI response." };
    }
    const clean: Record<string, number | string | boolean> = {};
    for (const [k, v] of Object.entries(extracted)) {
      if (v === null || v === undefined || v === "") continue;
      if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") {
        clean[k] = v;
      }
    }
    return { extracted: clean, warning: null };
  });