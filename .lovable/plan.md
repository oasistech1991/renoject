## Plan

1. **Restore the missing backend grants**
   - Add explicit access grants for the Deals-related tables that currently have none through the app API:
     - `properties`
     - `property_media`
     - `hmo_analyses`
     - `subscriptions`
   - Keep access restricted to signed-in users where the current security rules require it.

2. **Keep Deals shared for signed-in users**
   - Confirm `properties`, `property_media`, and `hmo_analyses` stay readable/manageable by authenticated users, matching the existing shared workspace design.
   - Do not re-open these tables to anonymous users.

3. **Fix subscription lookup permissions**
   - Grant signed-in users the minimum access needed to read their own subscription status.
   - Keep the existing row security rule so users can only see their own subscription row.

4. **Verify after migration**
   - Re-check table grants and policies.
   - Confirm the Deals page query should return rows for a signed-in entitled user instead of throwing a permission error.

## Technical details

The query showed no `role_table_grants` for the affected tables, which causes Data API errors like `permission denied for table ...` even when row-level security policies are correct. The fix is a database migration adding the missing grants without weakening the existing RLS policies.