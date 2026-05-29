import { createServerFn } from "@tanstack/react-start";

export interface HMOComplianceResult {
  summary: string;
  markdown: string;
}

export const analyseFloorplan = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      imageBase64: string; // data URL
      location: string;
      bedrooms: number;
      storeys: number;
      occupants: number;
      notes?: string;
    }) => {
      if (!input.imageBase64?.startsWith("data:image/")) {
        throw new Error("Invalid image data");
      }
      if (!input.location || input.location.length > 200) {
        throw new Error("Location required (max 200 chars)");
      }
      return input;
    },
  )
  .handler(async ({ data }): Promise<HMOComplianceResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const system = `You are a UK HMO (Houses in Multiple Occupation) compliance expert. You analyse a property floorplan image plus property details, and produce a detailed compliance assessment covering:
- Whether the property likely falls under mandatory HMO licensing (5+ occupants from 2+ households) or additional/selective licensing schemes that may apply in the given local authority area
- Minimum room size requirements (England: 6.51 sqm single adult, 10.22 sqm double, under-10s 4.64 sqm)
- Amenity standards: kitchen, bathroom/WC ratios per occupant (typical 1 bathroom per 5 occupants)
- Fire safety: escape routes, fire doors (FD30), interlinked smoke/heat alarms (Grade D LD2/LD3), emergency lighting
- Means of escape and protected escape routes
- Ventilation, natural light, heating
- Local authority-specific rules where you can identify them from the location (e.g. Article 4 directions, additional licensing in cities like Manchester, Liverpool, Birmingham, Nottingham, Leeds, London boroughs)
- Planning (C3 vs C4 use class, sui generis for 7+)

Estimate room sizes from the floorplan visually where possible and flag any that look below minimum. Be specific, cite numeric standards, and end with a clear PASS / REVIEW / FAIL verdict and a prioritised action list. Use UK English. Format the response as Markdown with clear headings.`;

    const userText = `Property location: ${data.location}
Bedrooms: ${data.bedrooms}
Storeys: ${data.storeys}
Intended occupants: ${data.occupants}
Additional notes: ${data.notes || "(none)"}

Please analyse the attached floorplan image and provide a full HMO compliance report for this property at the above location.`;

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
              { type: "image_url", image_url: { url: data.imageBase64 } },
            ],
          },
        ],
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
    const markdown = json.choices?.[0]?.message?.content?.trim() || "No response from model.";
    const summary = markdown.split("\n").find((l) => l.trim().length > 0) || "Analysis complete";
    return { markdown, summary };
  });