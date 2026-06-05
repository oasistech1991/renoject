## Why no floorplan image is being generated today

The HMO checker never actually generates a floorplan image. The "Updated floorplan with dimensions" block on `src/routes/hmo-compliance.tsx` is a **synthetic SVG schematic** (`UpdatedFloorplan` at the bottom of the file) — it just packs coloured rectangles sized by sqm into an estimated footprint from `active.rooms[]`. The only AI call (`analyseFloorplan` in `src/lib/hmo.functions.ts`) returns JSON text only; no image model is invoked.

So "the floorplan isn't being generated to show the updated layout" is expected — there is no image-generation step wired up.

## Plan: add a real AI-rendered "updated floorplan" image

Add an explicit image-generation step, on demand (button), per scenario, using Lovable AI's Gemini image model. Keep the existing SVG schematic as a fast preview; the AI image is the polished version.

### 1. New server function — `generateUpdatedFloorplan`
File: `src/lib/hmo.functions.ts`

- `createServerFn({ method: "POST" })` with `inputValidator` for:
  - `imageBase64` (the original uploaded floorplan, data URL)
  - `scenarioLabel` (e.g. "Balanced", "Max singles", "Max doubles")
  - `rooms: { label, estimatedSqm }[]` (from the chosen scenario)
  - `totalFloorAreaSqm?: number`
  - `reconfiguration: { change, complexity }[]` (so the model knows which walls to move)
- Calls `https://ai.gateway.lovable.dev/v1/chat/completions` with model `google/gemini-2.5-flash-image` (nano-banana — supports image input + image output), passing:
  - the original floorplan image
  - a strict prompt: "Redraw this floorplan as a clean top-down 2D schematic showing the {scenarioLabel} HMO layout. Keep the building outline and window/door positions from the original. Relabel rooms exactly as listed with their sqm. Apply the reconfiguration steps. Black walls on white, room labels in sans-serif, dimensions in metres. No photorealism."
- Extracts the returned image (base64 data URL) from the response and returns `{ imageBase64: string }`.
- Handles 429 / 402 with the same friendly errors as `analyseFloorplan`.

### 2. UI wiring
File: `src/routes/hmo-compliance.tsx`

- Add state: `generatedFloorplans: Record<ScenarioKey, string | null>`, `generatingScenario: ScenarioKey | null`, `genError: string | null`.
- In the existing "Updated floorplan with dimensions" section (around line 984), add a header row with the existing title plus a "Generate AI floorplan" button (re-run button shown when an image already exists).
- On click → call the new server fn via `useServerFn`, passing the original `imageBase64`, the active scenario's rooms, reconfiguration, and `data.capacity.totalFloorAreaSqm`. Store result keyed by `activeScenario`.
- Render:
  - If `generatedFloorplans[activeScenario]` exists → show the AI image (with a "Schematic preview" toggle that flips back to the existing `UpdatedFloorplan` SVG).
  - Otherwise → show the existing `UpdatedFloorplan` SVG as today (so nothing regresses) plus the generate button.
  - While generating → spinner + "Drawing updated floorplan…".
  - On error → small inline error block.
- Reset the cache whenever a fresh compliance check finishes (i.e. when `mutation.data` changes).

### 3. No database / no schema changes
The image is shown in-session only. (Persisting alongside `hmo_analyses` can be a follow-up if you want — say the word.)

### 4. Scope guardrails
- No change to `analyseFloorplan` logic or its prompt.
- No change to the JSON schema or scenario calculation.
- The existing SVG schematic stays as a fallback so the page still works if image generation fails or is rate-limited.

## Files touched
- `src/lib/hmo.functions.ts` — add `generateUpdatedFloorplan` server fn.
- `src/routes/hmo-compliance.tsx` — add button, state, fetch call, and image render in the existing floorplan section.

## Open assumption (tell me if wrong)
I'm assuming you want an **AI-rendered image** of the updated layout (top-down schematic based on your uploaded floorplan). If you actually meant "the SVG block diagram isn't showing up at all", that's a different bug — share a screenshot of the scenario tab and I'll fix that instead.