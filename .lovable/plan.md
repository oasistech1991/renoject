## Goal
Release Hartstone Holdings publicly with a **subscription paywall** that locks **Market Search** and **Tradesmen** (including background checks) behind a paid plan. Keep the existing `HARTS / TAYLOR` shared password as an admin bypass so you and the team retain full access without paying.

## What the user sees
- New **landing/marketing tweak** on `/` explaining free vs paid features and a "Start free trial / Subscribe" CTA.
- **New `/auth` page** — email + password sign-up/sign-in plus Google sign-in. Existing `HARTS / TAYLOR` modal still works on top of everything as an admin override.
- **`/pricing` page** — single Monthly plan card with "Subscribe" button → Stripe Checkout.
- **`/account` page** — shows subscription status, "Manage billing" button (Stripe Customer Portal) to cancel/update card.
- **Locked routes** (`/market`, `/tradesmen`):
  - Signed-out users → redirected to `/auth?redirect=...`.
  - Signed-in but no active subscription → soft paywall screen: blurred preview + "Subscribe to unlock — £X/month" CTA.
  - Admin bypass (HARTS/TAYLOR session flag) or active subscriber → full access.
- All other pages (HMO, Renovation, Property Calculator, Deals, Forecast, Tokenize, home) remain **free** behind the existing shared password only — unchanged.

## Pricing
- **Monthly subscription** — single tier. Suggested £29/month (we'll confirm the exact number with you before creating the Stripe product; easy to change after).

## Auth model
Two parallel access paths:
1. **Admin shared password** (existing `HARTS / TAYLOR`) — sets `sessionStorage.hh_unlocked = "1"` and grants access to **everything**, paid features included. Used by you/the team.
2. **Real Supabase accounts** (new) — email/password + Google OAuth. Public users sign up, then must subscribe to access locked features.

A user is considered "entitled" if **either** the admin flag is set **or** they have an active Stripe subscription.

## Data sources / infrastructure
- **Lovable Payments — Stripe (seamless)**: enabled via `enable_stripe_payments`. No Stripe account or API key needed from you; Lovable handles checkout, webhooks, taxes. Requires Lovable **Pro plan** and Lovable Cloud (already enabled). For digital/SaaS we'll default to Stripe's full compliance handling (tax, fraud, disputes handled for you, +3.5% on top of base Stripe fees).
- **Supabase Auth** for real accounts (email/password + Google).
- **`subscribers` table** synced from Stripe webhooks to make entitlement checks fast and offline-safe.

## Technical changes

**Auth (Lovable Cloud)**
- Enable email/password auth (no auto-confirm by default — users verify email).
- Enable Google OAuth via `configure_social_auth`.
- Add `src/routes/auth.tsx` with sign-up / sign-in / forgot-password tabs and Google button (using `lovable.auth.signInWithOAuth`).
- Add `src/routes/reset-password.tsx` (required for password reset flow).
- Update `src/routes/__root.tsx`:
  - Keep the `HARTS/TAYLOR` modal as admin bypass.
  - Add Supabase `onAuthStateChange` listener; treat user as "unlocked" if admin flag OR signed in.
  - Add user menu (email, Account link, Sign out) when signed in.

**Payments (Stripe via Lovable Payments)**
1. Run `recommend_payment_provider` to confirm fit.
2. Enable via `enable_stripe_payments`.
3. Create one Stripe Product + recurring Price (£X / month) using `batch_create_product`.
4. Implement checkout server function → returns Stripe Checkout URL.
5. Implement customer portal server function.
6. Implement Stripe webhook route at `/api/public/stripe-webhook` to upsert into `subscribers` on `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.

**Database migration**
- `subscribers` table: `id`, `user_id` (FK auth.users), `stripe_customer_id`, `stripe_subscription_id`, `status` (`active`/`trialing`/`past_due`/`canceled`), `current_period_end`, `price_id`, `updated_at`. RLS: user can read own row; webhook uses service role.
- `has_active_subscription(_user_id uuid)` security-definer function returning boolean (status in active/trialing AND period not expired).

**Entitlement helper**
- New hook `useEntitlement()` returning `{ isAdmin, isSubscriber, isEntitled, isLoading }`.
- Reads admin flag from sessionStorage + subscription row from Supabase.

**Route gating**
- Wrap `/market` and `/tradesmen` route components in a `<PaywallGate>` that:
  - If not signed in and not admin → `<Navigate to="/auth?redirect=...">`.
  - If signed in but not entitled → render `<Paywall>` (blurred backdrop screenshot + pricing CTA).
  - Else render the page.

**Pricing + Account pages**
- `src/routes/pricing.tsx` — plan card, "Subscribe" calls checkout server fn, redirects to Stripe.
- `src/routes/account.tsx` — shows email, subscription status, "Manage billing" button → customer portal.

**Nav**
- Add "Pricing" link (always visible) and "Account" / "Sign in" depending on auth state.

## Pre-requisites we need from you
1. **Confirm the price** (suggested £29/month — happy to change).
2. **Confirm Pro plan** is active on your Lovable workspace (required for Lovable Payments).
3. After Stripe is enabled, you'll claim the Stripe account from inside Lovable to start accepting real (live) payments. Test-mode works immediately for verifying the flow end-to-end.

## Out of scope (for this round)
- Annual / lifetime tiers, team seats, coupons — easy to add later once monthly is live.
- Per-feature credit metering (e.g. "5 background checks/month") — current plan is all-or-nothing access to the two locked sections.
- Migrating existing pages off the shared password to real accounts — only paywalled sections require sign-in.
