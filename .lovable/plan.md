## Combined scope (three pending requests)

**A. Media gallery above the deal title** — swipeable carousel of images + videos on each feed card and in the detail sheet.

**B. Required metric tiles** on every card:

| Label | Source |
|---|---|
| PP | `inputs.purchasePrice` |
| Refurb | `inputs.refurbCost` |
| End value | `inputs.gdv` |
| Rent | `inputs.monthlyRent` |
| Net cashflow | `metrics.monthlyCashflowIO` |
| ROI | `metrics.roiOnCashLeftIn` |

Relabel `GDV` → `End value` and `Monthly CF` → `Net cashflow`; add a `Rent` tile. Keep `Cash left in` and the `full`-mode extras (`New loan`, `Profit on paper`). `PP` / `Refurb` still respect the hidden-fields toggle.

**C. Colour-coded deal-type badge** displayed on the card image (top-left corner) and listed in the detail sheet header.

Deal types and colours:

| Type | Badge colour |
|---|---|
| Buy to Let | emerald |
| Turn Key | sky |
| Off-Market | amber |
| Mixed Use | violet |
| HMO | rose |
| BRR / Flip | orange |
| Other | slate |

The colour palette is added as semantic tokens in `src/styles.css` (e.g. `--deal-btl`, `--deal-turnkey`, …) so the badge respects the design system, not hard-coded utilities.

## Backend changes

- Add `deal_type` (text) column to `feed_posts`. Allowed values stored as a Postgres `CHECK` or plain text plus a TypeScript union; default `null` (renders as "Other"). No new tables, no RLS changes — existing `feed_posts` policies still cover it.

## Frontend changes (all in `src/routes/feed.tsx`)

- Load every `property_media` row for posted properties, sign URLs, group by property → new `media` field on `FeedPost`.
- New `DealMediaGallery` component: snap-scroll carousel, `<img>` for images, `<video controls preload="metadata" playsInline>` for videos, dot indicators, "n / total" chip, falls back to `cover_resolved` then to a neutral placeholder. Used in `PostCard` (above title) and `PostSheet` (top of body).
- New `DealTypeBadge` component using the semantic colour tokens; rendered as an overlay chip on the gallery and inline in the sheet header.
- Update the `Stat` grid order and labels to match section B.
- Admin `EditPostDialog`: add a deal-type dropdown so admins can set/change the badge per post.

## Out of scope

- Upload UI for new videos (existing media management untouched).
- Surfacing deal types anywhere outside the feed (e.g. on `/properties`).
