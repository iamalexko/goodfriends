# CLAUDE.md — read this first, every session

_This file and `AGENTS.md` are kept in sync — they carry the same instructions for different toolchains (Claude Code reads `CLAUDE.md`; Codex/Cursor/others read `AGENTS.md`). **If you edit one, edit the other.** All depth lives in the three docs they point to, so changes here should be rare._

You are working on **Goodfriends** — a social commitment app for a Dubai friend group.
Plans → RSVPs → attendance scoring → leaderboard. The "race" between members is the core game mechanic; reliability is the metric. Positioning: "Partiful, but you also have a show-up-rate leaderboard for your crew."

## Read before writing any code (in order)
1. **HANDOFF.md** — technical build state: stack, file layout, schema, gotchas. Ground truth for *how things work*.
2. **DESIGN_SYSTEM.md** — design intent & rules. Consult before ANY UI/visual change.
3. **ROADMAP.md** — what to build, priorities (P0/P1/Later), and an idea inbox.

These three files are the project's durable memory. Treat them as authoritative over your own assumptions.

## Hard rules (each of these has broken the app before)
- **Mobile `Pressable` styles MUST be static objects** — never `style={({pressed}) => ({...})}` (drops bg/border/flexDirection on iOS in this SDK).
- **Cards use solid `#FFFFFF`, never translucent** — translucent fills vanish on the cream `#FFFBF5` body. Use solid white + a real shadow.
- **Plus Jakarta Sans tops at 800 ExtraBold** — importing a 900 weight poisons `useFonts` and falls everything back to system fonts.
- **Web preview lies** about translucency, shadows, and `Pressable` — always verify in the iOS Simulator before trusting it.
- **Phosphor icons only** (`phosphor-react-native`) — never reintroduce Ionicons. SF Symbols only inside `NativeTabs`.
- **No react-router** — web uses a custom switch-based router in `App.jsx`. Don't add `<Routes>`.
- **Edge functions:** keep `send-reminders` at `verify_jwt: false` (redeploy with `--no-verify-jwt`); keep `generate-summary` at `verify_jwt: true`.
- See HANDOFF.md "Gotchas" for the full list — this is only the top of it.

## Design north star
Ink (`#111`) + cream (`#FFFBF5`) carry ~95% of the chrome. **Color comes from user content** (emojis, covers, photos, avatars), not the UI. **Clay `#E2683F` is a rare signature** (logo smile, one accent per screen) — don't paint the UI with it. Status by ink weight, not hue. Full rules in DESIGN_SYSTEM.md.

## ⚠️ The write-back contract (this is part of the job, not optional)
**These docs only stay good because every agent before you wrote down what they learned.** That is the single reason onboarding is fast and the same bugs don't recur. You inherit that memory; you are expected to add to it. An agent who ships code but leaves no trace has done half the job — the next agent (or the next session of you) starts blind.

So, as you work and especially before you finish:
- Changed *how something works*? → update **HANDOFF.md**.
- Hit a non-obvious gotcha, footgun, or "I wish I'd known that"? → add it to HANDOFF.md "Gotchas" **in the same change**, while it's fresh. Don't trust yourself to remember later.
- Made a design decision or established a rule? → update **DESIGN_SYSTEM.md**.
- Shipped a roadmap item? → move it to ROADMAP.md "Done" with a date. New idea surfaced? → drop it in ROADMAP.md "§ Inbox".
- A learning future agents need *before* they touch anything? → it's a hard rule; add it to **both** CLAUDE.md and AGENTS.md.

Treat this like leaving a note for a teammate who can't ask you questions — because that's exactly what it is. Write for the agent who arrives after you with zero context.

Keep the three docs in sync; each owns a different thing (see their headers). Keep THIS file short — it loads into every session; depth belongs in the docs it points to.

## Repo facts
- Monorepo (npm workspaces): `apps/web` (Vite+React, production), `apps/mobile` (Expo SDK 54), `packages/shared`.
- Supabase project ref: `ligemjbtjpqmrrwyiiyu`.
- Mobile dev loop: `npx expo start` for JS edits; `npx expo run:ios` only when native config changes. Full loop in HANDOFF.md.
