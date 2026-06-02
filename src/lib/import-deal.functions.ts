import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  pdfBase64: z.string().min(1).max(20_000_000),
  filename: z.string().max(255).optional(),
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
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured");

    // Decode base64 -> Uint8Array and extract text with unpdf
    const binary = Uint8Array.from(atob(data.pdfBase64), (c) => c.charCodeAt(0));
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(binary);
    const { text } = await extractText(pdf, { mergePages: true });
    const trimmed = (Array.isArray(text) ? text.join("\n") : text).slice(0, 60_000);
    if (!trimmed.trim()) {
      return { extracted: {}, raw: "", warning: "No text could be read from this PDF." };
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
      return { extracted: {}, raw: trimmed.slice(0, 500), warning: "AI returned no structured data." };
    }
    let extracted: Record<string, unknown> = {};
    try {
      extracted = JSON.parse(call.function.arguments);
    } catch {
      return { extracted: {}, raw: trimmed.slice(0, 500), warning: "Failed to parse AI response." };
    }
    // Strip nulls
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(extracted)) {
      if (v !== null && v !== undefined && v !== "") clean[k] = v;
    }
    return { extracted: clean, raw: "", warning: null };
  });