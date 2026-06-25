# Property CRM (Salesforce + Pipedrive, tailored)

Rebuild `/crm` as a full property-development sales & operations platform — the visual rigor of Salesforce, the drag-and-drop flow of Pipedrive, but every object speaks "property": Leads, Investors, Deals, Properties, Projects, Tenants, Contractors.

## Object model (new + reused)

Reused: `client_profiles` (investors), `feed_posts` (deals), `direct_messages`, `crm_activities`, `crm_tasks`, `crm_contact_meta`, `crm_deal_clients`.

New tables:

1. **`crm_leads`** — top-of-funnel before they become an investor
   `name, email, phone, source (referral/feed/portal/event/cold), status (new/contacted/qualified/unqualified/converted), interested_in (BTL/HMO/flip/dev), budget_min, budget_max, area_pref, owner_id, converted_client_id, notes`

2. **`crm_properties`** — physical asset record (separate from a marketed deal)
   `address, postcode, lat, lng, property_type (HMO/BTL/flip/commercial/mixed/dev_site), beds, baths, sqft, tenure, status (sourcing/under_offer/owned/refurb/let/sold), purchase_price, current_value, equity, owner_entity, source_post_id`

3. **`crm_projects`** — refurb/development jobs on a property
   `property_id, name, type (light_refurb/heavy_refurb/conversion/new_build), stage (planning/permits/demo/first_fix/second_fix/snagging/complete), budget, spent, start_date, target_end, actual_end, pm_user_id, risk (low/med/high)`

4. **`crm_units`** — lettable units within a property (HMO rooms, flats)
   `property_id, label, beds, rent_pcm, status (vacant/let/notice/refurb), tenant_id`

5. **`crm_tenants`** — tenant CRM
   `unit_id, full_name, email, phone, tenancy_start, tenancy_end, rent_pcm, deposit, status (current/past/arrears/notice), arrears_amount`

6. **`crm_contractors`** — uses existing `tradesmen` + thin extension table `crm_contractor_meta` (rating, default_rate, preferred, last_used_at, total_spend)

7. **`crm_project_tasks`** — Gantt-style tasks under a project (extends `crm_tasks` with `project_id`, `depends_on`, `start_date`, `duration_days`)

## Pipelines (Pipedrive-style Kanban, multiple)

Each pipeline is a top-level tab with its own stages and weighted forecast:

- **Sourcing pipeline** (deal flow): Lead → Viewed → Offer made → Offer accepted → Legals → Completed
- **Investor pipeline** (capital raise per deal): New → Qualified → Pitched → Soft commit → Funds received → Invested
- **Refurb pipeline** (per project): Planning → Permits → On site → Snagging → PC → Refinanced
- **Lettings pipeline** (per unit): Marketing → Viewings → Offer → Referencing → Move-in

Drag cards between stages → writes `crm_activities` stage_change + recalculates forecast.

## New routes (admin only, under `_authenticated/`)

```
crm.tsx                      Layout w/ object switcher tabs (Sales · Properties · Projects · Lettings · Investors · Contractors · Tasks · Reports)
crm.index.tsx                Command-center dashboard
crm.sales.tsx                Sourcing Kanban (deals you might buy)
crm.investors.tsx            Investor pipeline Kanban + capital raise per deal
crm.properties.tsx           Property portfolio table + map toggle
crm.property.$id.tsx         360° property record
crm.projects.tsx             Refurb Kanban + Gantt toggle
crm.project.$id.tsx          Project detail (budget, tasks, photos, contractors)
crm.lettings.tsx             Units board (vacant / let / arrears)
crm.tenant.$id.tsx           Tenant record (payments, comms, docs)
crm.contractors.tsx          Contractor roster + ratings + spend
crm.leads.tsx                Lead inbox + convert-to-investor
crm.tasks.tsx                My / team tasks across all objects
crm.reports.tsx              Saved reports + KPI builder
```

## Command-center dashboard (`/crm`)

Top KPI strip: Pipeline £ (weighted) · Capital raised this quarter · Properties under refurb · Occupancy % · Arrears £ · Open tasks today.

