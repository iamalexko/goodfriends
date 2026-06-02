# Goodfriends — Roadmap

_Living document. Add ideas freely. Companion file: `DESIGN_SYSTEM.md` (design intent & rules). For technical build state see `HANDOFF.md`._

**Priority key:** `P0` now · `P1` next · `Later` (post-validation) · `Idea` (unsorted)
**How to use:** drop new thoughts under **§ Inbox** without worrying about priority; promote them into the prioritized sections when they firm up.

---

## P0 — Now

### Lock down the design system
`DESIGN_SYSTEM.md` is the source of truth. Apply the ink + cream + clay-watermark system across every screen via centralized tokens (`tailwind.config.js` + shared style constants — centralize hardcoded `#FB923C` first so future palette changes are one-line).

- **Blocker to resolve:** liquid-glass-on-buttons feasibility on the current Expo SDK. UIKit liquid glass (`expo-glass-effect`) can't be opacity-animated (the reason the fade-on-scroll header was abandoned). Decide: true glass vs translucent-blur _look_ — before speccing button glass.

---

## P1 — "Make it yours" (personalization theme)

The unifying bet: **ownership drives retention.** These share UI patterns (picker, presets-vs-custom, unlock/curation) and the same payoff — _"this crew is ours."_

### 1. Gamify the Crew page
- Presentation/racing visual for the show-up-rate leaderboard.
- An avatar per crew member.
- **Dress-your-avatar** cosmetics unlocked by events you actually attend (reward loop tied directly to showing up).
- _Note:_ the one screen where playful color is welcome — avatars are content-as-color, so it fits the gallery-wall philosophy rather than breaking it.

### 2. Customization / custom backgrounds
Let users style their event & crew space — a WhatsApp-wallpaper-style background behind a bounded surface, plus curated "event feels."
- **Bound it to one surface** (the Moments/crew area) — never the whole app; chrome elsewhere stays cream.
- **Legibility non-negotiable** — every background sits under a scrim guaranteeing text contrast; bubbles/cards stay solid islands.
- **Curated presets first** (subtle textures/gradients/paper grains that harmonize with ink+cream), **photo upload second.** Presets keep 90% premium by default.
- **Open fork — whose choice?** Per-person/local (WhatsApp model; avoids "who decides" fights, but not a shared identity) vs shared-but-creator-controlled (group-identity statement; needs a permission model). Lean: **shared-creator-controlled for a crew**, **per-person for an individual event.** Decide deliberately.

### 3. Attendance verification _(to explore)_
Planner scans a guest's QR code (or similar) to confirm they showed up — promotes integrity, prevents show-rate gaming.
- **Caution:** scanning adds friction to a casual hangout. Likely frame as _optional / organiser-discretion for higher-stakes plans_, not default. Integrity problem may be small among real friend groups (bigger once public events exist).

---

## Build backlog (from HANDOFF)

_Engineering tasks migrated from `HANDOFF.md`. These are the concrete "finish the port / harden the app" items, distinct from the product bets above._

### Mobile
Core port is ✅ complete (Auth, Home, Plans, Crew, Profile, Create Plan, Plan Detail + Moments, Notifications). Remaining:
- [ ] **Summary screen** — port web `Summary.jsx` (AI monthly recap). The only unported screen; needs the `generate-summary` edge fn wired + the recap UI.
- [ ] **Deep links** — handle `goodfriends://join/...` (invite) and `goodfriends://plan/<id>` cold-start routing.
- [ ] **Push notifications** via `expo-notifications` — the plugin + `aps-environment` entitlement were **removed** to unblock device builds on a free/personal Apple team (can't sign push entitlements). Re-add when on a paid team / EAS Build.
- [ ] **Device tap-through QA** — native photo-picker tap + in-app mutation buttons (RSVP submit, edit save, close attendance, delete, nudge, approve/reject, react) are verified at render + backend level but not via real taps (no sim tap automation). A pass on a physical device closes the loop.
- [ ] **TestFlight distribution** via EAS Build.

### Web + cross-platform
- [ ] **Group invite share UX** — link generation + share sheet beyond raw `/join/:code`.
- [ ] **Push notifications** (web push or Expo push).
- [ ] **Grace pass mechanic** — one missed event doesn't break streak. (Schema note: `member_scores.grace_passes_remaining` already exists, default 2, shown on Profile — mechanic not yet completed.)
- [ ] **Extract data-fetching hooks** (`useGroup`, `useUpcomingPlans`, `useRSVP`) into `@goodfriends/shared`.

---

## Later — only after the core proposition is validated

_Do not build prematurely._

- **Public events** created by users or venues → potential ad-income stream.
- **Subscription tier** for premium Goodfriends features.
- **Public collaborative events.**

---

## § Inbox — unsorted ideas

_Park new thoughts here; promote upward when they firm up._

- _(empty — add freely)_

---

## Done / shipped

_Move items here as they ship, with a date, so the roadmap doubles as a changelog._

- ✅ Mobile core port — Auth, Home, Plans, Crew, Profile, Create Plan, Plan Detail + Moments, Notifications (PRs #17–#37).
- ✅ Native iOS build via `expo prebuild` (replaces Expo Go) — PR #22.
- ✅ NativeTabs Liquid Glass tab bar + always-on frosted AppHeader — PRs #26–#29.
