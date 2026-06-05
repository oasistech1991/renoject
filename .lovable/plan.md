## Goal
Add a "View system prompt" button on the HMO Compliance page that lets the user read the full AI rules used for the floorplan calculation.

## Changes

1. **Extract the system prompt** (`src/lib/hmo.functions.ts`)
   - Move the inline `system` string (lines 112-159) into an exported constant (e.g. `export const HMO_SYSTEM_PROMPT = \`...\``)
   - Reference that constant inside the `.handler()` so the server function still works identically.

2. **Create a server function to expose it** (`src/lib/hmo.functions.ts`)
   - Add a new `createServerFn({ method: "GET" })` named `getSystemPrompt` with no input.
   - It returns the exported prompt string.

3. **Add UI button + dialog** (`src/routes/hmo-compliance.tsx`)
   - Place a small "View system prompt" text button/link near the existing "Run new check" / header area.
   - Use a modal/dialog (re-use existing shadcn Dialog if available, otherwise a simple expandable panel) to show the prompt text in a scrollable `<pre>` or styled text block.
   - Fetch the prompt on button click via `useServerFn(getSystemPrompt)`.

## Scope
- No changes to the AI calculation logic.
- No database changes.
- Read-only feature for transparency.