import { createServerFn } from "@tanstack/react-start";

export const HMO_SYSTEM_PROMPT = `You are a UK HMO (Houses in Multiple Occupation) compliance expert. You analyse a property floorplan image plus property details and return STRUCTURED JSON ONLY (no prose around it) matching the requested schema.

Your PRIMARY JOB is a CAPACITY CALCULATION with THREE SCENARIOS, not a room audit. Do NOT just count the bedrooms drawn on the floorplan. From the total internal floor area work out a shared non-bedroom allocation, then fit THREE distinct bedroom layouts into the remaining bedroom-available area: (1) maxSingles — pack the most lettable rooms favouring singles; (2) maxDoubles — favour 10.22+ sqm doubles even if room count drops; (3) balanced — the realistic mix a UK council would licence.

METHOD (follow in order):
1. Determine total internal floor area in sqm.
   - If the user provides totalFloorAreaSqm, use it as ground truth (areaSource = "user").
   - Otherwise estimate it from the floorplan, scale references, dimensions or stated sqft/sqm on the image (areaSource = "estimated"). State your assumption.
2. Allocate NON-BEDROOM space using the USER-SUPPLIED amenity settings:
   - Kitchen sizing setting controls kitchen sqm: "standard" 7-12 sqm, "kitchen-diner" 12-16 sqm (covers communal eating, no separate living room needed), "large" 11-14 sqm.
   - Bath/WC ratio setting: 1 bath/WC (~4 sqm) per N occupants (3/4/5). Round up.
   - requireLivingRoom: if true add a separate communal living room ~10-14 sqm. If kitchen sizing is "kitchen-diner", do NOT add a separate living room.
   - Circulation: use circulationPct exactly as provided (default 17%) applied to total internal area.
3. The remainder is the "bedroom-available area" — shared by all three scenarios. Fit compliant bedrooms into it using England HMO national minimums:
   - Single adult: 6.51 sqm minimum (aim 7-9 sqm realistic)
   - Double: 10.22 sqm minimum (aim 11-13 sqm realistic)
   - Add ~10% loss for internal walls between bedrooms.
4. Build THREE scenarios into the SAME bedroom-available area:
   - maxSingles: maximise lettable room count, mostly 6.51-7.5 sqm singles.
   - maxDoubles: favour 10.22-13 sqm doubles; fewer rooms but higher £/room.
   - balanced: a realistic mix of singles + doubles a council would licence and a landlord would actually let.
5. For EACH scenario also assess PHYSICAL ACHIEVABILITY against the drawn floorplan:
   - Look at the actual walls, room shapes, window positions, stairs and structural elements.
   - If a scenario needs wall changes, list them in reconfiguration[] as ordered steps with complexity "cosmetic" (paint/door swap), "minor works" (stud wall add/remove, non-load-bearing), or "structural" (load-bearing wall, RSJ, stairs move).
   - If the scenario is physically impossible even with reconfiguration (e.g. footprint too narrow, can't get window in every bedroom), set physicallyAchievable=false with physicalNote explaining why and cap bedroomCount accordingly.
   - estRentIndex: a relative 0-100 score for total monthly rent potential of this scenario vs the others (not £ — just the relative ranking).
6. maxCompliantBedrooms (top level) = the BALANCED scenario's bedroomCount.

Also apply: mandatory HMO licensing (5+ occupants), additional/selective licensing in the local authority, Article 4 directions, fire safety (FD30 doors, Grade D LD2/LD3 interlinked alarms, protected escape), planning use class (C3 / C4 / sui generis for 7+).

Populate the capacity object transparently:
- breakdown lists each non-bedroom item with its sqm (e.g. {"item":"Kitchen/diner","sqm":11}, {"item":"2x bathroom","sqm":8}, {"item":"Circulation (17%)","sqm":18}).
- assumptions: 2-4 short bullets the user can sanity-check (e.g. "Used your 17% circulation setting", "1 bath/WC per 5 occupants per your setting").
- nonBedroomAllocationSqm = sum of breakdown items.
- bedroomAvailableSqm = totalFloorAreaSqm - nonBedroomAllocationSqm.

Top-level rooms[]: MIRROR scenarios.balanced.rooms (kept for backward compatibility).

Per-scenario verdict (vs the user's proposedBedrooms):
- PASS if proposedBedrooms <= scenario.bedroomCount with no material works (only cosmetic reconfig).
- REVIEW if achievable with minor works.
- FAIL if scenario.bedroomCount < proposedBedrooms or only achievable with structural works.
Top-level verdict = balanced scenario verdict.

headline: one concise sentence stating the bottom line.
topIssues: 3-5 short bullets across all scenarios, most important first.
details: longer prose for each section (Markdown allowed inside strings).
Use UK English. Return JSON only.`;

