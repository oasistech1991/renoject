import { createServerFn } from "@tanstack/react-start";
import { compile } from "planscript";

export const HMO_SYSTEM_PROMPT = `You are a UK HMO (Houses in Multiple Occupation) compliance expert. You analyse a property floorplan image plus property details and return STRUCTURED JSON ONLY (no prose around it) matching the requested schema.

Your PRIMARY JOB is a CAPACITY CALCULATION with THREE SCENARIOS, not a room audit. Do NOT just count the bedrooms drawn on the floorplan. From the total internal floor area work out a shared non-bedroom allocation, then fit THREE distinct bedroom layouts into the remaining bedroom-available area: (1) maxSingles — pack the most lettable rooms favouring singles; (2) maxDoubles — favour 10.22+ sqm doubles even if room count drops; (3) balanced — the realistic mix a UK council would licence.

HMO CONVERSION PLAYBOOK (apply on EVERY analysis — this is the house style):
This is the same logic used to convert a typical UK terrace/semi family home into a high-yield, fully-compliant HMO. Follow these steps when building each scenario, especially \`balanced\`:

Step A — Identify oversize rooms. Any existing room >14 sqm is a subdivision candidate (split into bedroom + en-suite, or into 2 lettable rooms). Any room >22 sqm should be split into 2 lettable bedrooms. Reception rooms, oversized "master" bedrooms and large rear extensions are the highest-value targets.

Step B — En-suite policy. Default to EN-SUITE TO EVERY BEDROOM when the property is ≥150 sqm internal area OR ≥3 storeys OR has ≥6 target bedrooms (the high-yield HMO profile). Carve 2.5–3.2 sqm per en-suite out of the bedroom footprint, placed against the existing soil stack / plumbing wall (typically shared with the original bathroom or stacked vertically between floors) so waste runs cluster. For smaller properties (<150 sqm AND <3 storeys AND <6 beds), fall back to shared bath/WC using the user's bathRatio setting. State the chosen policy in assumptions[].

Step C — Communal allocation. If two reception rooms exist on the ground floor: convert one to a KITCHEN-DINER (16–18 sqm, absorbs communal eating) and keep the other as a COMMUNAL LOUNGE (12–14 sqm). If only one reception exists OR kitchenSizing="kitchen-diner" is set, use a single kitchen-diner and do NOT add a separate lounge. Never lose BOTH communal spaces.

Step D — Wall strategy. Prefer new stud walls anchored to existing chimney breasts, alcoves, structural piers and party walls — these are non-load-bearing and listed as "minor works" complexity. Any partition that crosses a load path, removes a load-bearing wall, needs an RSJ, or relocates the stairs is "structural". Cosmetic = paint / door swap / no wall change.

Step E — Core untouched. Stairs, main hallway and the protected fire escape route stay in their original positions. Only flag a core move as "structural" and only if the scenario is otherwise impossible.

Step F — Bedroom compliance check. Measure each bedroom AFTER subtracting its en-suite footprint, then compare to England HMO minimums (6.51 sqm single / 10.22 sqm double). A 13 sqm room with a 2.8 sqm en-suite = 10.2 sqm lettable, which JUST meets double minimum — flag as compliant but tight.

Worked example (anchor for ~200 sqm 3-storey terraces): a 204 sqm 3-storey mid-terrace with 2 receptions + kitchen + 5 original bedrooms + 1 family bath typically converts to a balanced 9-bed all-en-suite HMO: 8× ~10.2 sqm doubles each with en-suite + 1× ~6.5 sqm single (e.g. in the former box room) + 18 sqm kitchen-diner + 13 sqm communal lounge + ~17% circulation. Reconfiguration is mostly "minor works" (stud walls + en-suite plumbing), no structural changes needed because chimney breasts and alcoves anchor every new partition.

METHOD (follow in order):
1. Determine total internal floor area in sqm.
   - If the user provides totalFloorAreaSqm, use it as ground truth (areaSource = "user").
   - Otherwise estimate it from the floorplan, scale references, dimensions or stated sqft/sqm on the image (areaSource = "estimated"). State your assumption.
2. Allocate NON-BEDROOM space using the USER-SUPPLIED amenity settings:
   - Kitchen sizing setting controls kitchen sqm: "standard" 7-12 sqm, "kitchen-diner" 16-18 sqm (covers communal eating, no separate living room needed), "large" 11-14 sqm.
   - Bath/WC: if the En-suite Policy (Step B) is en-suite-every-bedroom, allocate 2.5-3.2 sqm PER bedroom for en-suites inside the bedroom-available area instead of shared bath sqm here; still add 1 shared WC (~2 sqm) on the ground floor for guests/communal use. Otherwise use the bathRatio setting: 1 bath/WC (~4 sqm) per N occupants (3/4/5), round up.
   - requireLivingRoom: if true add a separate communal living room ~12-14 sqm. If kitchen sizing is "kitchen-diner", do NOT add a separate living room UNLESS the property has ≥2 receptions originally and ≥150 sqm — in that case keep both kitchen-diner AND lounge per Step C.
   - Circulation: use circulationPct exactly as provided (default 17%) applied to total internal area.
3. The remainder is the "bedroom-available area" — shared by all three scenarios. Fit compliant bedrooms into it using England HMO national minimums:
   - Single adult: 6.51 sqm minimum (aim 7-9 sqm realistic)
   - Double: 10.22 sqm minimum (aim 11-13 sqm realistic)
   - Add ~10% loss for internal walls between bedrooms.
   - When en-suite-every-bedroom applies, the lettable bedroom area is measured AFTER subtracting the 2.5-3.2 sqm en-suite (Step F).
4. Build THREE scenarios into the SAME bedroom-available area:
   - maxSingles: maximise lettable room count, mostly 6.51-7.5 sqm singles. En-suite only if Step B threshold met AND single is ≥9 sqm gross so post-carve room still ≥6.51 sqm.
   - maxDoubles: favour 10.22-13 sqm doubles; fewer rooms but higher £/room. Apply en-suite-every-bedroom per Step B.
   - balanced: the conversion-playbook outcome (Steps A-F). This is the layout a professional HMO landlord would actually build — usually all-en-suite doubles + 1 single in any leftover box room, with one kitchen-diner and one lounge.
5. For EACH scenario also assess PHYSICAL ACHIEVABILITY against the drawn floorplan:
   - Look at the actual walls, room shapes, window positions, stairs and structural elements.
   - If a scenario needs wall changes, list them in reconfiguration[] as ordered steps with complexity per Step D: "cosmetic" (paint/door swap), "minor works" (stud wall add/remove, non-load-bearing, en-suite plumbing onto existing stack), or "structural" (load-bearing wall, RSJ, stairs move).
   - Every en-suite added is its own reconfiguration entry ("Add en-suite shower room to Bedroom X — stud wall + plumb onto soil stack", minor works).
   - If the scenario is physically impossible even with reconfiguration (e.g. footprint too narrow, can't get window in every bedroom), set physicallyAchievable=false with physicalNote explaining why and cap bedroomCount accordingly.
   - estRentIndex: a relative 0-100 score for total monthly rent potential of this scenario vs the others (not £ — just the relative ranking).
6. maxCompliantBedrooms (top level) = the BALANCED scenario's bedroomCount.

Also apply: mandatory HMO licensing (5+ occupants), additional/selective licensing in the local authority, Article 4 directions, fire safety (FD30 doors, Grade D LD2/LD3 interlinked alarms, protected escape), planning use class (C3 / C4 / sui generis for 7+).

Populate the capacity object transparently:
- breakdown lists each non-bedroom item with its sqm (e.g. {"item":"Kitchen-diner","sqm":18}, {"item":"Communal lounge","sqm":13}, {"item":"Ground-floor WC","sqm":2}, {"item":"Circulation (17%)","sqm":35}). When en-suite-every-bedroom applies, en-suite sqm is reported inside each room's lettable area, NOT in this breakdown.
- assumptions: 2-4 short bullets the user can sanity-check, including the chosen en-suite policy (e.g. "En-suite to every bedroom (property ≥150 sqm, 3 storeys)", "Used your 17% circulation setting", "1 ground-floor WC for communal/guest use").
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

export const generateUpdatedFloorplan = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      imageBase64: string;
      scenarioLabel: string;
      rooms: { label: string; estimatedSqm: number }[];
      totalFloorAreaSqm?: number;
      reconfiguration: { change: string; complexity: string }[];
    }) => {
      if (!input.imageBase64?.startsWith("data:image/")) {
        throw new Error("Invalid image data");
      }
      if (!input.scenarioLabel) throw new Error("scenarioLabel required");
      if (!Array.isArray(input.rooms) || input.rooms.length === 0) {
        throw new Error("rooms required");
      }
      return input;
    },
  )
  .handler(async ({ data }): Promise<{ imageBase64: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    // Pipeline: Gemini emits PlanScript DSL → planscript compiles → deterministic SVG.
    // We do NOT ask the model to draw pixels. It only emits structured DSL text,
    // which the compiler turns into the same SVG every time for the same input.

    const roomLines = data.rooms
      .map((r, i) => `  ${i + 1}. ${r.label} — ${r.estimatedSqm.toFixed(1)} m²`)
      .join("\n");
    const reconfigLines = data.reconfiguration.length
      ? data.reconfiguration.map((r, i) => `  ${i + 1}. (${r.complexity}) ${r.change}`).join("\n")
      : "  (no structural changes)";

    const totalArea = data.totalFloorAreaSqm ?? Math.max(60, data.rooms.reduce((s, r) => s + r.estimatedSqm, 0) * 1.25);
    // Default footprint: square root of total area, rounded to 0.5m.
    const side = Math.max(6, Math.round(Math.sqrt(totalArea) * 2) / 2);

    const PLANSCRIPT_CHEATSHEET = `PlanScript DSL — minimal syntax you MUST follow exactly.

