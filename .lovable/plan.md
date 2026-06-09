# Make all features free

Remove the Pro paywall so every tool (Market Search, Tradesmen background checks, etc.) is accessible to anyone — no subscription or sign-in required to use them.

## Changes

1. **`src/components/PaywallGate.tsx`** — make it a pass-through that always renders `children`. Keeps the import surface intact so no route files need editing.

2. **`src/hooks/useEntitlement.ts`** — always return `isEntitled: true` (still load auth session so `email`/`userId` stay accurate for the account page), skip the subscription query.

3. **Navigation / pricing entry points** — remove "Pricing" / "Upgrade" links from the header/nav (wherever they appear). Keep `/pricing` and `/account` routes reachable directly for now but stop promoting them.

4. **`src/routes/pricing.tsx`** — replace with a simple "All features are free" message and a link back home. Removes the Subscribe button and Paddle checkout call.

5. **`src/components/PaymentTestModeBanner.tsx`** — render nothing (no checkouts happen anymore).

## Left intact (not removed)

- Paddle integration code, `subscriptions` table, webhook route, server functions. They become dormant but stay in the repo so re-enabling paid plans later is a one-file revert. Tell me if you'd rather I delete them entirely.
- `/account` page — still useful for sign-out and showing signed-in email.
- Auth (sign in / sign up) stays available but is not required to use any tool.

## Confirm before I build

- OK to keep Paddle code dormant rather than ripping it out?
- Remove the "Pricing" link from the nav entirely, or leave it pointing at the new "everything is free" page?
