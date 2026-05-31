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
      rightmoveUrl?: string;
      propertyType: string;
      bedrooms: number;
      location: string;
      targetStandard: "basic" | "mid" | "premium";
      notes?: string;
    }) => {
      const hasUrl = !!input.rightmoveUrl && input.rightmoveUrl.trim().length > 0;
      if ((!Array.isArray(input.images) || input.images.length === 0) && !hasUrl) {
        throw new Error("Provide at least one photo or a Rightmove URL");
      }
      if (hasUrl) {
        try {
          const u = new URL(input.rightmoveUrl!);
          if (!/rightmove\.co\.uk$/i.test(u.hostname) && !/\.rightmove\.co\.uk$/i.test(u.hostname)) {
            throw new Error("URL must be a rightmove.co.uk link");
          }
        } catch {
          throw new Error("Invalid Rightmove URL");
        }
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

    // Optionally scrape Rightmove listing for images + description
    let listingImages: string[] = [];
    let listingContext = "";
    if (data.rightmoveUrl) {
      try {
        const pageRes = await fetch(data.rightmoveUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
          },
        });
        if (!pageRes.ok) throw new Error(`Rightmove returned ${pageRes.status}`);
        const html = await pageRes.text();

        // Extract media image URLs (Rightmove serves photos from media.rightmove.co.uk)
        const imgMatches = Array.from(
          html.matchAll(/https:\/\/media\.rightmove\.co\.uk\/[^"'\s)]+\.(?:jpe?g|png|webp)/gi),
        ).map((m) => m[0]);
        // Dedupe and prefer larger/max variants, drop floorplans/EPC/logo
        const unique = Array.from(new Set(imgMatches)).filter(
          (u) => !/FLP|EPC|logo|brand/i.test(u),
        );
        listingImages = unique.slice(0, 12);

        const pick = (re: RegExp) => {
          const m = html.match(re);
          return m ? m[1].replace(/\s+/g, " ").trim() : "";
        };
        const ogTitle = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
        const ogDesc = pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
        const pageTitle = pick(/<title>([^<]+)<\/title>/i);
        listingContext = [
          ogTitle && `Listing title: ${ogTitle}`,
          pageTitle && `Page title: ${pageTitle}`,
          ogDesc && `Listing description: ${ogDesc}`,
          `Source: ${data.rightmoveUrl}`,
          `Scraped ${listingImages.length} photos from the listing.`,
        ]
          .filter(Boolean)
          .join("\n");
      } catch (e) {
        throw new Error(
          `Could not load Rightmove listing: ${(e as Error).message}. Try again or upload photos manually.`,
        );
      }
    }

    // Combine uploaded data-URL images with scraped listing URLs (cap at 14 total)
    const allImages: Array<{ url: string }> = [
      ...data.images.map((url) => ({ url })),
      ...listingImages.map((url) => ({ url })),
    ].slice(0, 14);

    if (allImages.length === 0) {
      throw new Error("No photos found on the Rightmove listing. Please upload photos instead.");
    }

    const system = `You are a chartered UK lettings refurbishment surveyor with 20 years' experience pricing buy-to-let refurbs across England, Wales, Scotland and NI. You inspect interior photographs and produce a strict, evidence-based assessment of the property's current condition and the works needed to bring it to the requested rental standard.

============================================================
SCORING RUBRIC (1-10) — pick the LOWEST band where ANY listed issue applies. Do NOT round scores up because the photos are well-lit or staged.
============================================================
- 1-2: Uninhabitable / pre-refurb shell. Active damp/mould, missing kitchen or bathroom, exposed wiring, failed plaster, no flooring, fire damage.
- 3:   Major refurb. Both kitchen AND bathroom dated/end-of-life, full redecorate throughout, flooring throughout, likely rewire and/or boiler replacement.
- 4:   Tired throughout. Kitchen and/or bathroom serviceable but visibly dated (>15 yrs). Full redecorate + most flooring needed. Multiple repair items.
- 5:   Below lettable. Redecorate most rooms, replace some flooring, deep clean, minor kitchen/bathroom refresh (worktop, taps, seals, paint units).
- 6:   Lettable with refresh. Touch-up decoration in 2-3 rooms, 1-2 carpets, minor repairs, professional clean. No major works.
- 7:   Good lettable. Clean, neutral, only minor snags (touch-ups, one carpet, garden tidy, light bulb/blind replacements).
- 8:   Very good. Recently maintained, ready to market within a week. Cosmetic only.
- 9:   Excellent. Recently refurbished to a high standard, photo-ready.
- 10:  New build / showhome standard.

============================================================
CALIBRATED UK COST BANDS (2025) — use these unit costs, do not invent figures.
Each row: basic / mid / premium GBP.
============================================================
- Full redecoration per room (walls, ceiling, woodwork): 350 / 550 / 900
- Carpet per room supplied & fitted:                     250 / 400 / 650
- LVT per room supplied & fitted:                        450 / 700 / 1100
- Kitchen — small/galley (replace):                      3500 / 7000 / 14000
- Kitchen — medium (replace):                            5000 / 9500 / 18000
- Bathroom suite + tiling (replace):                     2800 / 5000 / 9000
- Shower room (replace):                                 2200 / 4200 / 7500
- Replaster a room:                                      700 / 1000 / 1400
- Skim a ceiling:                                        250 / 400 / 600
- Full rewire 2-bed / 3-bed / 4-bed:                     4000 / 5500 / 7500 (use bedroom count)
- Consumer unit only:                                    650
- Combi boiler swap:                                     2500 / 3000 / 3800
- New radiator (per):                                    220 / 320 / 450
- EPC remedial bundle (loft top-up, LEDs, TRVs, draught):400 / 1200 / 2800
- Damp treatment + localised replaster:                  900 / 1800 / 3500
- uPVC window (per):                                     550 / 750 / 1100
- Internal door + furniture (per):                       180 / 260 / 380
- Fire door FD30 (HMO, per):                             350 / 450 / 600
- Deep clean (3-bed end of tenancy):                     250 / 350 / 500
- Garden tidy / clearance:                               200 / 450 / 900

Target standard mapping:
- basic   = clean, safe, compliant let (budget tenant) → use BASIC column
- mid     = professional family/sharer standard       → use MID column
- premium = high-end finish (executive / serviced)    → use PREMIUM column

============================================================
REGIONAL MULTIPLIER — apply to the FINAL totalEstimatedCost and to each per-room estimatedCost.
============================================================
- London / inner SE:                                    ×1.25
- Outer SE, Bristol, Edinburgh, Cambridge, Oxford:      ×1.15
- Midlands, NW cities, Yorkshire cities (baseline):     ×1.00
- North East, Wales, NI, rural:                         ×0.90
Infer the region from the supplied location string; if ambiguous, use ×1.00.

============================================================
OUTPUT CONTRACT — strict.
============================================================
- costRangeLow  = round(totalEstimatedCost × 0.85 / 50) × 50
- costRangeHigh = round(totalEstimatedCost × 1.20 / 50) × 50
- Every room finding MUST cite at least one observable detail from the photos (e.g. "blown sealed unit in rear window", "worn carpet at lounge threshold", "dated 90s oak kitchen units, laminate worktop chipped at sink"). No generic boilerplate.
- priorityWorks ordered strictly by: (1) Health & Safety, (2) Compliance (EPC / electrics / gas / fire), (3) Kitchen/Bathroom, (4) Decoration, (5) Cosmetic/Garden.
- timelineWeeks derived from totalEstimatedCost ladder:
    ≤ £1,500  → "1 week"
    ≤ £5,000  → "1-2 weeks"
    ≤ £10,000 → "2-4 weeks"
    ≤ £20,000 → "4-6 weeks"
    > £20,000 → "6-10 weeks"
- markdown report MUST use exactly these sections in this order:
    ## Overall
    ## Compliance & safety
    ## Room-by-room
    ## Priority works
    ## Cost summary
  The Cost summary section must include a markdown table with columns: Room | Works | Estimated cost.

Return ONLY valid JSON with no markdown fences, matching this schema:
{
  "overallRating": number 1-10,
  "headline": "one-sentence summary tied to specific observations",
  "totalEstimatedCost": number (GBP, region-adjusted),
  "costRangeLow": number,
  "costRangeHigh": number,
  "timelineWeeks": "string from the ladder above",
  "rooms": [
    { "room": "Kitchen", "rating": 1-10, "observations": "specific to photos", "works": ["..."], "estimatedCost": number (region-adjusted) }
  ],
  "priorityWorks": ["ordered per the rules above"],
  "markdown": "full markdown report with the five fixed sections"
}`;

    const region =
      /london|EC|WC|N1|N2|SW|SE|NW|E1|W1|W2|W8|W11|W14/i.test(data.location)
        ? "London / inner SE (×1.25)"
        : /brighton|guildford|reading|oxford|cambridge|bristol|edinburgh|st albans|watford/i.test(
              data.location,
            )
          ? "Outer SE / high-cost city (×1.15)"
          : /newcastle|sunderland|durham|wales|cardiff|swansea|belfast|northern ireland|rural/i.test(
                data.location,
              )
            ? "North East / Wales / NI / rural (×0.90)"
            : "Baseline (×1.00)";

    const userText = `Property type: ${data.propertyType}
Bedrooms: ${data.bedrooms}
Location: ${data.location}
Region multiplier: ${region}
Target rental standard: ${data.targetStandard}
Additional notes: ${data.notes || "(none)"}
${listingContext ? `\nRightmove listing details:\n${listingContext}\n` : ""}
Inspect the ${allImages.length} attached property photos and return the JSON assessment.

Reminder: Score against the rubric using the lowest matching band. Apply the ${data.targetStandard.toUpperCase()} unit cost column and the ${region} multiplier to every cost. Tie every observation to something visible in the photos. Do NOT round scores up.`;

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
              ...allImages.map(({ url }) => ({
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