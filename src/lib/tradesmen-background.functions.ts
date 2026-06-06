import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ id: z.string().uuid() });

const CH_BASE = "https://find-and-update.company-information.service.gov.uk";

type CHHit = {
  company_name: string;
  company_number: string;
  company_status: string;
  address: string | null;
  incorporated_on: string | null;
  url: string;
};

type CHOfficer = {
  name: string;
  role: string | null;
  appointed_on: string | null;
  resigned_on: string | null;
  appointments_url: string | null;
};

type CHAppointment = {
  company_name: string;
  company_number: string;
  status: string; // active | dissolved | resigned | liquidation | open | closed
  role: string | null;
  appointed_on: string | null;
  resigned_on: string | null;
};

type WebMention = {
  url: string;
  title: string | null;
  snippet: string;
};

async function fcScrapeMarkdown(fc: any, url: string): Promise<string> {
  try {
    const r: any = await fc.scrape(url, { formats: ["markdown"], onlyMainContent: true } as any);
    return r?.markdown ?? r?.data?.markdown ?? "";
  } catch (err) {
    console.warn("Firecrawl scrape failed", url, err);
    return "";
  }
}

/** Parse Companies House search results page into top hits. */
function parseSearchResults(md: string, limit = 5): CHHit[] {
  const hits: CHHit[] = [];
  // Markdown links to /company/{number}
  const linkRe = /\[([^\]]+)\]\((\/company\/(\d{6,10}|[A-Z]{2}\d{6,8}|[A-Z]{2}\d{6}[A-Z])(?:[\/?#][^\)]*)?)\)/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(md)) !== null) {
    const name = m[1].trim();
    const number = m[3];
    if (seen.has(number)) continue;
    if (!name || /^view\b|^next\b|^previous\b|filter/i.test(name)) continue;
    seen.add(number);

    // Look ~400 chars after the link for status / address
    const tail = md.slice(m.index, m.index + 600);
    const statusMatch = tail.match(/\b(Active|Dissolved|Liquidation|In Administration|Open|Closed|Voluntary Arrangement)\b/i);
    const incMatch = tail.match(/Incorporated on\s*([0-9]{1,2}\s+\w+\s+\d{4})/i);
    const addrMatch = tail.match(/\n\s*([A-Z0-9][^\n]{10,120})\n/);

    hits.push({
      company_name: name,
      company_number: number,
      company_status: (statusMatch?.[1] ?? "unknown").toLowerCase(),
      address: addrMatch?.[1]?.trim() ?? null,
      incorporated_on: incMatch?.[1] ?? null,
      url: `${CH_BASE}/company/${number}`,
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

/** Extract officer summaries from the company officers page. */
function parseOfficers(md: string, limit = 6): CHOfficer[] {
  const officers: CHOfficer[] = [];
  // Officers usually appear as `[NAME, Title](/officers/{id}/appointments)`
  const re = /\[([^\]]+)\]\((\/officers\/([A-Za-z0-9_-]+)\/appointments)\)/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const label = m[1].trim();
    const path = m[2];
    if (seen.has(path)) continue;
    seen.add(path);

    const tail = md.slice(m.index, m.index + 600);
    const roleMatch = tail.match(/Role\s*\n?\s*([A-Za-z][A-Za-z \-]+)/);
    const appMatch = tail.match(/Appointed on\s*([0-9]{1,2}\s+\w+\s+\d{4})/i);
    const resMatch = tail.match(/Resigned on\s*([0-9]{1,2}\s+\w+\s+\d{4})/i);

    officers.push({
      name: label,
      role: roleMatch?.[1]?.trim() ?? null,
      appointed_on: appMatch?.[1] ?? null,
      resigned_on: resMatch?.[1] ?? null,
      appointments_url: `${CH_BASE}${path}`,
    });
    if (officers.length >= limit) break;
  }
  return officers;
}

/** Extract director's other appointments from their appointments page. */
function parseAppointments(md: string, limit = 40): CHAppointment[] {
  const apps: CHAppointment[] = [];
  const re = /\[([^\]]+)\]\((\/company\/(\d{6,10}|[A-Z]{2}\d{6,8}|[A-Z]{2}\d{6}[A-Z]))\)/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const company_name = m[1].trim();
    const company_number = m[3];
    if (seen.has(company_number)) continue;
    if (!company_name) continue;
    seen.add(company_number);

    const tail = md.slice(m.index, m.index + 700);
    const statusMatch = tail.match(/Status\s*\n?\s*-?\s*(Active|Dissolved|Liquidation|In Administration|Resigned|Open|Closed|Voluntary Arrangement)/i);
    const roleMatch = tail.match(/(?:Role|Position)\s*\n?\s*-?\s*([A-Za-z][A-Za-z \-]+)/i);
    const appMatch = tail.match(/Appointed on\s*\n?\s*-?\s*([0-9]{1,2}\s+\w+\s+\d{4})/i);
    const resMatch = tail.match(/Resigned on\s*\n?\s*-?\s*([0-9]{1,2}\s+\w+\s+\d{4})/i);

    apps.push({
      company_name,
      company_number,
      status: (statusMatch?.[1] ?? "unknown").toLowerCase(),
      role: roleMatch?.[1]?.trim() ?? null,
      appointed_on: appMatch?.[1] ?? null,
      resigned_on: resMatch?.[1] ?? null,
    });
    if (apps.length >= limit) break;
  }
  return apps;
}

/** Score a hit against the candidate's name + town to pick the best match. */
function scoreHit(hit: CHHit, name: string, town: string | null): number {
  const norm = (s: string) =>
    s.toLowerCase().replace(/\b(ltd|limited|llp|services|the|and|&)\b/g, " ").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const a = new Set(norm(hit.company_name));
  const b = new Set(norm(name));
  let overlap = 0;
  b.forEach((t) => { if (a.has(t)) overlap += 1; });
  let score = overlap / Math.max(1, b.size);
  if (town && hit.address && hit.address.toLowerCase().includes(town.toLowerCase())) score += 0.4;
  if (hit.company_status === "active") score += 0.2;
  if (hit.company_status === "dissolved") score -= 0.3;
  return score;
}

function extractTown(area: string | null): string | null {
  if (!area) return null;
  const parts = area.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 2].replace(/\s+[A-Z]{1,2}\d.*$/, "").trim() || null;
  }
  return parts[0] ?? null;
}

