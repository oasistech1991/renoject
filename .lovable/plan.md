## Goal

Refocus `/hmo-compliance` so the answer to "how many compliant bedrooms can I get out of this floorplan in this area?" is the first thing you see. Push the granular regulation breakdown behind "See more".

## Changes

### 1. Restructure the AI output (server fn)

Edit `src/lib/hmo.functions.ts` so `analyseFloorplan` returns **structured JSON** instead of one big markdown blob. New return type:

```ts
interface HMOComplianceResult {
  verdict: "PASS" | "REVIEW" | "FAIL";
  maxCompliantBedrooms: number;     // headline answer
  proposedBedrooms: number;          // what the user asked for
  headline: string;                  // 1-sentence summary
  rooms: Array<{
    label: string;                   // "Bedroom 1", "Bedroom 2"…
    estimatedSqm: number;
    minRequiredSqm: number;
    compliant: boolean;
    note?: string;
  }>;
  topIssues: string[];               // 3-5 bullets, most important first
  licensing: { type: string; required: boolean; note: string };
  details: {                         // full breakdown — only shown on expand
    fireSafety: string;
    amenities: string;
    localAuthority: string;
    planning: string;
    actions: string[];
  };
}
```

Switch the Lovable AI call to `response_format: { type: "json_schema", ... }` (Gemini 2.5 Flash supports it via the gateway) and update the system prompt to instruct the model to compute `maxCompliantBedrooms` by sizing rooms against England HMO minimums (6.51 / 10.22 / 4.64 sqm) and amenity ratios for the given location.

### 2. New result UI (route file)

Edit `src/routes/hmo-compliance.tsx`. Replace the single `<article>` markdown block with a layered layout:

**Hero card (always visible):**
- Big number: `maxCompliantBedrooms` (e.g. "5 compliant bedrooms")
- Sub-line: "You asked for {proposedBedrooms} — {delta message}"
- Verdict pill: PASS / REVIEW / FAIL (colour-coded via design tokens)
- Headline sentence
- Licensing one-liner ("Mandatory HMO licence required" / "Additional licensing applies in {area}")

**Top issues card:** 3-5 bullets from `topIssues`.

**Room table:** one row per detected bedroom with estimated sqm, min required, pass/fail dot.

**Collapsible "See full compliance detail"** (shadcn `Accordion`) containing four sections — Fire safety, Amenities, Local authority rules, Planning — plus a prioritised action list. This is where today's granular markdown lives.

### 3. Keep the form unchanged

Left-hand input panel (image upload, location, beds/storeys/occupants, notes) stays exactly as it is.

## Out of scope

- No changes to other routes, no DB writes, no saving HMO reports to `properties` yet (can be a follow-up once the new shape is stable).
- No new dependencies — shadcn `Accordion`, `Badge`, `Card` are already in the project.

## Open question

Do you want a **"Re-run with N bedrooms"** quick action on the hero card (so if the AI says you can fit 6, one click re-checks the layout assuming 6 occupants/licensing tier)? Easy to add now, or skip for v1.
