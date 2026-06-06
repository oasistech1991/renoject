import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SearchInput = z.object({
  town: z.string().trim().min(2).max(80),
  trade: z.string().trim().min(2).max(80),
});

/** Normalise common UK town misspellings before sending to Google Places. */
function normaliseTown(input: string): string {
  let t = input.trim().replace(/\s+/g, " ");
  const map: Record<string, string> = {
    middlesborough: "Middlesbrough",
    middlesbrouogh: "Middlesbrough",
    newcaslte: "Newcastle",
    manchster: "Manchester",
    birmingam: "Birmingham",
  };
  const low = t.toLowerCase();
  if (map[low]) return map[low];
  return t;
}

type ReviewBreakdownEntry = {
  source: string;
  url: string | null;
  rating: number | null;
  count: number | null;
  snippets: Array<{ text: string; rating: number | null }>;
};

type Candidate = {
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  area_covered: string | null;
  website: string | null;
  specialities: string[];
  rating: number | null;
  review_count: number | null;
  social_presence_score: number | null;
  sources: Record<string, unknown>;
  reviewSnippets: string[];
  reviewBreakdown: ReviewBreakdownEntry[];
};

function normaliseKey(name: string, phone: string | null): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}|${(phone ?? "").replace(/\D/g, "")}`;
}

async function searchGooglePlaces(query: string): Promise<Candidate[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!apiKey || !lovableKey) return [];

  const res = await fetch("https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchText", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": apiKey,
      "Content-Type": "application/json",
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.reviews,places.types,places.businessStatus",
    },
    body: JSON.stringify({ textQuery: query, pageSize: 15 }),
  });

  if (!res.ok) {
    console.error("Places searchText failed", res.status, await res.text().catch(() => ""));
    return [];
  }
  const data = (await res.json()) as { places?: Array<Record<string, any>> };
  const places = data.places ?? [];

  return places
    .filter((p) => p.businessStatus !== "CLOSED_PERMANENTLY")
    .map((p): Candidate => {
      const reviews: Array<{ text?: { text?: string }; rating?: number }> = p.reviews ?? [];
      const snippets = reviews.slice(0, 8).map((r) => `(${r.rating ?? "?"}★) ${r.text?.text ?? ""}`.trim());
      const googleUrl = p.id ? `https://www.google.com/maps/place/?q=place_id:${p.id}` : null;
      const googleBreakdown: ReviewBreakdownEntry = {
        source: "Google",
        url: googleUrl,
        rating: typeof p.rating === "number" ? p.rating : null,
        count: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
        snippets: reviews.slice(0, 5).map((r) => ({
          text: r.text?.text ?? "",
          rating: typeof r.rating === "number" ? r.rating : null,
        })).filter((s) => s.text),
      };
      return {
        name: p.displayName?.text ?? "Unknown",
        company: p.displayName?.text ?? null,
        phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
        email: null,
        area_covered: p.formattedAddress ?? null,
        website: p.websiteUri ?? null,
        specialities: (p.types ?? []).filter((t: string) => !["point_of_interest", "establishment"].includes(t)),
        rating: typeof p.rating === "number" ? p.rating : null,
        review_count: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
        social_presence_score: null,
        sources: { google: { placeId: p.id, url: googleUrl } },
        reviewSnippets: snippets,
        reviewBreakdown: [googleBreakdown],
      };
    });
}

