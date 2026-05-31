import { createServerFn } from "@tanstack/react-start";

export interface ConditionRoomFinding {
  room: string;
  rating: number;
  observations: string;
  works: string[];
  estimatedCost: number;
}

export interface ConditionResult {
  overallRating: number;
  headline: string;
  totalEstimatedCost: number;
  costRangeLow: number;
  costRangeHigh: number;
  timelineWeeks: string;
  rooms: ConditionRoomFinding[];
  priorityWorks: string[];
  markdown: string;
}

export const analyseCondition = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      images: string[]; // data URLs
      propertyType: string;
      bedrooms: number;
      location: string;
      targetStandard: "basic" | "mid" | "premium";
      notes?: string;
    }) => {
      if (!Array.isArray(input.images) || input.images.length === 0) {
        throw new Error("At least one image required");
      }
      if (input.images.length > 12) throw new Error("Max 12 images");
      for (const img of input.images) {
        if (!img.startsWith("data:image/")) throw new Error("Invalid image data");
      }
      if (!input.location || input.location.length > 200) {
        throw new Error("Location required (max 200 chars)");
      }
      return input;
    },
  )
  .handler(async ({ data }): Promise<ConditionResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const system = `You are a UK lettings refurbishment surveyor. You inspect interior photographs of a property and produce a structured assessment of its current condition and the works required to bring it to a lettable rental standard.

Score the property 1-10 where:
- 1-3 = major refurbishment needed (rewire, replaster, new kitchen/bathroom, damp)
- 4-6 = tired, needs refresh (redecorate, flooring, kitchen/bathroom updates)
- 7-8 = good lettable condition with minor works
- 9-10 = excellent, recently refurbished, ready to let immediately

Estimate realistic UK contractor costs in GBP for the chosen target standard:
- basic = clean, safe, compliant let (budget tenant)
- mid = professional family/sharer standard
- premium = high-end finish (executive let / serviced)

Use current 2025 UK trade prices. Per-room cost ranges to consider:
- Full redecoration of a room: £300-£700
- Carpet/LVT per room: £250-£600
- New kitchen (budget/mid/premium): £3,500 / £7,000 / £15,000+
- New bathroom suite (budget/mid/premium): £2,500 / £5,000 / £9,000+
- Full rewire 3-bed: £4,500-£7,500
- Boiler replacement: £2,500-£3,500
- Replaster a room: £600-£1,200
- EPC remedial works: £500-£3,000

Adjust for the location (London/SE = +25%, North/Wales/NI = baseline).

Return ONLY valid JSON with no markdown fences, matching this schema:
{
  "overallRating": number 1-10,
  "headline": "one-sentence summary",
  "totalEstimatedCost": number (GBP, mid-point),
  "costRangeLow": number,
  "costRangeHigh": number,
  "timelineWeeks": "e.g. 3-5 weeks",
  "rooms": [
    { "room": "Kitchen", "rating": 1-10, "observations": "...", "works": ["..."], "estimatedCost": number }
  ],
  "priorityWorks": ["ordered list of most important works"],
  "markdown": "full markdown report with headings (## Overall, ## Room-by-room, ## Priority works, ## Cost summary)"
}`;

    const userText = `Property type: ${data.propertyType}
Bedrooms: ${data.bedrooms}
Location: ${data.location}
Target rental standard: ${data.targetStandard}
Additional notes: ${data.notes || "(none)"}

Inspect the ${data.images.length} attached interior photos and return the JSON assessment.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              ...data.images.map((url) => ({
                type: "image_url" as const,
                image_url: { url },
              })),
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please top up Lovable AI usage.");
      throw new Error(`AI request failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content?.trim() || "{}";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/, "").trim();

    let parsed: ConditionResult;
    try {
      parsed = JSON.parse(cleaned) as ConditionResult;
    } catch {
      throw new Error("AI returned an invalid response. Please try again.");
    }
    return parsed;
  });