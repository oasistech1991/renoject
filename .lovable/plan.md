# Visual refresh — Brick & Sage palette

Add color and visual depth across Hartstone Holdings using the chosen Brick & Sage palette, at a medium intensity (3/5). **No functionality changes** — only tokens, styling, and presentational elements.

## Palette tokens

Define in `src/styles.css` (oklch) for both light and dark modes:

- `--background` — warm cream `#fdf8f5` (dark: deep charcoal `#1a1614`)
- `--foreground` — near-black `#2a2a2a`
- `--primary` — brick red `#b91c1c` (CTAs, key accents)
- `--primary-foreground` — cream
- `--secondary` — sage `#7d9b76` (secondary actions, positive metrics)
- `--accent` — soft sage tint for hover/highlights
- `--muted` — warm beige
- `--border` — warm taupe
- `--ring` — brick red at lower chroma
- New gradient tokens: `--gradient-hero` (cream → faint brick), `--gradient-brick` (brick → deeper brick), `--gradient-sage` (sage tints)
- New shadow tokens: `--shadow-warm` (brick-tinted soft shadow), `--shadow-elegant`
- Chart colors retuned: brick, sage, warm gold, taupe, deep navy

## Scope of visual changes (presentational only)

**1. Landing / home page (`src/routes/index.tsx`)**
- Hero: apply `--gradient-hero` background, brick accent on headline keyword, sage on subtle highlight
- Feature/tool cards: warm shadow, brick-tinted hover border, sage icon accents
- Section dividers and CTAs use new tokens

**2. Navigation & headers (`src/routes/__root.tsx`, nav components)**
- Top nav: cream background with subtle warm border, brick active-tab underline, sage hover
- Active route indicator switches from neutral to brick

**3. Cards, buttons & metrics (shared components)**
- `MetricCard`: tone="positive" → sage; tone="accent" → brick; warm border on hover
- Button variants already use `--primary` / `--secondary` — they inherit automatically
- Add an optional `premium` button variant using `--gradient-brick` for primary CTAs on landing only (used sparingly)
- Badges and chips pick up new accent tints

**4. Dashboard & tool pages (calculator, forecast, market, properties, condition, hmo-compliance, refinance, tradesmen, tokenize, pricing)**
- Page headers: subtle warm gradient strip
- Result/summary panels: sage tint for positive results, brick for warnings/key numbers
- Tab indicators: brick underline
- Chart series in `ForecastCharts` and similar: brick + sage + warm gold

## What stays unchanged

- All routes, route paths, route logic
- All server functions, queries, auth, payments, Paddle integration
- All form inputs, calculations, business logic
- All component APIs (props, exports) — only internal class names/tokens change
- Tab structure, navigation behavior, deal forecast placement
- SEO meta, JSON-LD, robots.txt, llms.txt, sitemap

## Technical details

- All color values defined as `oklch()` in `:root` and `.dark` in `src/styles.css`
- All new tokens registered in `@theme inline` so Tailwind utilities like `bg-primary`, `text-secondary`, `border-accent` resolve correctly
- Components continue to use semantic classes (`bg-primary`, `text-muted-foreground`, etc.) — never raw hex
- One-pass edit across `src/styles.css`, `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/components/btl/MetricCard.tsx`, `src/components/forecast/ForecastCharts.tsx`, and light touches to tool page headers
- No new dependencies, no schema changes, no migrations

## Verification

After the edit: visit `/`, `/market`, `/forecast`, `/properties`, `/pricing` in preview to confirm cohesive Brick & Sage styling across light + dark modes, and that all interactive elements still work identically.
