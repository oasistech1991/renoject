## Problem

The redesigned sidebar only lists 5 destinations (Home, Calculators, Market Deals, Compliance, Pricing), but the homepage grid links to 8 tools. Five routes that exist in the app are not reachable from the new sidebar:

- `/condition` — Renovation Calculator
- `/properties` — View Deals
- `/forecast` — Forecast
- `/tradesmen` — Tradesmen
- `/tokenize` — Tokenize

`/account` is also only reachable via the header email chip when signed in.

## Change

Edit `src/routes/__root.tsx` only — extend `SIDEBAR_ITEMS` so every tool on the homepage has a matching entry under the "Tools" section, in the same order as the homepage grid:

```text
Tools
  Property Calculator   /refinance      Calculator
  Renovation            /condition      Hammer
  Market Search         /market         Search
  View Deals            /properties     Building2
  Forecast              /forecast       LineChart
  HMO Compliance        /hmo-compliance ShieldCheck
  Tradesmen             /tradesmen      Wrench
  Tokenize              /tokenize       Coins

Account
  Pricing               /pricing        Tag
  Account               /account        UserCircle   (only when signed in or admin)
```

Implementation notes:
- Add the new lucide icons (`Hammer`, `Search`, `LineChart`, `Wrench`, `Coins`, `UserCircle`) to the existing `lucide-react` import.
- Replace the single `SIDEBAR_ITEMS` array with two arrays: `TOOL_ITEMS` (rendered under the existing "Tools" header) and `ACCOUNT_ITEMS` (rendered under a new "Account" header above the user footer block). The "Account" entry only renders when `session || isAdmin`.
- Keep the cast pattern (`item.to as "/refinance"`) so TanStack Router's typed `<Link>` stays happy.
- No other files change. Homepage, header, auth, paywall, and SEO are untouched.

## Acceptance

- Sidebar exposes all 8 tool routes plus Pricing, matching the homepage grid 1:1.
- Account link appears in the sidebar only when signed in or admin-unlocked.
- Active-route highlighting still works on each entry.
- Mobile drawer still closes on link click.