export const runBackgroundCheck = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cand, error: cErr } = await supabaseAdmin
      .from("tradesmen_candidates")
      .select("id,name,company,area_covered,phone,website")
      .eq("id", data.id)
      .single();
    if (cErr || !cand) throw new Error(cErr?.message ?? "Candidate not found");

    const fcKey = process.env.FIRECRAWL_API_KEY;
    if (!fcKey) throw new Error("Web scraping is not configured (FIRECRAWL_API_KEY missing)");
    const { default: Firecrawl } = await import("@mendable/firecrawl-js");
    const fc = new Firecrawl({ apiKey: fcKey });

    const queryName = (cand.company ?? cand.name ?? "").trim();
    if (!queryName) throw new Error("Candidate has no company or name to search");
    const town = extractTown(cand.area_covered);

    // 1) Companies House search
    const searchUrl = `${CH_BASE}/search/companies?q=${encodeURIComponent(queryName)}`;
    const searchMd = await fcScrapeMarkdown(fc, searchUrl);
    const hits = parseSearchResults(searchMd, 8);
    let bestHit: CHHit | null = null;
    if (hits.length) {
      const scored = hits.map((h) => ({ h, s: scoreHit(h, queryName, town) }))
        .sort((a, b) => b.s - a.s);
      // Only accept if the top match has decent name overlap
      if (scored[0].s >= 0.4) bestHit = scored[0].h;
    }

    let companyProfileMd = "";
    let officers: CHOfficer[] = [];
    const directorReports: Array<{
      officer: CHOfficer;
      total: number;
      active: number;
      dissolved: number;
      resigned: number;
      liquidation: number;
      appointments: CHAppointment[];
    }> = [];

    if (bestHit) {
      // 2) Company profile + officers in parallel
      const [profileMd, officersMd] = await Promise.all([
        fcScrapeMarkdown(fc, bestHit.url),
        fcScrapeMarkdown(fc, `${bestHit.url}/officers`),
      ]);
      companyProfileMd = profileMd;
      officers = parseOfficers(officersMd, 5);

      // 3) For each (active) director, fetch appointments
      const activeOfficers = officers.filter((o) => !o.resigned_on).slice(0, 3);
      const apptResults = await Promise.all(
        activeOfficers.map(async (o) => {
          if (!o.appointments_url) return null;
          const md = await fcScrapeMarkdown(fc, o.appointments_url);
          const apps = parseAppointments(md, 40);
          const tally = apps.reduce(
            (acc, a) => {
              acc.total += 1;
              if (a.status === "active" || a.status === "open") acc.active += 1;
              else if (a.status === "dissolved" || a.status === "closed") acc.dissolved += 1;
              else if (a.status === "resigned") acc.resigned += 1;
              else if (a.status === "liquidation" || a.status === "in administration") acc.liquidation += 1;
              return acc;
            },
            { total: 0, active: 0, dissolved: 0, resigned: 0, liquidation: 0 },
          );
          return { officer: o, ...tally, appointments: apps.slice(0, 12) };
        }),
      );
      for (const r of apptResults) if (r) directorReports.push(r);
    }

    // 4) Web reputation search (CCJ / complaints)
    const reputationMentions: WebMention[] = [];
    try {
      const queries = [
        `"${queryName}" CCJ`,
        `"${queryName}" complaints OR scam OR dispute`,
      ];
      const searches = await Promise.all(
        queries.map((q) =>
          fc.search(q, { limit: 4 } as any).catch((err: unknown) => {
            console.warn("Firecrawl search failed", q, err);
            return null;
          }),
        ),
      );
      for (const r of searches) {
        if (!r) continue;
        const items: Array<{ url?: string; title?: string; description?: string }> =
          (r as any)?.web ?? (r as any)?.data ?? [];
        for (const it of items.slice(0, 4)) {
          if (!it.url) continue;
          reputationMentions.push({
            url: it.url,
            title: it.title ?? null,
            snippet: (it.description ?? "").slice(0, 300),
          });
        }
      }
    } catch (err) {
      console.warn("Reputation search error", err);
    }

    // 5) AI synthesis
    const lovableKey = process.env.LOVABLE_API_KEY;
    let ai: {
      verdict: "clean" | "watch" | "flagged";
      summary: string;
      riskSignals: string[];
      positiveSignals: string[];
      directorFlags: string[];
    } | null = null;

    if (lovableKey) {
      const payload = {
        candidate: { name: cand.name, company: cand.company, area_covered: cand.area_covered },
        companies_house: bestHit
          ? {
              match: bestHit,
              profile_excerpt: companyProfileMd.slice(0, 2000),
              officers,
              director_reports: directorReports.map((d) => ({
                name: d.officer.name,
                role: d.officer.role,
                appointed_on: d.officer.appointed_on,
                appointments: { total: d.total, active: d.active, dissolved: d.dissolved, resigned: d.resigned, liquidation: d.liquidation },
                examples: d.appointments.slice(0, 8).map((a) => ({ company: a.company_name, status: a.status, role: a.role })),
              })),
            }
          : { match: null, note: "No Companies House match found." },
        web_mentions: reputationMentions.slice(0, 10),
      };
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "You are a due-diligence analyst on UK construction trades. Be conservative — flag only with real evidence. Return strict JSON via the provided tool." },
              { role: "user", content: `Analyse this tradesman background data and return a verdict.\n\n${JSON.stringify(payload).slice(0, 12000)}` },
            ],
            tools: [{
              type: "function",
              function: {
                name: "verdict",
                description: "Background check verdict",
                parameters: {
                  type: "object",
                  properties: {
                    verdict: { type: "string", enum: ["clean", "watch", "flagged"] },
                    summary: { type: "string" },
                    riskSignals: { type: "array", items: { type: "string" } },
                    positiveSignals: { type: "array", items: { type: "string" } },
                    directorFlags: { type: "array", items: { type: "string" } },
                  },
                  required: ["verdict", "summary", "riskSignals", "positiveSignals", "directorFlags"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "verdict" } },
          }),
        });
        if (res.ok) {
          const j = await res.json();
          const args = j?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
          if (args) ai = JSON.parse(args);
        } else {
          console.error("AI background synthesis failed", res.status, await res.text().catch(() => ""));
        }
      } catch (err) {
        console.error("AI background synthesis error", err);
      }
    }

    const report = {
      company_match: bestHit,
      officers,
      director_reports: directorReports.map((d) => ({
        name: d.officer.name,
        role: d.officer.role,
        appointed_on: d.officer.appointed_on,
        appointments_url: d.officer.appointments_url,
        counts: { total: d.total, active: d.active, dissolved: d.dissolved, resigned: d.resigned, liquidation: d.liquidation },
        examples: d.appointments.slice(0, 8),
      })),
      web_mentions: reputationMentions,
      ai,
      checked_at: new Date().toISOString(),
      disclaimer: "Public web mentions only — not an official CCJ register check.",
    };

    const { error: uErr } = await supabaseAdmin
      .from("tradesmen_candidates")
      .update({ background_check: report as any, background_checked_at: report.checked_at })
      .eq("id", data.id);
    if (uErr) throw new Error(uErr.message);

    return report;
  });