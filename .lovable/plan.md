## Goal

Add a new **Construction Timeline** tool under the sidebar's "Tools" section, modelled on Build4Cast's construction scheduling software. It lets you plan a build per property: phases → tasks, durations, dependencies, milestones, working calendars, multiple views (Gantt / weekly / calendar / list), templates, colour-coded trades, and links into existing project data (properties, refurb costs, tradesmen, documents).

## What gets built

### 1. New route `/construction-timeline` (admin/team only, under `_authenticated` semantics)
A single page with a left sidebar listing schedules, a top toolbar, and a main canvas that swaps between four views.

### 2. Database (new tables, RLS + GRANTs in one migration)

- `construction_schedules` — one schedule per build
  - `id`, `user_id`, `property_id` (nullable, FK `crm_properties` or `properties`), `name`, `planned_start`, `planned_finish`, `working_days` (int[] for Mon–Sun), `non_working_dates` (date[]), `colour_palette` (jsonb of trade→hex), `template_of_id` (self-FK, nullable), `created_at`, `updated_at`.
- `construction_phases` — ordered phases within a schedule
  - `id`, `schedule_id`, `name`, `position`, `colour`.
- `construction_tasks` — tasks under phases
  - `id`, `schedule_id`, `phase_id`, `name`, `trade` (text), `assignee_tradesman_id` (FK `tradesmen`, nullable), `planned_start`, `planned_finish`, `duration_days`, `actual_start`, `actual_finish`, `percent_complete`, `is_milestone` (bool), `priority` (`low|normal|high|critical`), `notes`, `position`.
- `construction_task_links` — dependencies between tasks
  - `id`, `from_task_id`, `to_task_id`, `link_type` (`FS|SS|FF|SF` — default FS), `lag_days`.
- `construction_daily_logs` — site diary entries linked to a schedule/task
  - `id`, `schedule_id`, `task_id` (nullable), `log_date`, `weather`, `crew_count`, `hours_worked`, `notes`, `delay_reason` (nullable).
- `construction_attachments` — files & RFIs against a task
  - `id`, `task_id`, `kind` (`document|drawing|rfi|approval`), `title`, `url`, `status` (`open|approved|rejected|answered`), `created_at`.

All tables: enable RLS, restrict to admins via `has_role`, plus owner (`user_id = auth.uid()`) for `construction_schedules`. Cascade deletes. GRANTs for `authenticated` + `service_role`.

### 3. Sidebar entry
Add `{ to: "/construction-timeline", label: "Construction Timeline", icon: HardHat }` to `TOOL_ITEMS` in `src/routes/__root.tsx`, slotted right after Portfolio Timeline.

### 4. UI modules (each maps to a Build4Cast feature)

| Build4Cast feature | Built as |
|---|---|
| Project Setup | "New schedule" dialog: name, property link, planned start/finish, working days, non-working dates |
| Viewing Options | View toggle: **Gantt** / **Weekly planner** / **Calendar** / **Phase & task list** |
| Task Management | Inline task table per phase; click row → right-side drawer to edit dates, duration, assignee, trade, notes, % complete |
| Group Tasks | Drag-and-drop tasks into phases; collapsible phase headers |
| Link Tasks | "+ Add dependency" inside the task drawer; predecessor picker, FS/SS/FF/SF + lag days; Gantt bars draw arrows; bar drag respects predecessors |
| Reusable Templates | "Save as template" / "Create from template" actions on a schedule; templated schedules clone phases, tasks, durations (no dates) |
| Shared Timelines | Realtime via Supabase channel on `construction_*` tables so two admins watching the same schedule see live edits |
| Integrated Tools | Task drawer has tabs: **Details**, **Daily logs**, **Attachments/RFIs**; "Link to property" pulls refurb cost from the existing deal; "Assign tradesman" picks from the existing `tradesmen` table |
| Spot risks / colours | Trade colour palette in schedule settings; bars coloured by trade; high/critical tasks get a red border; overlap detection highlights clashes |
| Progress tracking | Each task has planned vs actual dates + % complete; top KPI strip shows on-time %, days slipped, tasks at risk |
| Milestones | `is_milestone` tasks render as diamond markers on the Gantt |

### 5. Gantt view (the hero view)
- Built with existing project libs (no new chart dep): a CSS-grid timeline where the X axis is days (zoomable: day / week / month buttons), rows are tasks grouped under phase headers.
- Bars are absolutely-positioned divs sized by `(duration_days × cellWidth)`; draggable on X to shift dates; resizable on the right edge to change duration; both write back to Supabase.
- Dependency arrows drawn with an SVG overlay between bar edges.
- "Today" vertical guideline; non-working days shaded.

### 6. Lifecycle strip (top of page)
Five-step strip mirroring Build4Cast's "Planning → Pre-Construction → Live → Progress → Completion" with a button on each step that filters the task list to relevant phases.

### 7. Property linkage
- New schedule dialog can pre-populate phases from a starter template ("Cosmetic refurb", "Full BRRR refurb", "HMO conversion") so users get going in one click.
- If linked to a `crm_properties` row, the schedule shows the property address in the header and a "Open in CRM" link.

### 8. SEO + metadata
`head()` block on the route with route-specific title/description ("Construction Timeline — Renoject"), no og:image at root.

## Technical Notes (not user-facing)

- All queries through the browser Supabase client; mutations rely on RLS. No server functions needed for v1.
- Drag-and-drop with `@dnd-kit/core` (already in repo if present; else add).
- Date math with `date-fns` (already used elsewhere).
- Realtime: one channel per `schedule_id` subscribing to insert/update/delete on the three child tables, then refetch.
- Build incrementally: ship list + Gantt + task drawer + templates first; Daily Logs/Attachments and FS/SS/FF/SF advanced link types in the same PR but behind simple UI.

## Out of scope (can come later)

- Mobile field app, push notifications.
- Auto-rescheduling on dependency change (v1 just warns).
- Bid/proposal/estimation modules from Build4Cast — separate tools, not in this plan.
