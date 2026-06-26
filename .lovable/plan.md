## Renoject Copilot — global AI assistant

A floating chat button on every authenticated page. One persistent conversation per user. Powered by Lovable AI (`google/gemini-3-flash-preview`) via the AI SDK + AI Gateway. Streams responses, renders markdown, and can take actions via tool-calling.

### 1. Data

New table `copilot_messages` (one conversation per user):
- `id uuid pk`, `user_id uuid (auth.users)`, `role text` ('user'|'assistant'), `parts jsonb` (UIMessage parts), `created_at timestamptz`
- RLS: user can read/insert/delete own rows; `service_role` full access; GRANTs to `authenticated` + `service_role`

### 2. Backend (server function + chat route)

- `src/lib/ai-gateway.server.ts` — shared Lovable AI Gateway provider helper
- `src/routes/api/chat.ts` — POST streaming chat endpoint (`streamText` + `toUIMessageStreamResponse`)
  - Authenticates via bearer token (Supabase user)
  - Loads prior messages for that user, appends incoming, streams response
  - Persists user + assistant messages on `onFinish`
  - System prompt: "You are Renoject Copilot — a UK property development assistant inside the Renoject app. Help with deals, refinance maths, BRRR, HMO compliance, CRM pipeline, portfolio timeline, and navigating the app. Be concise and concrete."
  - Tools registered:
    - `navigate({ path })` — returns a UI hint to route the user (handled client-side)
    - `getMyDeals()` — read user's `properties` + summarised metrics
    - `getPortfolioSnapshot()` — capital settings, free capital, upcoming refis
    - `runRefinance({ purchasePrice, refurb, gdv, rentPm, ... })` — wraps existing refinance maths from `src/lib/refinance.ts`
    - `createCrmLead({ name, source, notes })` — insert into `crm_leads`
    - `draftMessage({ recipient, topic })` — returns draft text (no send)
  - All write tools use `needsApproval` so the user confirms in chat before execution
  - `stopWhen: stepCountIs(50)`

- `src/lib/copilot.functions.ts` — `getHistory`, `clearHistory` server fns (auth middleware)

### 3. Client UI

- `src/components/copilot/CopilotFab.tsx` — floating bottom-right button (orange, MessageCircle icon), hidden on `/auth`
- `src/components/copilot/CopilotPanel.tsx` — slide-in sheet (right side, ~440px wide, mobile = full-screen)
  - Built from AI Elements: `Conversation`, `Message`/`MessageContent`/`MessageResponse`, `Tool` (collapsed), `PromptInput` + `PromptInputTextarea` + `PromptInputFooter` + `PromptInputSubmit`, `Shimmer` for "Thinking…"
  - Uses `useChat` with `DefaultChatTransport('/api/chat')`, single chat id = `copilot-${userId}`, loads `getHistory` on mount
  - "New conversation" button → `clearHistory` then resets messages
  - Quick-action chips on empty state: "Run a refinance", "Show my deals", "Where do I add a lead?", "Summarise portfolio"
  - Tool approvals rendered inline (Approve / Reject buttons for `needsApproval` tools)
- Install: `bunx ai-elements@latest add conversation message prompt-input tool shimmer`
- Mount `<CopilotFab />` in `src/routes/__root.tsx` (inside auth-aware wrapper so it shows for signed-in users on any route)

### 4. Identity

- Generate a small Renoject Copilot mark (orange circular badge with "R" monogram) for the FAB / assistant avatar — not the generic Sparkles icon

### Technical notes
- `LOVABLE_API_KEY` already configured
- Bearer attached via existing `functionMiddleware` in `src/start.ts`
- AI Gateway run-id header forwarded via `withLovableAiGatewayRunIdHeader`
- All AI calls server-side; no key in client
- Surface 402 (credits) / 429 (rate limit) errors as toasts

### Out of scope (for now)
- Threaded conversation history (single ongoing chat as chosen)
- Voice input
- File/image attachments in chat (can add later)
