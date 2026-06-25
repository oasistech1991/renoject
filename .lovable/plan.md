# Landlord Vision–inspired CRM redesign

Landlord Vision is built around a landlord's *operational* day: a left sidebar of modules, a dense dashboard of "what needs my attention", and deep per-property records that tie tenancies, rent, expenses, inspections, certificates, and documents together. Today our `/crm` is a flat horizontal tab bar over investor-led modules. This plan re-skins and re-organises it around that landlord-operations model while keeping our existing investor + sales flows.

## New shell

Replace the top tab bar in `src/routes/crm.tsx` with a Landlord Vision–style two-pane layout:

```text
┌───────────────────────────────────────────────────────────┐
│ Topbar: search · quick add · alerts · profile             │
├──────────┬────────────────────────────────────────────────┤
│ Sidebar  │  Module workspace                              │
│  Home    │  ┌──────────────────────────────────────────┐  │
│  Props   │  │ Module header + filters + primary CTA    │  │
│  Tenan.  │  ├──────────────────────────────────────────┤  │
│  Rent    │  │ Content (table / kanban / detail)        │  │
│  Expns.  │  │                                          │  │
│  Tasks   │  │                                          │  │
│  Compl.  │  └──────────────────────────────────────────┘  │
│  Docs    │                                                │
│  Suppl.  │                                                │
│  Sales   │                                                │
│  Invest. │                                                │
│  Reports │                                                │
└──────────┴────────────────────────────────────────────────┘
```

Collapsible sidebar (icon-only on tablet/mobile), groups: **Operations** (Home, Properties, Tenancies, Rent, Expenses, Tasks, Compliance, Documents, Suppliers), **Growth** (Sales pipeline, Leads, Investors), **Insights** (Reports).

## Module changes

1. **Home (new)** — "What needs your attention" dashboard:
   - KPI strip: Occupancy %, Monthly rent, Arrears £, Cash collected this month, Upcoming certificate expiries.
   - Tiles: Overdue tasks, Rent due in next 7 days, Tenancies ending in 60 days, Compliance items expiring in 60 days, Recent activity.
   - Driven entirely from existing tables (`crm_units`, `crm_tenants`, `crm_tasks`, `crm_activities`, plus new compliance fields below).

2. **Properties** — keep `PropertiesTable` but reframe as the operational record. The `PropertyDetailSheet` becomes a fuller right-pane "property file" with tabs: Overview, Tenancies, Rent ledger, Expenses, Compliance, Documents, Project (existing), Notes.

3. **Tenancies (new view over existing data)** — list view of `crm_tenants` joined to units/properties, showing start, end, rent, status, arrears, days-to-renewal. No new table needed.

4. **Rent (new)** — month grid: rows = tenancies, columns = last 6 months, cells coloured paid / partial / overdue. Backed by a new `crm_rent_payments` table (tenant_id, due_date, due_amount, paid_amount, paid_on, method, notes) so arrears stop being a single field on `crm_tenants`.

5. **Expenses (new)** — table of property-level expenses (date, category, supplier, amount, VAT, taxable, notes, receipt URL). New `crm_expenses` table.

6. **Tasks** — keep `crm_tasks` but switch UI to Landlord Vision's segmented Today / Overdue / Upcoming / Done view.

7. **Compliance (new)** — per-property record of certificates: Gas, EICR, EPC, PAT, Fire alarm, HMO licence, Deposit protection. New `crm_compliance_items` table with property_id, type, issued_on, expires_on, document_url, status. Home dashboard reads "expiring in 60 days" from here.

8. **Documents (new)** — file list per property (tenancy agreements, certificates, statements). New `crm_documents` table (property_id, name, kind, file_url, uploaded_at, uploaded_by). Files go in the existing `property-media` bucket under a `crm/{property_id}/` prefix.

9. **Suppliers** — rename **Contractors** to Suppliers (Landlord Vision terminology), same data (`crm_contractor_meta` + `tradesmen`), add columns for trade, preferred, last used.

10. **Sales / Leads / Investors** — keep as today, moved under the Growth group.

11. **Reports** — extend with: rent collected vs due (12-month line), arrears ageing buckets, expense by category, compliance expiry timeline.

## Database changes (one migration)

- `crm_rent_payments` (tenant_id → crm_tenants, due_date, due_amount, paid_amount, paid_on, method, notes)
- `crm_expenses` (property_id → crm_properties, supplier_id nullable → tradesmen, date, category, amount, vat_amount, notes, receipt_url)
- `crm_compliance_items` (property_id, type enum, issued_on, expires_on, document_url, status)
- `crm_documents` (property_id, name, kind, file_url, uploaded_by, uploaded_at)

All four: admin-only RLS (matches every other `crm_*` table), explicit GRANTs to `authenticated` + `service_role`, `updated_at` trigger where mutable.

## Visual treatment

Keep the current warm-charcoal theme and orange (#F7791E) accent — apply Landlord Vision's *structural* cues, not their colours:
- Dense, table-first content with sticky headers.
- Status pills (Let, Vacant, Notice, Arrears, Compliant, Expiring, Expired) using existing semantic tokens.
- Property file as a wide right-side sheet with tabbed sections instead of separate routes.
- Quick-add menu in the topbar (Property, Tenancy, Rent payment, Expense, Task, Document).

## Files touched

- `src/routes/crm.tsx` — replace tab layout with sidebar shell.
- New `src/components/crm/Shell.tsx`, `Sidebar.tsx`, `Topbar.tsx`, `QuickAdd.tsx`.
- New modules: `Home.tsx`, `Tenancies.tsx`, `Rent.tsx`, `Expenses.tsx`, `Compliance.tsx`, `Documents.tsx`.
- Update: `Properties.tsx`, `PropertyDetail.tsx` (new tabs), `Contractors.tsx` → `Suppliers.tsx`, `Reports.tsx`, `types.ts`.
- One Supabase migration for the four new tables.

## Out of scope (ask before building)

- Bank-feed reconciliation, Open Banking, accountant export, MTD/HMRC filing, automated rent reminders, tenant portal, online rent collection. Each is a sizeable module on its own.

Confirm and I'll build it. If you'd rather I match Landlord Vision's exact blue/white visual style too, say so and I'll add a theme pass.