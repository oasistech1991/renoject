
# Renoject Team CRM

A standalone CRM built on top of what already exists (client_profiles, feed_posts, feed_interest, direct_messages, user_roles). Admin-only surface at `/crm`.

## What you already have (reused, not rebuilt)
- **Contacts** → `client_profiles` (becomes the CRM contact record).
- **Signals of interest** → `feed_interest`, `feed_poll_votes`, `feed_saves` (auto-feed the pipeline).
- **Messaging** → `direct_messages` (logged as activities).
- **Team identity** → `user_roles` (admin = team member).

## What's missing — new database tables

1. `crm_contact_meta` — extends `client_profiles` with CRM-specific fields:
   - `owner_id` (which team member owns this client)
   - `stage` (new / qualified / interested / negotiating / won / lost)
   - `lifecycle_value` (£ closed)
   - `last_contacted_at`, `next_action_at`
   - `tags[]`, `source`

2. `crm_deal_clients` — the **client ↔ deal pipeline** (one row per investor per deal):
   - `client_id`, `feed_post_id` (deal), `stage`, `probability %`, `amount`, `owner_id`, `notes`

3. `crm_activities` — timeline log per client:
   - `type` (call, meeting, email, note, dm, viewed-deal, voted, saved)
   - `subject`, `body`, `occurred_at`, `team_member_id`, `client_id`, optional `feed_post_id`
   - Auto-populated rows from feed_interest / feed_poll_votes / direct_messages via triggers

4. `crm_tasks` — follow-ups:
   - `title`, `due_at`, `status` (open/done/snoozed), `assignee_id`, `client_id`, optional `feed_post_id`, `priority`

5. `crm_team_members` — lightweight view over admins with display name/avatar/email (for assignee dropdowns). Could be a view, not a table.

All tables: RLS restricted to `has_role(auth.uid(), 'admin')` for select/insert/update/delete, plus standard GRANTs.

## New UI — `/crm` (admin only)

```
src/routes/_authenticated/crm.tsx            # layout w/ tabs + Outlet
src/routes/_authenticated/crm.index.tsx      # Dashboard
src/routes/_authenticated/crm.pipeline.tsx   # Client pipeline (Kanban)
src/routes/_authenticated/crm.deals.tsx      # Deal × Client pipeline
src/routes/_authenticated/crm.contacts.tsx   # Contact list/table
src/routes/_authenticated/crm.contact.$id.tsx # Contact detail
src/routes/_authenticated/crm.tasks.tsx      # My tasks / team tasks
```

### 1. Dashboard (`/crm`)
KPIs across the top:
- Pipeline value (£) by stage
- Conversion funnel: leads → qualified → interested → won (%)
- Team activity: calls/notes/DMs/tasks completed per member, last 7/30 days
- Stale clients: no contact in 14d / 30d / 60d (clickable lists)
- Open tasks due today / this week

### 2. Client pipeline (`/crm/pipeline`)
Drag-and-drop Kanban of all clients across 6 stages (New, Qualified, Interested, Negotiating, Won, Lost). Each card: avatar, name, owner, available capital, last activity, next task. Filter by owner / tag / source. Drag to update `crm_contact_meta.stage`.

### 3. Deal × Client pipeline (`/crm/deals`)
Matrix or per-deal Kanban: pick a deal → see every investor's stage on that specific deal. Auto-populates a "Interested" entry whenever a client clicks 👍 / interest / vote on the feed.

### 4. Contacts (`/crm/contacts`)
Searchable, filterable table: name, owner, stage, capital, last contact, tags, next task. Bulk-assign owner. CSV export.

### 5. Contact detail (`/crm/contact/:id`)
Facebook-profile-style header (reuse profile component), plus:
- **About** panel (existing profile data: capital, preferred areas, deal types, budget)
- **Pipeline** strip (stages per deal they're tracking)
- **Activity timeline** (all activities merged, newest first — DMs, votes, interests, notes, calls)
- **Quick log**: "Log a call", "Log a meeting", "Add note", "Send DM"
- **Tasks** list with quick-add
- **Edit owner / stage / tags** inline

### 6. Tasks (`/crm/tasks`)
Two tabs: "My tasks" / "Team tasks". Group by Overdue / Today / This week / Later. Mark complete inline. Click a task → opens its contact.

## Auto-population (so the team doesn't double-enter)

Database triggers convert existing signals into CRM rows:
- New `feed_interest` row → upsert `crm_deal_clients` (stage = "interested") + insert `crm_activities` (type = "interest")
- New `feed_poll_votes` → `crm_activities` (type = "voted")
- New `direct_messages` (client→team) → `crm_activities` (type = "dm") + bump `last_contacted_at` when team replies
- New `client_profiles` row → seed `crm_contact_meta` with stage = "new"

## Reporting queries (server functions)
- `getPipelineValueByStage()` — sums `crm_deal_clients.amount` grouped by stage
- `getConversionFunnel({ from, to })` — counts contacts who passed each stage in window
- `getTeamActivity({ from, to })` — counts activities & completed tasks per `team_member_id`
- `getStaleContacts({ days })` — `WHERE last_contacted_at < now() - interval 'X days'`

## Navigation
- New "CRM" link in `__root.tsx` admin nav (hidden for clients).
- Contact-detail "Open in CRM" button on existing admin client cards (e.g. cash pipeline on home).

## Out of scope for v1
- Email sync / inbound email parsing (no provider chosen).
- Meeting scheduler beyond existing Calendly link.
- HubSpot/Pipedrive sync — confirmed standalone.
- Per-stage automation rules (can be added later as DB triggers).

## Technical details (engineer notes)
- All `/crm` routes under `_authenticated/` with a `beforeLoad` check for `has_role(authUser, 'admin')`, redirecting clients to `/`.
- Kanban uses `@dnd-kit/core` (already commonly used).
- Realtime: subscribe to `crm_tasks` and `crm_activities` for live updates on the dashboard.
- Drag-and-drop stage changes call a single `updateClientStage` server fn (`requireSupabaseAuth` + admin check).
- Activity timeline is a `UNION ALL` view over `crm_activities`, `direct_messages`, `feed_interest`, `feed_poll_votes` for read; writes go to `crm_activities`.
