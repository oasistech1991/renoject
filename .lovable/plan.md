## Make Hartstone Holdings findable on ChatGPT, Perplexity, Claude & Gemini

### 1. Explicitly allow AI crawlers in `public/robots.txt`
Keep the existing `User-agent: *` + sitemap block, and add allow-blocks for:
- `GPTBot`, `OAI-SearchBot`, `ChatGPT-User` (OpenAI / ChatGPT)
- `PerplexityBot`, `Perplexity-User` (Perplexity)
- `ClaudeBot`, `Claude-Web`, `anthropic-ai` (Anthropic)
- `Google-Extended` (Gemini)
- `Applebot-Extended` (Apple Intelligence)
- `CCBot` (Common Crawl — feeds many LLMs)
- `Bytespider`, `Meta-ExternalAgent`, `Amazonbot`

### 2. Add `public/llms.txt`
A markdown summary of Hartstone Holdings for LLM ingestion. Structure:
- H1: Hartstone Holdings
- Blockquote: one-line summary (UK property investment toolkit)
- Short description paragraph
- `## Tools` — link list to each public tool page (Property Calculator, Renovation Calculator, HMO Compliance, Market Search, View Deals, Forecast, Tradesmen, Tokenize)
- `## Pricing & Account` — pricing
- `## Optional` — legal pages (terms, privacy, refund policy)

Excludes auth, admin, account, and API routes.

### 3. Strengthen JSON-LD structured data
- In `src/routes/__root.tsx`: add a `WebSite` schema with `potentialAction` `SearchAction` alongside the existing `Organization`.
- In each tool route's `head().scripts`: add a `SoftwareApplication` (or `Service`) JSON-LD block with name, description, applicationCategory `"FinanceApplication"`, and offer (£1/month).
- In `src/routes/pricing.tsx`: add an `Offer` / `Product` schema.

### 4. Audit and tighten per-page meta
Sweep all public route files and ensure each has a specific, keyword-rich `title` + `description` + `og:title` + `og:description` (e.g. "UK BTL & BRRR Property Investment Calculator", "HMO Floorplan Compliance Checker — UK Licensing Rules"). Routes to audit: `/`, `/refinance`, `/condition`, `/hmo-compliance`, `/market`, `/properties`, `/forecast`, `/tradesmen`, `/tokenize`, `/pricing`.

### 5. Submit to Bing Webmaster Tools (instructions only — no code)
ChatGPT Search and Copilot pull from Bing's index. I'll include a short closing checklist for the user:
- Register at bing.com/webmasters
- Import from Google Search Console (one click)
- Submit `https://hartstoneholdings.com/sitemap.xml`

### 6. Confirm Google Search Console submission (instructions only)
Already have `sitemap.xml` + `robots.txt`. Closing checklist will remind the user to submit the sitemap in GSC if not done.

### Technical notes
- All changes are additive — no existing meta/JSON-LD is removed.
- `robots.txt` and `llms.txt` are static files in `public/`; deployed instantly with the next publish.
- JSON-LD goes in route `head().scripts` per the TanStack head pattern; canonical/og:url tags already added in the previous SEO pass are untouched.

### Files to be edited/created
- `public/robots.txt` (edit — append AI crawler allow blocks)
- `public/llms.txt` (create)
- `src/routes/__root.tsx` (add WebSite + SearchAction JSON-LD)
- `src/routes/refinance.tsx`, `condition.tsx`, `hmo-compliance.tsx`, `market.tsx`, `properties.tsx`, `forecast.tsx`, `tradesmen.tsx`, `tokenize.tsx`, `pricing.tsx`, `index.tsx` (tighten titles/descriptions where weak; add per-tool JSON-LD)
