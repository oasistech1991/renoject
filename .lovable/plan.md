## Redesign: Slate Dashboard Workspace

Implement the chosen "Slate Dashboard Workspace" direction across the app shell and homepage. Composition, density, sectioning, and tokens are taken verbatim from the selected prototype — no re-derivation.

### Locked design tokens (used everywhere, no drift)
- Surface: `#2d3748` (bg), `#4a5568` (panel/borders), `#718096` (muted), `#a0aec0` (text-muted / accent), white (foreground).
- Heading font: **Sora** (600/700). Body font: **Manrope** (400/500/600).
- Light mode kept consistent — same hierarchy mapped onto neutral whites/greys so the dashboard reads identically in both themes.

### 1. Design tokens — `src/styles.css`
- Add `--font-display: "Sora"` and `--font-sans: "Manrope"` under `@theme`.
- Rewrite the dark theme block to map shadcn tokens onto Slate & Steel:
  - `--background: #2d3748`, `--card: #4a5568` at 40% over bg, `--border: #4a5568`, `--muted: #718096`, `--muted-foreground: #a0aec0`, `--primary: #ffffff` (button fill), `--primary-foreground: #2d3748`, `--accent: #a0aec0`.
- Light mode: invert (white/slate-50 bg, slate-700 text) so the same component classes work.

### 2. Web fonts
- `bun add @fontsource/sora @fontsource/manrope`.
- Import the weight files (Sora 600/700, Manrope 400/500/600) in `src/main.tsx` (or the equivalent entry — verify before editing).

### 3. App shell — `src/routes/__root.tsx`
- Replace the current top-nav header with a two-pane layout: persistent **left sidebar** (264px) + main column with a sticky **cockpit header** + `<Outlet />`.
- Sidebar (shadcn `Sidebar` with `collapsible="icon"`):
  - Brand block at top: slate square mark + "HARTSTONE HOLDINGS" in Sora.
  - Active item: "Home". Section label "Tools" then: Calculators, Market Deals, Compliance, Pricing (route to existing pages — Calculators → `/refinance`, Market Deals → `/market`, Compliance → `/hmo-compliance`, Pricing → `/pricing`). Account, Auth, Forecast, etc. remain accessible via the home grid; sidebar stays lean.
  - Footer: avatar circle + email + Sign out (mirrors current auth state — wire to existing supabase signOut).
- Cockpit header: breadcrumb ("Dashboard / Overview"), right side Sign in + Get Started (or account chip when logged in).
- Mobile: sidebar collapses to off-canvas via `SidebarTrigger` placed in the header.
- Preserve all existing `head()` metadata, JSON-LD scripts, `<Outlet />`, and the SEO work already shipped.

### 4. Homepage — `src/routes/index.tsx`
Match the prototype composition exactly:
- **Hero panel**: rounded-2xl card (`bg-[#4a5568]/20 border border-[#4a5568]`), p-10. Inside: pulsing dot eyebrow chip "HARTSTONE HOLDINGS", H1 in Sora (`text-4xl lg:text-5xl`) with the word "serious" tinted `#a0aec0`, body paragraph, two CTAs (white pill "Open Property Calculator" with arrow → `/refinance`; outlined "See pricing" → `/pricing`).
- **Tools section header**: "Explore the tools" + "Jump straight into any workflow."
- **Grid**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4` — exactly 8 cards in this order: Property Calculator (FREE badge), Renovation Calculator, Market Search, View Deals, Forecast, HMO Compliance, Tradesmen, Tokenize.
- **Card pattern**: `bg-[#4a5568]/40 border border-[#718096]/30 p-5 rounded-xl hover:bg-[#4a5568] hover:border-[#a0aec0]`. Inside: small icon tile (`p-2 bg-[#2d3748] rounded-lg`, white lucide icon, `group-hover:scale-110`) + optional FREE chip on the first card. Title in Sora bold (`text-sm`), description `text-xs opacity-70`. Whole card is a `<Link>`.
- Drop the current full-bleed hero radial gradient and the existing 3-col card grid.

### 5. Motion register (subtle only)
- Sidebar item hover: bg fade to `#4a5568`.
- Tool card hover: border brightens to `#a0aec0`, icon tile scales 1.1, 200ms transition.
- Eyebrow dot: `animate-pulse`.
- No parallax, no scroll-jacks.

### 6. Out of scope (this pass)
- Tool pages (`/refinance`, `/market`, etc.) keep current internals — only their wrapping shell changes via `__root.tsx`.
- No content/IA changes, no copy rewrites beyond what the prototype already shows.
- Existing auth flow, paywall gate, SEO metadata, JSON-LD, sitemap, robots, llms.txt remain untouched.

### Files to edit
- `src/styles.css` — tokens + font families
- `src/main.tsx` — fontsource imports (verify path first)
- `src/routes/__root.tsx` — replace header with SidebarProvider + AppSidebar + cockpit header (preserve head/scripts/Outlet)
- `src/components/app-sidebar.tsx` — **new**, holds the sidebar definition
- `src/routes/index.tsx` — new hero panel + 4-col tools grid

### Acceptance check
- Homepage at desktop (≥1024px) matches the chosen prototype: left rail, cockpit header, single hero panel, 4×2 tool grid, all 8 tools present, FREE badge on Property Calculator.
- Sora visible on H1 + section titles; Manrope visible everywhere else.
- Sidebar collapses on mobile via header trigger.
- All existing routes still reachable and SEO meta unchanged.
