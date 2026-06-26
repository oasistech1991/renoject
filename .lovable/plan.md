## Goal
On the Legal Review page, let the user attach the uploaded PDF + AI review to one of their CRM properties (when any exist), so the legal pack lives against the property record.

## UX
After a review completes on `/legal`, show an "Attach to property" card next to the report:
- Searchable Select listing `crm_properties` (address + status).
- If no properties exist: card hidden, replaced by a subtle hint "Add a property in CRM to attach legal packs".
- "Attach" button uploads the PDF to storage and writes a row linking it to the property + review summary.
- After success: badge "Attached to {address}" + link to open the property in CRM.

In `PropertyDetail.tsx`, add a new **Legal** tab listing attached packs (filename, doc type, red-flag count, date, download link).

## Data
New table `crm_property_legal_packs`:
- `property_id` → `crm_properties.id` (cascade)
- `uploaded_by` → `auth.users.id`
- `filename`, `storage_path`
- `document_type`, `summary` (text)
- `red_flag_count` (int), `review_json` (jsonb) — full `LegalReview`

RLS: owner (`uploaded_by = auth.uid()`) or admin. Standard GRANTs.

Storage: reuse existing `property-media` bucket under path `legal/{property_id}/{uuid}-{filename}`. Add a storage policy allowing authenticated upload/read scoped to that prefix (or rely on existing bucket policies if already permissive for authenticated users — verify in implementation).

## Code changes
1. **Migration** — create `crm_property_legal_packs` + policies + grants; add storage policy if needed.
2. **`src/lib/legal-review.functions.ts`** — add `attachLegalPackToProperty` server fn (`requireSupabaseAuth`): accepts `{ propertyId, pdfBase64, filename, review }`, uploads to storage via admin client, inserts row.
3. **`src/routes/legal.tsx`** — after review, fetch user's properties (browser supabase client); render `AttachToPropertyCard`; on submit call new server fn. Keep PDF bytes in state so we can re-upload.
4. **`src/components/crm/property/PropertyDetail.tsx`** — add `Legal` tab that queries `crm_property_legal_packs` for `propertyId`, lists packs with signed-URL download.
5. **`src/components/crm/property/types.ts`** — add `LegalPack` type.

## Out of scope
- Re-running review from the property page (user uploads on `/legal` first).
- Sharing packs with clients in the feed.
