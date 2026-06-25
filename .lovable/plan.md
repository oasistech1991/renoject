## Client Deal Feed — collaborative client portal

A Facebook-style feed where signed-in **clients** browse deals you publish, react, comment, save, and signal interest.

### 1. Roles & access

- Add a new role `client` to the existing `app_role` enum (alongside `admin`).
- New client-only route: `/feed` (under `_authenticated/` so login is required).
- Sidebar shows **Client Feed** to everyone signed in; admins also see a **Manage feed** view.
- New auth flow: when a brand-new user signs up they're given `client` role by default; admins keep full access.

### 2. Publishing a deal to the feed

On the existing deal/refinance view, next to **Add to forecast**, add:

- ☐ **Add to client feed**
- Per-deal "display mode" selector that appears once ticked:
  - **Teaser** — cover photo, headline (GDV / cash left in / ROI / monthly cashflow), area only
  - **Full** — all refinance numbers, refurb cost, cashflow breakdown
  - **Hide fields** — toggles for: exact address, purchase price, lender details
- Optional caption + cover image picker (re-uses `property_media`).

Ticking publishes instantly. Unticking removes it from the feed (post archived, comments preserved).

### 3. Feed page (`/feed`)

Layout:

```text
┌─────────────────────────────────────────┐
│  Filter: All · New · Most loved · Saved │
├─────────────────────────────────────────┤
│  [cover image]                          │
│  Deal name · area · posted 2d ago       │
│  GDV £325k · Cash left in £12k · 8.4%   │
│  "Caption from you about the deal..."   │
│  👍 12   ❤️ 4   🔥 2     💬 6 comments  │
│  [I'm interested]  [Save]  [Share]      │
├─────────────────────────────────────────┤
│  next post...                           │
└─────────────────────────────────────────┘
```

- Infinite scroll, newest first.
- Clicking a card opens a detail sheet with the full breakdown (respecting hidden fields).
- "Save" adds to a personal **Watchlist** tab.
- "Share" copies a signed link (recipient still needs to sign in to view).
- "I'm interested" sends you an in-app notification + email with the client's name, email, and the deal.

### 4. Social / collaborative features

Included in v1:

- **Reactions** — 👍 ❤️ 🔥 (one per user per deal, swap freely).
- **Comments** — flat thread per deal, with @mentions of the deal owner.
- **Express interest** — single button per deal, one-time per client, surfaces in your **Inbox**.
- **Save / Watchlist** — personal list + shareable.

Extra suggestions for later (not in v1, listed so you can pick what to add next):

- **Client profile** — avatar, display name, "investor type" tag (cash buyer / JV / lender).
- **Following** — clients follow you/areas; feed personalises.
- **Polls on a deal** — "Would you buy at this price?" yes/no/maybe.
- **Activity ribbon** — "Sarah saved · James reacted · 3 new comments" on each card.
- **Deal status badges** — `New`, `Under offer`, `Sold`, `Refinanced` (you toggle, shows in feed).
- **Direct message** — 1:1 chat between you and an interested client.
- **Notifications bell** — new comment, new reaction, new interested-buyer.
- **Investor pack download** — re-uses existing `ExportInvestorPackButton` as a "Download pack" CTA on the post.
- **Weekly digest email** — top deals + activity summary.

### 5. Admin manage view

`/feed/manage` (admin only):

- Table of every published deal with reactions count, comments count, interested-buyers count.
- Quick unpublish, edit caption, change display mode.
- Inbox of "interested" leads with deal + client contact info, mark-as-contacted.

---

### Technical details

**New tables** (all RLS-enforced, GRANTed to authenticated + service_role):

- `feed_posts` — `property_id`, `author_id`, `caption`, `cover_media_id`, `display_mode` (`teaser`/`full`), `hidden_fields jsonb`, `is_published`, timestamps.
  - SELECT: any authenticated user when `is_published = true`; owner & admin always.
  - INSERT/UPDATE/DELETE: owner or admin.
- `feed_reactions` — `post_id`, `user_id`, `kind` (`like`/`love`/`fire`), unique on (post_id, user_id).
- `feed_comments` — `post_id`, `user_id`, `body`, `parent_comment_id?`, timestamps. SELECT to all authenticated; INSERT to self; UPDATE/DELETE own or admin.
- `feed_interest` — `post_id`, `user_id`, `note?`, `status` (`new`/`contacted`/`closed`), unique on (post_id, user_id). Owner of the post + admin can read all rows for their posts; the interested user can read their own.
- `feed_saves` — `post_id`, `user_id`, unique. User reads/writes own only.
- `client_profiles` — `user_id` (PK, FK auth.users), `display_name`, `avatar_url`, `investor_type`. User reads/writes own; everyone authenticated can read display_name/avatar_url for comment attribution.

**Role bootstrap:**
- Migration adds `'client'` to `app_role` enum.
- Trigger on `auth.users` insert → insert `client` row in `user_roles` (skipped if already exists, e.g. admin pre-seeded).

**Publishing checkbox:**
- Adds `feed_published`, `feed_display_mode`, `feed_hidden_fields`, `feed_caption`, `feed_cover_media_id` shortcuts via a `feed_posts` row, not as new columns on `properties`. Toggling the checkbox upserts/deletes the `feed_posts` row.

**Routes:**
- `src/routes/_authenticated/feed.tsx` — feed list + filters.
- `src/routes/_authenticated/feed.$postId.tsx` — full post + comments.
- `src/routes/_authenticated/feed/manage.tsx` — admin (gated by `has_role(_, 'admin')`).
- `src/routes/_authenticated/feed/inbox.tsx` — interested-buyer leads (admin).
- `src/routes/_authenticated/feed/saved.tsx` — current user's saved deals.
- Server fns under `src/lib/feed.functions.ts` using `requireSupabaseAuth`: `listFeed`, `getPost`, `togglePublish`, `react`, `comment`, `expressInterest`, `toggleSave`, `listInbox`, `markLeadStatus`.

**Realtime (optional v1):** subscribe to `feed_reactions` + `feed_comments` for the open post so counts update live.

**SEO:** `/feed/*` is in `_authenticated/` (login-gated), so `noindex` — these pages are not for crawlers.

---

### What v1 ships with

Reactions, comments, save/watchlist, express-interest, share link, per-deal teaser/full toggle with hideable fields, admin manage view + leads inbox, client profile (name + avatar). Notifications bell, polls, following, DMs, status badges, and digest email are explicitly out of v1 — pick any of those next.