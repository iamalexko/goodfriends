# Goodfriends

A social commitment app for a Dubai friend group. Make plans, RSVP, and track who actually shows up — the "race" between members on their show-up rate is the core game mechanic, and reliability is the score. Think: **Partiful, but with a show-up-rate leaderboard for your crew.**

The web app is live in production; the iOS app (React Native / Expo) is feature-complete.

---

## 🤖 Working on this with an AI agent?

**Read `CLAUDE.md` (Claude Code) or `AGENTS.md` (Codex / Cursor / others) first** — they're synced twins that onboard you and point to the deep docs. The project keeps its knowledge in version-controlled files, and **every agent is expected to write learnings back** into them (see the "write-back contract" in either file). That habit is why onboarding is fast and the same bugs don't recur — please keep it alive.

Doc map:
- **CLAUDE.md / AGENTS.md** — agent entry points (read first, every session).
- **HANDOFF.md** — technical build state: stack, file layout, schema, gotchas.
- **DESIGN_SYSTEM.md** — design intent & rules (consult before any UI work).
- **ROADMAP.md** — priorities (P0/P1/Later) + an idea inbox.

---

## What's in here

Monorepo (npm workspaces):

- **`apps/web`** — Vite + React, the production web app.
- **`apps/mobile`** — Expo SDK 54 / React Native, native iOS build.
- **`packages/shared`** — platform-agnostic constants + utils (`@goodfriends/shared`).
- **`supabase/`** — edge functions + schema reference.

Backend is Supabase (Postgres, RLS, Realtime, Edge Functions, Storage, cron). Web hosting is Vercel (auto-deploys from `main`).

---

## Run it locally

Install everything from the repo root:

```bash
npm install
```

### Web

```bash
npm run web          # → http://localhost:5173
```

Needs `apps/web/.env`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### Mobile (iOS)

```bash
cd apps/mobile
npx expo start       # JS-only iteration — fast reload in the installed dev build (press `i`)
```

When native config changes (`app.json`, permissions, native deps, icons), rebuild:

```bash
npx expo run:ios     # ~5–10 min
```

First time building mobile:

```bash
cd apps/mobile
npx expo prebuild --platform ios --clean   # generates ios/
npx expo run:ios
```

Needs `apps/mobile/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

> Anon/publishable keys and the Supabase project ref are in `HANDOFF.md`. Full dev loop, simulator tips, and build-environment gotchas (CocoaPods version, UTF-8 locale, etc.) are documented there too.

---

## A few things that have bitten people

A short taste — the full list lives in `HANDOFF.md` "Gotchas":

- **Mobile `Pressable` styles must be static objects**, not `({pressed}) => ({...})` (drops styles on iOS in this SDK).
- **Cards use solid white, never translucent** (translucent vanishes on the cream background).
- **Web preview lies** about translucency/shadows/`Pressable` — verify in the iOS Simulator.
- **Plus Jakarta Sans only goes to 800** — importing a 900 weight breaks `useFonts`.

---

## Links

- **Live web:** https://goodfriends-git-main-alex-ko-projects.vercel.app
- **Repo:** https://github.com/iamalexko/goodfriends