export const getHmoSystemPrompt = createServerFn({ method: "GET" }).handler(async () => {
  return { prompt: HMO_SYSTEM_PROMPT, model: "google/gemini-2.5-flash" };
});

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

export type ScenarioKey = "maxSingles" | "balanced" | "maxDoubles";

export interface ReconfigurationStep {
  change: string;
  impact: string;
  complexity: "cosmetic" | "minor works" | "structural";
}

export interface CapacityScenario {
  bedroomCount: number;
  mix: { singles: number; doubles: number };
  verdict: "PASS" | "REVIEW" | "FAIL";
  physicallyAchievable: boolean;
  physicalNote?: string;
  estRentIndex: number; // 0-100 relative
  tradeoffs: string[];
  rooms: RoomAssessment[];
  reconfiguration: ReconfigurationStep[];
  issues: string[];
}

export interface HMOComplianceResult {
  verdict: "PASS" | "REVIEW" | "FAIL";
  maxCompliantBedrooms: number;
  proposedBedrooms: number;
  headline: string;
  capacity: CapacityCalculation;
  scenarios: {
    maxSingles: CapacityScenario;
    balanced: CapacityScenario;
    maxDoubles: CapacityScenario;
  };
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
      bathRatio?: 3 | 4 | 5; // 1 bath per N occupants
      kitchenSizing?: "standard" | "kitchen-diner" | "large";
      requireLivingRoom?: boolean;
      circulationPct?: number; // 12-22
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
      if (
        input.circulationPct !== undefined &&
        (input.circulationPct < 10 || input.circulationPct > 25)
      ) {
        throw new Error("Circulation % must be between 10 and 25");
      }
      return input;
    },
  )
  .handler(async ({ data }): Promise<HMOComplianceResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const system = HMO_SYSTEM_PROMPT;

    const areaLine = data.totalFloorAreaSqm
      ? `Total internal floor area (user-provided, treat as ground truth): ${data.totalFloorAreaSqm} sqm`
      : `Total internal floor area: NOT provided — estimate from the floorplan and set areaSource = "estimated".`;
    const scaleLine = data.scaleReference
      ? `Scale reference: ${data.scaleReference}`
      : "";
    const bathRatio = data.bathRatio ?? 5;
    const kitchenSizing = data.kitchenSizing ?? "standard";
    const requireLivingRoom = data.requireLivingRoom ?? false;
    const circulationPct = data.circulationPct ?? 17;

    const userText = `Property location: ${data.location}
Proposed/target HMO bedrooms: ${data.bedrooms}
Storeys: ${data.storeys}
Intended occupants: ${data.occupants}
${areaLine}
${scaleLine}

Amenity standards (user-configured):
- Bath/WC ratio: 1 per ${bathRatio} occupants
- Kitchen sizing: ${kitchenSizing}
- Separate living room required: ${requireLivingRoom ? "yes" : "no"}
- Circulation %: ${circulationPct}

Additional notes: ${data.notes || "(none)"}

Run the three-scenario capacity calculation as described and return the structured HMO compliance JSON.`;

    const roomsSchema = {
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
    } as const;

    const scenarioSchema = {
      type: "object",
      properties: {
        bedroomCount: { type: "number" },
        mix: {
          type: "object",
          properties: {
            singles: { type: "number" },
            doubles: { type: "number" },
          },
          required: ["singles", "doubles"],
          additionalProperties: false,
        },
        verdict: { type: "string", enum: ["PASS", "REVIEW", "FAIL"] },
        physicallyAchievable: { type: "boolean" },
        physicalNote: { type: "string" },
        estRentIndex: { type: "number" },
        tradeoffs: { type: "array", items: { type: "string" } },
        rooms: roomsSchema,
        reconfiguration: {
          type: "array",
          items: {
            type: "object",
            properties: {
              change: { type: "string" },
              impact: { type: "string" },
              complexity: {
                type: "string",
                enum: ["cosmetic", "minor works", "structural"],
              },
            },
            required: ["change", "impact", "complexity"],
            additionalProperties: false,
          },
        },
        issues: { type: "array", items: { type: "string" } },
      },
      required: [
        "bedroomCount",
        "mix",
        "verdict",
        "physicallyAchievable",
        "estRentIndex",
        "tradeoffs",
        "rooms",
        "reconfiguration",
        "issues",
      ],
      additionalProperties: false,
    } as const;

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
            scenarios: {
              type: "object",
              properties: {
                maxSingles: scenarioSchema,
                balanced: scenarioSchema,
                maxDoubles: scenarioSchema,
              },
              required: ["maxSingles", "balanced", "maxDoubles"],
              additionalProperties: false,
            },
            rooms: roomsSchema,
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
            "scenarios",
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