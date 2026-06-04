## Goal

Drop the Google OAuth sign-in flow and replace it with a simple username + password gate (`HARTS` / `TAYLOR`) that unlocks the whole app.

## Security caveat (acknowledge once)

Credentials in client code are visible to anyone who inspects the bundle. This is a soft gate, not authentication. Real users / per-user data / RLS are not changed by this — the Supabase backend is untouched. If you ever need real protection, switch to email+password Supabase auth.

## Changes — `src/routes/__root.tsx` only

1. **Remove Google sign-in**
   - Delete the `handleGoogle` function and the "Continue with Google" button.
   - Drop the `import { lovable } from "@/integrations/lovable"` import (no longer used).

2. **Replace `AuthGate` session logic**
   - Remove the `supabase.auth.getSession()` + `onAuthStateChange` wiring (no Supabase session is needed for this gate).
   - Track unlock state with `useState(false)` initialised from `sessionStorage.getItem("hh_unlocked") === "1"` so a refresh inside the same tab stays signed in but closing the tab requires re-entry.

3. **Rewrite `SignInScreen`**
   - Two inputs: Username + Password, plus a Sign-in button.
   - On submit: if `username.trim().toUpperCase() === "HARTS"` and `password === "TAYLOR"`, set `sessionStorage.hh_unlocked = "1"` and flip the unlocked state. Otherwise show "Invalid credentials".
   - Keep the existing HARTSTONE HOLDINGS card styling.

4. **TopNav sign-out**
   - Replace `onSignOut={() => supabase.auth.signOut()}` with a handler that clears `sessionStorage.hh_unlocked` and flips state back to locked.
   - Drop the user-email display in the nav (no email to show); keep the Sign out button.

## Out of scope

- No Supabase auth changes, no removal of `supabase` from the rest of the app (other files still use it for data calls — leaving those alone).
- No `_authenticated/` route restructure.
- No removal of the Google provider in the Lovable Cloud backend (irrelevant once the UI no longer uses it; can be disabled later from settings if you want).
