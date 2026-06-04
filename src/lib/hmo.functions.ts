import { createServerFn } from "@tanstack/react-start";

export interface RoomAssessment {
  label: string;
  estimatedSqm: number;
  minRequiredSqm: number;
  compliant: boolean;
  note?: string;
}

export interface CapacityBreakdownItem {
  item: string;
  sqm: number;
}

export interface CapacityCalculation {
  totalFloorAreaSqm: number;
  areaSource: "user" | "estimated";
  nonBedroomAllocationSqm: number;
  bedroomAvailableSqm: number;
  breakdown: CapacityBreakdownItem[];
  assumptions: string[];
}

export interface HMOComplianceResult {
  verdict: "PASS" | "REVIEW" | "FAIL";
  maxCompliantBedrooms: number;
  proposedBedrooms: number;
  headline: string;
  capacity: CapacityCalculation;
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
      totalFloorAreaSqm?: number; // user-provided ground truth, optional
      scaleReference?: string;
    }) => {
      if (!input.imageBase64?.startsWith("data:image/")) {
        throw new Error("Invalid image data");
      }
      if (!input.location || input.location.length > 200) {
        throw new Error("Location required (max 200 chars)");
      }
      if (
        input.totalFloorAreaSqm !== undefined &&
        (!Number.isFinite(input.totalFloorAreaSqm) ||
          input.totalFloorAreaSqm <= 0 ||
          input.totalFloorAreaSqm > 2000)
      ) {
        throw new Error("Total floor area must be between 0 and 2000 sqm");
      }
      return input;
    },
  )
  .handler(async ({ data }): Promise<HMOComplianceResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const system = `You are a UK HMO (Houses in Multiple Occupation) compliance expert. You analyse a property floorplan image plus property details and return STRUCTURED JSON ONLY (no prose around it) matching the requested schema.

Your PRIMARY JOB is a CAPACITY CALCULATION, not a room audit. Do NOT just count the bedrooms drawn on the floorplan. Work out, from the total internal floor area, how many HMO-compliant bedrooms can realistically fit alongside the required kitchen, bathrooms and circulation.

METHOD (follow in order):
1. Determine total internal floor area in sqm.
   - If the user provides totalFloorAreaSqm, use it as ground truth (areaSource = "user").
   - Otherwise estimate it from the floorplan, scale references, dimensions or stated sqft/sqm on the image (areaSource = "estimated"). State your assumption.
2. Allocate NON-BEDROOM space for the proposed occupant count:
   - Kitchen: 7-12 sqm (scale with occupants; >5 occupants needs ~11-12 sqm or two prep areas).
   - Bathrooms/WCs: ~4 sqm each, 1 per 5 occupants (England HMO amenity standard). Round up.
   - Communal living room: include ~10-14 sqm UNLESS kitchen is large enough to be a kitchen/diner.
   - Circulation (hallways, landings, stairs, internal walls): 15-20% of total internal area.
3. The remainder is the "bedroom-available area". Fit compliant bedrooms into it using England HMO minimums:
   - Single adult: 6.51 sqm minimum (aim 7-9 sqm realistic)
   - Double: 10.22 sqm minimum (aim 11-13 sqm realistic)
   - Add ~10% loss for internal walls between bedrooms.
   Choose a sensible mix that maximises lettable rooms without dropping below minimums.
4. maxCompliantBedrooms = the count from step 3, capped by what is physically plausible given the building's footprint and storeys.

Also apply: mandatory HMO licensing (5+ occupants), additional/selective licensing in the local authority, Article 4 directions, fire safety (FD30 doors, Grade D LD2/LD3 interlinked alarms, protected escape), planning use class (C3 / C4 / sui generis for 7+).

Populate the capacity object transparently:
- breakdown lists each non-bedroom item with its sqm (e.g. {"item":"Kitchen/diner","sqm":11}, {"item":"2x bathroom","sqm":8}, {"item":"Circulation (17%)","sqm":18}).
- assumptions: 2-4 short bullets the user can sanity-check (e.g. "Assumed 17% circulation", "Estimated total area from scale bar").
- nonBedroomAllocationSqm = sum of breakdown items.
- bedroomAvailableSqm = totalFloorAreaSqm - nonBedroomAllocationSqm.

rooms[]: the PROPOSED compliant bedroom layout (Bedroom 1..N) with the sqm you've allocated to each, NOT a list of rooms currently drawn on the plan.

Verdict:
- PASS if proposedBedrooms <= maxCompliantBedrooms with no material works.
- REVIEW if achievable with minor reconfiguration or licensing actions.
- FAIL if proposedBedrooms > maxCompliantBedrooms even after reasonable works.

headline: one concise sentence stating the bottom line.
topIssues: 3-5 short bullets, most important first.
details: longer prose for each section (Markdown allowed inside strings).
Use UK English. Return JSON only.`;

    const areaLine = data.totalFloorAreaSqm
      ? `Total internal floor area (user-provided, treat as ground truth): ${data.totalFloorAreaSqm} sqm`
      : `Total internal floor area: NOT provided — estimate from the floorplan and set areaSource = "estimated".`;
    const scaleLine = data.scaleReference
      ? `Scale reference: ${data.scaleReference}`
      : "";

    const userText = `Property location: ${data.location}
Proposed/target HMO bedrooms: ${data.bedrooms}
Storeys: ${data.storeys}
Intended occupants: ${data.occupants}
${areaLine}
${scaleLine}
Additional notes: ${data.notes || "(none)"}

Run the capacity calculation as described and return the structured HMO compliance JSON.`;

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
            capacity: {
              type: "object",
              properties: {
                totalFloorAreaSqm: { type: "number" },
                areaSource: { type: "string", enum: ["user", "estimated"] },
                nonBedroomAllocationSqm: { type: "number" },
                bedroomAvailableSqm: { type: "number" },
                breakdown: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      item: { type: "string" },
                      sqm: { type: "number" },
                    },
                    required: ["item", "sqm"],
                    additionalProperties: false,
                  },
                },
                assumptions: { type: "array", items: { type: "string" } },
              },
              required: [
                "totalFloorAreaSqm",
                "areaSource",
                "nonBedroomAllocationSqm",
                "bedroomAvailableSqm",
                "breakdown",
                "assumptions",
              ],
              additionalProperties: false,
            },
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
            "capacity",
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