async function firecrawlEnrich(candidate: Candidate, trade: string, town: string): Promise<void> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return;
  try {
    const { default: Firecrawl } = await import("@mendable/firecrawl-js");
    const fc = new Firecrawl({ apiKey });
    const q = `${candidate.company ?? candidate.name} ${trade} ${town} reviews`;
    const result = await fc.search(q, { limit: 4, scrapeOptions: { formats: ["markdown"] } } as any);
    const items: Array<{ url?: string; title?: string; description?: string; markdown?: string }> =
      (result as any)?.web ?? (result as any)?.data ?? [];

    const extraSnippets: string[] = [];
    const extraSources: Record<string, unknown> = {};
    let social = 0;
    const perPlatformCounts: Record<string, number> = {};
    // Track best scraped page per platform so we can do a targeted scrape next
    const reviewPlatformUrls = new Map<string, string>();

    const nameTokens = (candidate.company ?? candidate.name)
      .toLowerCase()
      .replace(/\b(ltd|limited|llp|services|builders?|construction|company|co)\b/g, " ")
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3);
    const phoneDigits = (candidate.phone ?? "").replace(/\D/g, "");
    const phoneTail = phoneDigits.slice(-7); // last 7 digits — robust to formatting

    /** Page must clearly reference THIS tradesman before we trust its review numbers. */
    function pageMatchesCandidate(text: string): boolean {
      const low = text.toLowerCase();
      if (phoneTail && phoneTail.length >= 6 && low.replace(/\D/g, "").includes(phoneTail)) {
        return true;
      }
      if (!nameTokens.length) return false;
      const hits = nameTokens.filter((t) => low.includes(t)).length;
      // Require either every token (short names) or at least 2 distinctive tokens.
      return nameTokens.length <= 2 ? hits === nameTokens.length : hits >= 2;
    }

    for (const item of items.slice(0, 4)) {
      const url = item.url ?? "";
      const text = (item.markdown ?? item.description ?? "").slice(0, 1200);
      if (!text) continue;
      if (/checkatrade|ratedpeople|trustpilot|yell/i.test(url)) {
        const host = new URL(url).hostname;
        // Only trust snippet counts when the snippet clearly refers to this tradesman —
        // category/landing pages list aggregate totals across many traders.
        const matched = pageMatchesCandidate(text);
        const count = matched ? extractReviewCount(text) : null;
        extraSources[host] = {
          url,
          snippet: text.slice(0, 400),
          reviewCount: count ?? undefined,
          matched,
        };
        if (count != null) {
          perPlatformCounts[host] = Math.max(perPlatformCounts[host] ?? 0, count);
        }
        if (!reviewPlatformUrls.has(host)) reviewPlatformUrls.set(host, url);
        extraSnippets.push(`[${new URL(url).hostname}] ${text.slice(0, 600)}`);
      }
      if (/facebook\.com|instagram\.com/i.test(url)) {
        social += 1;
        extraSources[new URL(url).hostname] = { url };
      }
    }

    // Targeted scrape of each platform page (search descriptions are often blocked/landing pages)
    await Promise.all(
      Array.from(reviewPlatformUrls.entries()).map(async ([host, url]) => {
        try {
          const scraped: any = await fc.scrape(url, { formats: ["markdown"], onlyMainContent: true } as any);
          const md: string = scraped?.markdown ?? scraped?.data?.markdown ?? "";
          if (!md) return;
          const matched = pageMatchesCandidate(md);
          const count = matched ? extractReviewCount(md) : null;
          const rating = matched ? extractRating(md) : null;
          if (count != null) perPlatformCounts[host] = Math.max(perPlatformCounts[host] ?? 0, count);
          const existing = (extraSources[host] as any) ?? { url };
          extraSources[host] = {
            ...existing,
            url,
            reviewCount: matched ? (perPlatformCounts[host] ?? existing.reviewCount) : undefined,
            rating: matched ? (rating ?? existing.rating) : undefined,
            snippet: md.slice(0, 600),
            matched,
          };
          // Only surface this source in the breakdown when we're confident it's the right tradesman.
          if (matched) {
            const lines = md
              .split(/\n+/)
              .map((l) => l.trim())
              .filter((l) => l.length > 40 && l.length < 400);
            const sampled = lines.slice(0, 3);
            candidate.reviewBreakdown.push({
              source: host.replace(/^www\./, ""),
              url,
              rating: rating ?? null,
              count: perPlatformCounts[host] ?? null,
              snippets: sampled.map((t) => ({ text: t, rating: null })),
            });
          }
        } catch (err) {
          console.warn("Targeted scrape failed for", host, err);
        }
      }),
    );

    candidate.reviewSnippets.push(...extraSnippets);
    candidate.sources = { ...candidate.sources, ...extraSources };
    candidate.social_presence_score = social;

    // Only aggregate counts from platforms we verified matched this tradesman.
    // If nothing matched, leave review_count as Google's authoritative number.
    const extraReviewTotal = Object.values(perPlatformCounts).reduce((a, b) => a + b, 0);
    if (extraReviewTotal > 0) {
      candidate.review_count = (candidate.review_count ?? 0) + extraReviewTotal;
    }
  } catch (err) {
    console.error("Firecrawl enrich failed", err);
  }
}

/**
 * Pull a review count from scraped page text. Matches patterns like
 * "1,234 reviews", "Based on 87 reviews", "(245)", "Reviews (312)".
 * Returns the largest plausible number to avoid picking up unrelated digits.
 */
function extractReviewCount(text: string): number | null {
  const candidates: number[] = [];
  const patterns = [
    /([\d,]{1,7})\s+reviews?\b/gi,
    /\bbased on\s+([\d,]{1,7})\s+reviews?\b/gi,
    /\breviews?\s*[:\(]\s*([\d,]{1,7})/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const n = parseInt(m[1].replace(/,/g, ""), 10);
      if (Number.isFinite(n) && n > 0 && n < 1_000_000) candidates.push(n);
    }
  }
  if (!candidates.length) return null;
  return Math.max(...candidates);
}

/** Extract a 0-5 rating from page text (e.g. "Rated 4.8 out of 5", "4.9/5"). */
function extractRating(text: string): number | null {
  const candidates: number[] = [];
  const patterns = [
    /\b([0-5](?:\.\d)?)\s*\/\s*5\b/gi,
    /\brated\s+([0-5](?:\.\d)?)\s*(?:out of|\/)?\s*5\b/gi,
    /\b([0-5](?:\.\d)?)\s+out of\s+5\b/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const n = parseFloat(m[1]);
      if (Number.isFinite(n) && n > 0 && n <= 5) candidates.push(n);
    }
  }
  if (!candidates.length) return null;
  // Median-ish: just take the highest plausible mention (avoids "0.0 out of 5" placeholders)
  return Math.max(...candidates);
}

