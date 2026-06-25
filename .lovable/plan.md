## Problem

The contextual "Add X" buttons I added to the CRM header only work for **Add property** and **New task**. The rest (Add expense, Add certificate, Upload document, Add supplier, Add deal, Add project, Add unit, Add lead, Add investor, plus the "New tenancy" / "Log payment" hints) just toast or fire an event with no listener — so nothing happens.

## Fix

Make every header CTA open a working create dialog at the `/crm` page level, so the button is the real entry point for that page's primary action.

### New dialogs (each a small `Sheet` with the minimum required fields, inserts into the existing table, then refreshes)

| View | Button | Inserts into | Key fields |
|---|---|---|---|
| Expenses | Add expense | `crm_expenses` | property, date, category, amount, VAT, notes |
| Compliance | Add certificate | `crm_compliance_items` | property, type, issued, expires, notes |
| Documents | Upload document | `crm_documents` (+ Storage upload to `property-media/crm/{property_id}/`) | property, name, kind, file |
| Suppliers | Add supplier | `tradesmen` (+ `crm_contractor_meta`) | name, trade, phone, email |
| Sales | Add deal | `crm_deal_clients` | linked feed post, client, stage, amount, probability |
| Projects | Add project | `crm_projects` | property, name, type, stage, budget, target end |
| Lettings board | Add unit | `crm_units` | property, label, beds, rent pcm, status |
| Leads | Add lead | `crm_leads` | name, email, phone, source, status, budget |
| Investors | Add investor | `client_profiles` (+ `crm_contact_meta`) | name, email, available capital, stage |
| Tenancies | New tenancy | `crm_tenants` | unit, full name, rent pcm, start/end, status |
| Rent | Log payment | `crm_rent_payments` | tenant, due date, due amount, paid amount, paid on |

All dialogs follow the same shape as the existing `AddPropertyDialog` and `NewTaskDialog`: open state held in `crm.tsx`, save via `supabase.from(...).insert(...)`, toast + close + refresh on success.

### Wiring

- Replace the `dispatch(...) + toast.message(...)` placeholders in `PrimaryAction` with real `onClick` handlers that set the matching dialog's `open` state.
- Properties lists (suppliers, leads, etc.) auto-refresh after insert by reusing each module's existing fetch — for modules that load on mount only, I'll bump a `refreshTick` state passed in as a prop they re-read on, or have the dialog dispatch a `crm:refresh` event each module listens to. I'll use the event approach so I don't have to touch every module's props.

### Out of scope

- No schema changes — every table already exists.
- No redesign of existing module pages; only the header CTA gets wired.
- Reports stays with no CTA.

Confirm and I'll build it.