Below: 4 widgets
- **Sales funnel** — bar chart of sourcing stages by £ value
- **Capital raise progress** — per-deal bars (raised / target / shortfall)
- **Refurb risk board** — projects coloured red/amber/green by budget burn vs schedule
- **This week** — viewings booked, completions due, tenancy renewals, contractor jobs

Stale alerts row: leads not contacted in 7d, deals stuck in stage 14d+, projects over budget, units vacant 30d+.

## Property record (`/crm/property/:id`) — the Salesforce "360° view"

Header: address, hero image, status pill, value/equity, owner entity.

Left rail (sticky): Quick log call · Add task · Add expense · Add photo · Add document.

Tabs:
- **Overview** — value timeline, refi events, cashflow per month
- **Investors** — who funded this property, % stake, amount, payout schedule
- **Project** — current refurb (budget vs spent gauge, % complete, next milestone)
- **Units & Tenants** — table per unit with rent, status, arrears
- **Activity** — merged timeline (notes, calls, DMs, viewings, contractor visits, payments)
- **Documents** — leases, EPCs, gas certs, insurance (storage bucket)
- **Map** — Google Maps pin + nearby comps from `feed_posts`

## Investor record (extends existing profile)

Adds: capital deployed by deal (table), projected returns (£/yr), next payout date, KYC status, preferred deal types, contact cadence (last touch + suggested next touch from `crm_contact_meta`).

## Lettings module (Pipedrive-flavoured)

Board grouped by status: Vacant · Marketing · Offer · Move-in · Let · Notice · Arrears.
Each unit card: address+unit, photo, rent, days vacant, tenant initials.
Click → tenant sheet: tenancy dates, rent ledger (manual entry v1), maintenance tickets (links to contractors).

## Reports (`/crm/reports`)

Saved reports a property dev actually wants:
- ROI by deal · ROI by source · ROI by area
- Investor concentration (top 5 investors as % of portfolio)
- Average refurb overrun (£ and days)
- Lead-to-investor conversion %, time-to-close
- Stage velocity (avg days per stage per pipeline)

CSV export on every table.

## Automation (DB triggers, extends existing)

- New `feed_interest` → upsert `crm_deal_clients` (already exists) ✓
- New `feed_post` (deal added) → insert `crm_properties` row with status='sourcing'
- `crm_properties.status` flips to 'owned' → auto-create `crm_projects` row stub (planning)
- `crm_projects.stage` → 'PC' (practical completion) → auto-create lettings tasks per unit
- Tenant arrears > 0 → auto-create `crm_tasks` "Chase arrears" assigned to PM
- Lead `status` → 'converted' → create `client_profiles` row + seed `crm_contact_meta`

## Navigation

Replace current single "CRM" link in `__root.tsx` with a CRM dropdown for admins: Sales, Properties, Projects, Lettings, Investors, Reports.

## Tech notes

- All routes under `_authenticated/`, admin role check via `has_role`.
- Kanban: `@dnd-kit/core` (already in stack).
- Gantt for projects: lightweight custom on top of `recharts` time axis (already used in portfolio-timeline).
- Property documents: reuse `property-media` storage bucket with subfolder per property.
- Maps: existing Google Maps connector + `geocode.functions.ts`.
- Forecast £: sum(`amount` × `probability/100`) per pipeline stage, server fn.

## Out of scope (v1)

- Inbound email parsing / Office365 sync
- e-signature for tenancy agreements
- Stripe/GoCardless rent collection (manual ledger only)
- SMS comms
- Mobile app — responsive web only

## Build order

1. Migration: new tables + grants + RLS (admin-only) + triggers + extend `feed_posts`→`crm_properties` link.
2. Layout: `/crm` shell with object switcher tabs + nav dropdown.
3. Sales + Investors pipelines (reuse existing Kanban code).
4. Properties table + 360° record.
5. Projects Kanban + Gantt.
6. Lettings board + tenant sheet.
7. Contractors roster (wraps existing `tradesmen`).
8. Leads inbox + conversion flow.
9. Reports.
10. Dashboard tying it all together.
