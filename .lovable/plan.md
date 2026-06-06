I found the issue: approved tradesmen are being created in the database, but the directory screen reads `tradesmen` directly from the browser. The table is currently locked to signed-in users, so when the page is loaded without an authenticated session the read fails with `permission denied for table tradesmen`.

Plan:

1. Replace direct browser database calls on the tradesmen page
   - Move directory list, add, edit, and delete actions into TanStack server functions.
   - Keep the service-role access safely server-side so the browser no longer hits table permissions directly.

2. Keep the existing review queue approval flow
   - `approveCandidate` already inserts approved candidates into `tradesmen` successfully.
   - Add stronger error handling for the candidate status update so approval cannot silently half-complete.

3. Refresh the UI after approval
   - After clicking Approve, reload the server-backed directory list and remove the candidate from the queue.
   - Show a clear error toast if either the directory insert or candidate update fails.

4. Validate the result
   - Confirm approved tradesmen already in the table appear in the directory.
   - Confirm no browser-side `permission denied for table tradesmen` error remains.