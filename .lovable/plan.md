## WhatsApp Integration — Phase 1 (build now) + Phase 5 scaffold

### Phase 1 — "Broadcast to WhatsApp" (build now)

Add a one-click share button that team members can use to push any deal from the feed straight into the Renoject WhatsApp business channel/group, with a branded caption and a trackable deep link back to the feed.

**Where it appears**
- `PostSheet` modal header (primary CTA next to existing actions)
- Each feed card in `src/routes/feed.tsx` (icon button on the card footer)
- Admin-only — gated by `useWorkspaceMode === "team"` + admin role

**Caption template (auto-generated per deal)**
```
🏠 {dealType} — {town}
{headline metrics: price · beds · ROI · cashflow}
{short teaser from caption, max 240 chars}

👉 View full breakdown: {short link}
```
Built from `feed_posts` + linked `properties` row. Respects `hidden_fields` (won't leak hidden price/address).

**Trackable deep link**
- Route: `/feed/p/{postId}?src=wa&c={campaignId}`
- New table `feed_share_links` (id, post_id, channel, campaign_id, created_by, click_count, created_at)
- Lightweight server fn `recordShareClick` fires on landing → increments click_count
- Attribution surfaces on the deal's PostSheet ("12 WhatsApp clicks · 3 interests from WhatsApp")

**Share mechanics**
- Uses `wa.me/?text=` (no API key needed, works on web + mobile)
- Two buttons in a small popover: **Share to channel** (copies caption + opens WhatsApp) and **Copy caption only**
- Optional: pre-fill a group via `wa.me/{number}?text=` if user saves a default group number in profile settings

---

### Phase 5 scaffold — WhatsApp-first lead capture (wire foundations, don't activate)

Set up the data + UI shell so flipping it on later is a small change, not a rebuild:

- Add `whatsapp_number` (nullable) + `whatsapp_opt_in` (bool) columns to `client_profiles`
- Add an optional WhatsApp field on `/profile` and on the `feed_interest` flow ("We'll only message you about deals matching your criteria")
- Add `lead_source` enum value `whatsapp` to `crm_leads` (already supports source — just add option)
- Add a placeholder admin setting `whatsapp_business_number` in profile preferences (used by Phase 1 group share AND future API)

No outbound API integration yet — that needs WhatsApp Business Cloud API approval (Meta Business verification, ~1-2 weeks). When ready, we swap the `wa.me` link for a server-side `sendTemplateMessage` call against the same captured numbers.

---

### Files touched

- **New:** `src/components/feed/ShareToWhatsAppButton.tsx`, `src/lib/whatsapp-share.ts` (caption builder + link helpers), `src/lib/share.functions.ts` (recordShareClick server fn)
- **Migration:** create `feed_share_links` table with GRANTs + RLS; add `whatsapp_number`, `whatsapp_opt_in` to `client_profiles`
- **Edit:** `src/routes/feed.tsx` (card button), `src/components/feed/PostSheet.tsx` (header CTA + attribution stat), `src/routes/profile.tsx` (WhatsApp field), `src/routes/feed_.$postId.tsx` or equivalent landing handler (track `?src=wa`)

### Out of scope (Phase 2-4, for later)
- Branded PNG card generator with QR
- Two-way sync via WhatsApp Business Cloud API
- Unified inbox merging DMs + WhatsApp threads
