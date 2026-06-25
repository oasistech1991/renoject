// Lightweight Firecrawl REST client. Avoids @mendable/firecrawl-js which pulls
// in `undici` and breaks the Cloudflare Worker SSR build.

const BASE = "https://api.firecrawl.dev/v1";

async function call(apiKey: string, path: string, body: unknown): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Firecrawl ${path} failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  const json: any = await res.json().catch(() => ({}));
  return json?.data ?? json;
}

export function createFirecrawl(apiKey: string) {
  return {
    async scrape(url: string, opts: Record<string, unknown> = {}) {
      return call(apiKey, "/scrape", { url, ...opts });
    },
    async search(query: string, opts: Record<string, unknown> = {}) {
      return call(apiKey, "/search", { query, ...opts });
    },
  };
}

export type FirecrawlClient = ReturnType<typeof createFirecrawl>;