## Goal

A new **Tokenize** tab that visually shows how each property in your portfolio could be turned into a blockchain-backed asset — both as a whole-property NFT deed *and* as fractional shares — and how ownership could be transferred to a new party. Fully interactive, fully simulated. No real chain, no real money, no wallet setup needed. Built so the same UI can later plug into Base / Polygon when you're ready.

## What you'll see in the demo

**1. Portfolio → Token vault**
- Pulls every row from your existing `properties` table.
- Each property gets a "token card" with: a generated deed image (address + postcode + a hash that looks like a real on-chain token ID), current owner wallet, mint status, fraction status.
- Status badges: `Unminted` · `Deed minted` · `Fractionalized` · `Listed for transfer`.

**2. Mint Deed (whole-property NFT)**
- Click *Mint Deed* on any unminted property → animated modal showing:
  - Metadata being assembled (address, EPC, sqft, GDV, photos).
  - A fake "broadcasting to Base" progress bar.
  - A token ID + transaction hash appearing.
- Result: card flips to show the deed certificate with QR code and a "View on explorer" link (opens a styled fake explorer page inside the app).

**3. Fractionalize (ERC-20-style shares)**
- On any minted deed, click *Fractionalize* → choose total supply (e.g. 1,000 / 10,000 / 100,000 shares) and price per share (auto-suggested from GDV ÷ supply).
- Animation: the deed slides into a vault, shares spray out into a grid.
- Card now shows: shares outstanding, price/share, implied valuation, mini cap-table of holders.

**4. Transfer to new party**
- Two flows side by side:
  - **Whole transfer** — pick a property, enter recipient (wallet address or email), animate the NFT moving from your wallet to theirs. Ownership history log updates.
  - **Sell shares** — pick a fractionalized property, choose quantity + recipient, see cap-table update live.
- Every transfer writes a row to a new `token_transfers` table so it's auditable inside the app.

**5. Investor view**
- A secondary tab showing the same vault from a *buyer's* perspective: browse fractionalized properties, see yield + GDV + share price, hit "Buy shares" to simulate a purchase.
- This is the bridge to a future real marketplace.

## Layout

```text
┌────────────────────────────────────────────────────────┐
│  Tokenize                          [Owner] [Investor]  │
├────────────────────────────────────────────────────────┤
│  Vault summary: 12 properties · 4 minted · 2 fract'd   │
│  Total GDV £4.2M · Shares outstanding 28,000           │
├────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Deed     │  │ Vault    │  │ Unminted │   ← cards    │
│  │ #0x4a..  │  │ 10,000 sh│  │ Mint →   │              │
│  │ Transfer │  │ Buy/Sell │  │          │              │
│  └──────────┘  └──────────┘  └──────────┘              │
├────────────────────────────────────────────────────────┤
│  Activity feed: latest mints, transfers, share sales   │
└────────────────────────────────────────────────────────┘
```

## Technical approach (for reference)

- **Route**: new `src/routes/tokenize.tsx` + nav link.
- **DB tables** (new):
  - `tokens` — property_id, token_id (fake hash), chain (default `base-sim`), owner_wallet, minted_at.
  - `token_fractions` — token_id, total_supply, price_per_share_pence.
  - `token_holdings` — token_id, holder (wallet or email), shares.
  - `token_transfers` — token_id, from, to, amount, tx_hash, created_at.
- **Wallet simulation**: each signed-in user auto-gets a deterministic fake address `0x` + hash(user_id); recipients are free-text (address or email).
- **Tx hashes / token IDs**: generated client-side via `crypto.randomUUID()` formatted as `0x…`.
- **Explorer page**: styled internal route `/tokenize/tx/:hash` that shows from/to/amount/timestamp like Etherscan.
- **No external dependencies** in v1 — no wagmi, no viem, no wallet connect. Adding real chain support later is a swap of the simulated mint/transfer functions for `viem` calls.

## Out of scope for v1 (called out so we can sequence it)

- Real on-chain deployment (Base / Polygon) — separate follow-up once you pick the chain.
- Real wallet connect (MetaMask / Privy embedded wallets).
- KYC / SPV legal wrapper — flagged with disclaimer banner: *"Demo only — tokens do not confer legal title."*
- Stripe / fiat onramp for share purchases.

## After this ships

Once you've used the demo and decided it's the right model, the natural next steps are:
1. Pick chain (recommended: **Base** — low fees, good RWA tooling).
2. Add wallet connect (recommended: **Privy** — email login auto-creates a wallet, smooth for non-crypto users).
3. Deploy real ERC-721 + ERC-20 contracts (OpenZeppelin templates).
4. Layer in KYC + SPV legal structure before any real-money transfers.
