import { createServerFn } from "@tanstack/react-start";

export interface RoomAssessment {
  label: string;
  estimatedSqm: number;
  minRequiredSqm: number;
  compliant: boolean;
  note?: string;
}

export interface HMOComplianceResult {
  verdict: "PASS" | "REVIEW" | "FAIL";
  maxCompliantBedrooms: number;
  proposedBedrooms: number;
  headline: string;
  rooms: RoomAssessment[];
  topIssues: string[];
  licensing: { type: string; required: boolean; note: string };
  details: {
    fireSafety: string;
    amenities: string;
    localAuthority: string;
    planning: string;
    actions: string[];
  };
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

    const system = `You are a UK HMO (Houses in Multiple Occupation) compliance expert. You analyse a property floorplan image plus property details and return STRUCTURED JSON ONLY (no prose around it) matching the requested schema.

Your most important job: estimate the MAXIMUM number of bedrooms the floorplan can lawfully provide as HMO bedrooms in the given location, given UK rules.

Apply England HMO minimum room sizes (6.51 sqm single adult, 10.22 sqm double, 4.64 sqm under-10s) and amenity ratios (typically 1 bathroom per 5 occupants, adequate kitchen facilities). Consider mandatory HMO licensing (5+ occupants / 2+ households), additional/selective licensing in the given local authority, Article 4 directions, fire safety (FD30 doors, Grade D LD2/LD3 interlinked alarms, protected escape), and planning use class (C3 / C4 / sui generis for 7+).

Estimate each potential bedroom's floor area from the floorplan. Mark a room compliant only if it meets the minimum for its intended use AND the overall property meets amenity + fire-safety baselines for that occupant count.

Set verdict to:
- PASS if the proposed bedroom count is fully achievable as-is
- REVIEW if achievable with minor changes or licensing actions
- FAIL if the proposed count cannot be reached even after reasonable works

headline: one concise sentence stating the bottom line.
topIssues: 3-5 short bullets, most important first.
details: longer prose for each section (Markdown allowed inside strings).
Use UK English. Return JSON only.`;

    const userText = `Property location: ${data.location}
Bedrooms: ${data.bedrooms}
Storeys: ${data.storeys}
Intended occupants: ${data.occupants}
Additional notes: ${data.notes || "(none)"}

Please analyse the attached floorplan and return the structured HMO compliance JSON for this property at the above location.`;

    const tool = {
      type: "function",
      function: {
        name: "hmo_compliance_report",
        description: "Return the structured HMO compliance assessment.",
        parameters: {
          type: "object",
          properties: {
            verdict: { type: "string", enum: ["PASS", "REVIEW", "FAIL"] },
            maxCompliantBedrooms: { type: "number" },
            proposedBedrooms: { type: "number" },
            headline: { type: "string" },
            rooms: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  estimatedSqm: { type: "number" },
                  minRequiredSqm: { type: "number" },
                  compliant: { type: "boolean" },
                  note: { type: "string" },
                },
                required: ["label", "estimatedSqm", "minRequiredSqm", "compliant"],
                additionalProperties: false,
              },
            },
            topIssues: { type: "array", items: { type: "string" } },
            licensing: {
              type: "object",
              properties: {
                type: { type: "string" },
                required: { type: "boolean" },
                note: { type: "string" },
              },
              required: ["type", "required", "note"],
              additionalProperties: false,
            },
            details: {
              type: "object",
              properties: {
                fireSafety: { type: "string" },
                amenities: { type: "string" },
                localAuthority: { type: "string" },
                planning: { type: "string" },
                actions: { type: "array", items: { type: "string" } },
              },
              required: ["fireSafety", "amenities", "localAuthority", "planning", "actions"],
              additionalProperties: false,
            },
          },
          required: [
            "verdict",
            "maxCompliantBedrooms",
            "proposedBedrooms",
            "headline",
            "rooms",
            "topIssues",
            "licensing",
            "details",
          ],
          additionalProperties: false,
        },
      },
    };

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
        tools: [tool],
        tool_choice: { type: "function", function: { name: "hmo_compliance_report" } },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please top up Lovable AI usage.");
      throw new Error(`AI request failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: {
        message?: {
          content?: string;
          tool_calls?: { function?: { name?: string; arguments?: string } }[];
        };
      }[];
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("Model did not return a structured report.");
    let parsed: HMOComplianceResult;
    try {
      parsed = JSON.parse(args) as HMOComplianceResult;
    } catch {
      throw new Error("Failed to parse model response.");
    }
    return parsed;
  });