Top-level shape (always include these lines in this order):
  units m
  defaults { door_width 0.9 window_width 1.2 }
  plan "TITLE" {
    footprint rect (0,0) (W,H)
    room ID { rect (x1,y1) (x2,y2) label "LABEL" }
    ...
    opening door dN { between roomA and roomB on shared_edge at 50% }
    opening window wN { on roomID.edge SIDE at OFFSET }
    assert no_overlap rooms
    assert inside footprint all_rooms
  }

RULES:
- Coordinates are metres, origin (0,0) at top-left, x grows right, y grows down.
- Every room MUST be a single \`rect (x1,y1) (x2,y2)\` inside the footprint (no overlaps).
- Room IDs are snake_case, unique, no spaces (e.g. bed_1, ensuite_1, kitchen_diner).
- "label" is the human-readable name shown on the plan.
- For each adjacent pair of rooms add ONE door between them on the shared_edge.
- SIDE for windows is one of: north, south, east, west.
- Do NOT invent any syntax not shown above. Do NOT add comments. Do NOT add furniture.
- Output PURE PlanScript source, nothing else (no markdown fences, no prose).`;

    const userText = `Generate a PlanScript floorplan for the "${data.scenarioLabel}" HMO scenario.

Building footprint: ${side} m × ${side} m  (total internal area ~${totalArea.toFixed(1)} m²).
Place all rooms inside this footprint with NO overlaps.

Rooms to fit (use these labels exactly, size each rect so its area is close to the target sqm):
${roomLines}

Reconfiguration intent (informational — turn into wall layout):
${reconfigLines}

Return ONLY valid PlanScript source code following the cheatsheet.`;

    async function askForDSL(extraInstruction = ""): Promise<string> {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: PLANSCRIPT_CHEATSHEET },
            { role: "user", content: userText + (extraInstruction ? `\n\n${extraInstruction}` : "") },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "planscript_output",
              schema: {
                type: "object",
                properties: { planscript: { type: "string" } },
                required: ["planscript"],
                additionalProperties: false,
              },
            },
          },
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
      const raw = json.choices?.[0]?.message?.content ?? "";
      try {
        const parsed = JSON.parse(raw) as { planscript?: string };
        if (parsed.planscript) return parsed.planscript;
      } catch {
        /* fall through */
      }
      return raw.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "").trim();
    }

    let dsl = await askForDSL();
    let result = compile(dsl);
    if (!result.success) {
      const errMsg = result.errors?.map((e: any) => e.message ?? String(e)).join("; ") ?? "unknown error";
      dsl = await askForDSL(`Your previous PlanScript failed to compile with these errors:\n${errMsg}\nReturn a corrected PlanScript that compiles cleanly.`);
      result = compile(dsl);
      if (!result.success) {
        const e2 = result.errors?.map((e: any) => e.message ?? String(e)).join("; ") ?? "unknown error";
        throw new Error(`Floorplan compile failed: ${e2}`);
      }
    }

    const svg = result.svg ?? "";
    if (!svg) throw new Error("Compiler produced no SVG.");
    const base64 = Buffer.from(svg, "utf8").toString("base64");
    return { imageBase64: `data:image/svg+xml;base64,${base64}` };
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