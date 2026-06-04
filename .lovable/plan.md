## Goal

After running an HMO compliance check, let the user **save the result** and either:
1. **Attach it now** to an existing saved property, or
2. **Save it standalone** (name only) and **attach later** when the property is set up.

## UX

### On `/hmo-compliance` (after a successful analysis)

A new "Save analysis" card appears under the results with three controls:

- **Label** — free text (defaults to address from location field, e.g. "Selly Oak B29").
- **Attach to** — dropdown:
  - "— Save unattached (link later) —" (default)
  - …list of existing properties (name + source)
- **Save** button → writes the full analysis payload (all 3 scenarios, inputs, reconfiguration suggestions, image thumbnail data URL) to a new `hmo_analyses` row.

After save: toast + the card flips to "Saved ✓ — view in Properties", with a "Save another copy" link to reset.

### On `/properties` (existing page)

Each property row gets a small **"HMO analyses (N)"** chip. Clicking it expands an inline list showing each saved analysis (label, date, headline verdict, "View" link back to `/hmo-compliance` in read-only mode, "Detach" button).

A new top-of-page section **"Unattached HMO analyses"** lists any rows where `property_id IS NULL`. Each has an **"Attach to…"** dropdown of existing properties + a **Delete** button.

### Viewing a saved analysis

Clicking "View" navigates to `/hmo-compliance?analysis=<id>`. The page loads the stored payload, renders the report read-only (inputs panel disabled, "Saved on <date>" banner, "Run new check" button to reset to blank form).

## Schema (one new table + migration)

```sql
create table public.hmo_analyses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete set null,
  label text not null,
  location text,
  inputs jsonb not null,        -- form inputs (target beds, ratios, etc.)
  result jsonb not null,        -- full server-fn response (3 scenarios)
  thumbnail text,               -- small data URL of the floorplan (for the list view)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.hmo_analyses to anon, authenticated;
grant all on public.hmo_analyses to service_role;

alter table public.hmo_analyses enable row level security;
create policy "Public can read hmo_analyses"   on public.hmo_analyses for select using (true);
create policy "Public can insert hmo_analyses" on public.hmo_analyses for insert with check (true);
create policy "Public can update hmo_analyses" on public.hmo_analyses for update using (true) with check (true);
create policy "Public can delete hmo_analyses" on public.hmo_analyses for delete using (true);

create index hmo_analyses_property_id_idx on public.hmo_analyses(property_id);

create trigger hmo_analyses_set_updated_at
  before update on public.hmo_analyses
  for each row execute function public.set_updated_at();
```

Policies mirror the existing `properties` table (public read/write, no auth — consistent with the soft HARTS/TAYLOR gate). `ON DELETE SET NULL` means deleting a property leaves its analyses as "unattached" rather than vapourising them.

Storing the **thumbnail as a data URL** keeps this self-contained (no Storage bucket needed); we'll downscale to ~400px before saving so rows stay small.

## File changes

- **New migration** — creates `hmo_analyses` with grants/policies/trigger above.
- **`src/routes/hmo-compliance.tsx`** —
  - Add "Save analysis" card after results.
  - Load existing properties list via `supabase.from("properties").select("id,name,source")`.
  - On save: downscale `imageBase64` → ~400px data URL, insert row with `inputs`, `result`, `property_id` (or null), `label`.
  - Read `?analysis=<id>` on mount; if present, fetch the row and hydrate `mutation.data` + inputs into read-only mode.
- **`src/routes/properties.tsx`** —
  - Fetch counts grouped by `property_id` from `hmo_analyses`.
  - Add "HMO analyses" chip + expandable list per row, with Detach.
  - Add "Unattached HMO analyses" section at the top with Attach-to dropdown + Delete.

## Out of scope

- No changes to `analyseFloorplan` server fn or the scenario logic.
- No edge functions, no Storage bucket (thumbnail goes inline).
- No multi-user ownership — same public-access posture as `properties` today.

## Open questions (optional — say "go" to take the defaults)

1. **Multiple analyses per property** — assumed yes (history). Want me to cap at 1 most-recent instead?
2. **Auto-name the label** from the location field, or always make the user type it?
3. **Detach behaviour** — soft detach (sets `property_id = null`, keeps the row as "unattached") or delete outright?