async function senseCheck(candidate: Candidate): Promise<{
  verdict: "clean" | "mixed" | "flagged";
  complaintSummary: string;
  redFlags: string[];
  positiveSignals: string[];
} | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;

  const snippetsText = candidate.reviewSnippets.slice(0, 12).join("\n---\n").slice(0, 6000);
  const prompt = `Tradesman: ${candidate.name}${candidate.company ? ` (${candidate.company})` : ""}
Rating: ${candidate.rating ?? "n/a"} from ${candidate.review_count ?? 0} reviews.
Review and web snippets:
${snippetsText || "(none)"}

Look for: recurring no-show/late complaints, unpaid-work disputes, scam flags, fake-review bursts, unresolved 1-2★ patterns. Be conservative — only flag with real evidence.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You audit tradesman reputations. Return strict JSON via the provided tool." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report",
              description: "Report sense-check result",
              parameters: {
                type: "object",
                properties: {
                  verdict: { type: "string", enum: ["clean", "mixed", "flagged"] },
                  complaintSummary: { type: "string" },
                  redFlags: { type: "array", items: { type: "string" } },
                  positiveSignals: { type: "array", items: { type: "string" } },
                },
                required: ["verdict", "complaintSummary", "redFlags", "positiveSignals"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report" } },
      }),
    });
    if (!res.ok) {
      console.error("AI sense-check failed", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json = await res.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return null;
    return JSON.parse(args);
  } catch (err) {
    console.error("Sense check error", err);
    return null;
  }
}

function rank(c: Candidate, verdict: "clean" | "mixed" | "flagged" | null): number {
  const rating = c.rating ?? 0;
  const reviews = c.review_count ?? 0;
  const social = c.social_presence_score ?? 0;
  const penalty = verdict === "flagged" ? 5 : verdict === "mixed" ? 1.5 : 0;
  return rating * Math.log10(reviews + 1) + social * 0.5 - penalty;
}

export const searchTradesmen = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SearchInput.parse(d))
  .handler(async ({ data }) => {
    const town = normaliseTown(data.town);
    const trade = data.trade.trim();
    const query = `${trade} in ${town}`;

    const placesCandidates = await searchGooglePlaces(query);
    if (placesCandidates.length === 0) {
      return { inserted: 0, message: "No tradesmen found on Google for that area." };
    }

    // Dedupe
    const seen = new Map<string, Candidate>();
    for (const c of placesCandidates) {
      const k = normaliseKey(c.name, c.phone);
      if (!seen.has(k)) seen.set(k, c);
    }
    const candidates = Array.from(seen.values()).slice(0, 12);

    // Enrich + sense-check in parallel (bounded)
    await Promise.all(
      candidates.map(async (c) => {
        await firecrawlEnrich(c, trade, town);
      }),
    );
    const senseResults = await Promise.all(candidates.map((c) => senseCheck(c)));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const rows = candidates.map((c, i) => {
      const sense = senseResults[i];
      const score = rank(c, sense?.verdict ?? null);
      return {
        name: c.name,
        company: c.company,
        phone: c.phone,
        email: c.email,
        area_covered: c.area_covered,
        website: c.website,
        specialities: c.specialities.length ? c.specialities : [trade],
        sources: c.sources as any,
        rating: c.rating,
        review_count: c.review_count,
        social_presence_score: c.social_presence_score,
        sense_check: sense as any,
        review_breakdown: c.reviewBreakdown as any,
        score,
        status: "pending" as const,
        search_query: query,
      };
    });

    const { error } = await supabaseAdmin.from("tradesmen_candidates").insert(rows);
    if (error) throw new Error(error.message);

    return { inserted: rows.length, message: `Found ${rows.length} candidates for "${query}".` };
  });

export const resetReviewQueue = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error, count } = await supabaseAdmin
      .from("tradesmen_candidates")
      .update({ status: "dismissed" }, { count: "exact" })
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true, dismissed: count ?? 0 };
  });

export const approveCandidate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cand, error: cErr } = await supabaseAdmin
      .from("tradesmen_candidates")
      .select("*")
      .eq("id", data.id)
      .single();
    if (cErr || !cand) throw new Error(cErr?.message ?? "Not found");

    const { data: inserted, error: iErr } = await supabaseAdmin
      .from("tradesmen")
      .insert({
        name: cand.name,
        company: cand.company,
        phone: cand.phone,
        email: cand.email,
        area_covered: cand.area_covered,
        specialities: cand.specialities ?? [],
        notes: cand.sense_check
          ? `Sense check: ${(cand.sense_check as any).verdict}. ${(cand.sense_check as any).complaintSummary ?? ""}`
          : null,
      })
      .select("id")
      .single();
    if (iErr || !inserted) throw new Error(iErr?.message ?? "Insert failed");

    await supabaseAdmin
      .from("tradesmen_candidates")
      .update({ status: "approved", approved_tradesman_id: inserted.id })
      .eq("id", data.id);

    return { ok: true, tradesmanId: inserted.id };
  });

export const dismissCandidate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("tradesmen_candidates")
      .update({ status: "dismissed" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCandidates = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("tradesmen_candidates")
      .select("*")
      .eq("status", "pending")
      .order("score", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });