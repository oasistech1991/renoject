## Market Search — new tab

A new **/market** route giving a Rightmove-style visual search experience tuned for property investors, with a paywalled "Expert Deal Review" feature.

### 1. Navigation
- Add **Market Search** link to the top nav in `src/routes/__root.tsx` (between HMO Compliance and Renovation Calculator).

### 2. Data (mock for now)
- New `src/lib/market-listings.ts` with ~60 seeded UK listings across mixed regions (Manchester, Liverpool, Sheffield, Birmingham, Leeds, NE).
- Each listing: id, address, postcode, lat/lng, price, beds, baths, propertyType (terraced/semi/detached/flat), tenure, sqft, EPC, listingType (sale/auction/repossession), guidePrice, daysOnMarket, photos, description, agent, sourceUrl.
- Derived investor metrics computed on the fly: gross yield (using regional avg room rent for HMO potential), estimated ROI, BMV % vs postcode median, Article 4 flag, HMO room potential (using same logic as hmo-compliance), refurb tier guess, GDV potential.
- Designed so a future swap to a real feed (PropertyData / saved Rightmove URLs) only replaces the loader.

### 3. Layout — Split map + list (`src/routes/market.tsx`)

```text
┌──────────────────────────────────────────────────────────────┐
│  Filter bar (sticky):  postcode · price · beds · type · …    │
│                        [Investor filters ▾]  [Saved searches]│
├───────────────────────────────┬──────────────────────────────┤
│                               │  ┌─ Card ────────────────┐   │
│                               │  │ photo · price · beds  │   │
│         MAP                   │  │ Yield 7.2% · BMV 12%  │   │
│   (markers colour-coded       │  │ HMO 5 rooms · Art.4 ✓ │   │
│    by yield / BMV)            │  │ [Save] [Analyse]      │   │
│                               │  └───────────────────────┘   │
│                               │   …list scrolls…             │
├───────────────────────────────┴──────────────────────────────┤
│  Analytics strip:  yield distribution · price vs sqft        │
│                    BMV heatmap by postcode · deals/week      │
└──────────────────────────────────────────────────────────────┘
```

- Map: Google Maps JS API via the Lovable-managed Google Maps connector (browser key). Custom markers coloured by gross yield (red→green). Click marker → highlights/scrolls list card; click card → pans map.
- List: virtualised card grid on the right, synced with map viewport ("Search this area" button when user pans).
- Selecting a card opens a slide-over panel with full photos, description, full metric breakdown, and CTAs: **Save to deals**, **Send to HMO analysis**, **Send to Property Calculator**, **Request Expert Review** (paywalled).

### 4. Filters (collapsible groups)
- **Basics**: postcode/town, min–max price, min beds, property type, tenure, EPC min.
- **HMO/BTL**: min gross yield %, min projected ROI %, min HMO rooms potential, Article 4 toggle (exclude/only).
- **Refurb/BMV**: min BMV % vs postcode median, condition tag (turnkey/light/heavy), max £/sqft, refinance uplift potential.
- **Auction/distressed**: listing type (sale/auction/repossession/probate), max guide price, auction date window.
- **Saved searches**: persisted to Supabase so users can revisit.

### 5. Analytics strip
- Yield distribution histogram across current results.
- BMV % heatmap by postcode (top 10 postcodes in results).
- Price/sqft scatter with the current selection highlighted.
- Counters: total matches, avg yield, avg BMV, # under-guide auction lots.
- All recompute on filter change.

### 6. Saved searches + watchlist
- New Supabase tables `saved_searches` (user_id, name, filters jsonb) and `market_watchlist` (user_id, listing_id, notes). RLS scoped to `auth.uid()`.
- "Save this search" button in the filter bar; saved searches appear in a dropdown.
- Watchlisted listings show a star in the list and a tab "Watchlist only".

### 7. Paywalled Expert Deal Review (£49 flat fee per deal)
- New table `expert_reviews` (id, user_id, listing_snapshot jsonb, status: pending_payment/paid/in_review/delivered, stripe_session_id, expert_notes text, deliverable_url, created_at).
- Flow:
  1. User clicks **Request Expert Review** on a listing or saved deal.
  2. Modal collects context (their goal, timeframe, finance status) and shows £49 fee.
  3. Stripe Checkout (Lovable built-in Stripe payments — `enable_stripe_payments`) opens; product created via `batch_create_product`.
  4. Webhook at `/api/public/stripe-webhook` marks review as `paid` and emails the operator (you) the full deal pack.
  5. Operator dashboard at `/expert-inbox` (gated by an `is_expert` flag in a `user_roles` table) lets the expert post written review + Calendly link → status `delivered`.
  6. User sees the review on a `/expert-reviews/:id` page.
- Until payment, only a teaser is shown ("Independent expert will assess deal viability, exit options, red flags — typically within 48h").

### 8. Send-to-existing-tools integrations
- "Analyse as HMO" → prefills `/hmo-compliance` with address + room count guess via query params.
- "Run Property Calculator" → prefills `/refinance` with price, rent estimate, postcode.
- "Save as deal" → existing `properties` table insert, with `source: 'market-search'`.

### 9. Technical notes
- Route: `src/routes/market.tsx` (TanStack file route, SSR on — public-friendly).
- Listings loaded via `createServerFn` `searchListings` (filters in input validator). For now reads from mock; swap-point documented.
- Google Maps: use `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` (will prompt to link the Google Maps connector during build).
- Charts: existing Recharts (already in deps via shadcn `chart`).
- Stripe: `enable_stripe_payments` tool call during build (will require Pro plan confirmation). Webhook under `src/routes/api/public/stripe-webhook.ts`.
- Auth: existing session unlock (`hh_unlocked`) gates the page; expert inbox additionally checks a server-validated role.

### 10. Build order
1. Migrations: `saved_searches`, `market_watchlist`, `expert_reviews`, `user_roles` (+ `has_role` fn).
2. Mock data + filter/metrics lib.
3. Market route shell with filter bar, list, analytics strip (no map yet).
4. Add Google Maps connector + map pane with synced markers.
5. Slide-over detail panel + send-to-tools integrations.
6. Saved searches + watchlist UI.
7. Enable Stripe + expert review checkout + webhook + inbox + delivery pages.
8. Nav link, polish, mobile responsiveness.

### Open items needing your confirmation before build
- **Google Maps connector**: I'll prompt to link it (managed key, no setup on your side for *.lovable.app — needed only).
- **Stripe payments**: needs Pro plan; £49 default — confirm price.
- **Expert account**: who's the expert (your own email)? I'll seed the `is_expert` role for one user.
