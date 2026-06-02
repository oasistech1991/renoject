## Goal

Let you name a property in the Refinance / BRRR calculator, save it (inputs + key metrics) to a backend, list all saved properties on a new page, and load any of them back into the calculator to keep working.

## Backend (Lovable Cloud)

Enable Lovable Cloud and add one table:

`properties`
- `id` uuid primary key
- `name` text not null
- `inputs` jsonb not null — the full `RefinanceInputs` object
- `metrics` jsonb not null — snapshot of headline `RefinanceResults` (cash left in, cash released, new loan, ROI, gross yield, GDV, verdict, etc.)
- `created_at`, `updated_at` timestamptz

Since you chose **shared / no login**, RLS will allow public select/insert/update/delete from the anon role. (Heads up: anyone with the app URL can read/edit — fine for a personal tool, not for real client data. Easy to switch to per-user later.)

Grants: `GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO anon, authenticated;`

## Calculator changes (`src/routes/refinance.tsx`)

- New **Property name** text input at the top of the page (above the input columns), plus a small toolbar:
  - **Save** — inserts a new row if no current id, otherwise updates the existing row.
  - **Save as new** — always inserts a new row.
  - **New** — clears the form back to defaults.
  - Subtle "Last saved …" indicator.
- A `?id=<uuid>` search param so a saved deal can be deep-linked; on mount, if present, fetch and hydrate inputs.

## New page: `/properties` (`src/routes/properties.tsx`)

- Lists all saved properties as cards/rows: name, GDV, cash left in, ROI, verdict badge, updated date.
- Each row links to `/refinance?id=<uuid>` to load it back into the calculator.
- Delete button per row (with confirm).
- "New property" button → `/refinance` (blank).
- Empty state when nothing saved yet.

## Nav

Add a `Properties` link to the top nav in `__root.tsx` next to Refinance / BRRR.

## Data access

Use the browser Supabase client directly from the two pages (simpler than server functions for a no-auth shared table, and matches the existing client-only calculator). All reads/writes go through `supabase.from('properties')`.

## Out of scope

- Auth / per-user privacy (can layer on later by adding a `user_id` column + RLS scoped to `auth.uid()`).
- Versioning / history of saved snapshots.
- CSV export, sharing links beyond the raw `/refinance?id=…` URL.
