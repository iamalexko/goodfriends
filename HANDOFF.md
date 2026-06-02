# Goodfriends — Project Handoff

A social commitment app for a friend group in Dubai. Plans → RSVPs → attendance scoring → leaderboard. The "race" between members is the core game mechanic; reliability is the metric.

**Status (2026-06):** Web app is live in production. The **mobile port is feature-complete** — every web screen has a native iOS equivalent except the AI monthly recap (`Summary.jsx`), which is deliberately deferred. See [Mobile app → Status by phase](#status-by-phase) and [Roadmap](#roadmap).

---

## Stack

Monorepo, npm workspaces:

- **`apps/web`** — Vite + React 18 (JS, no TypeScript), Tailwind CSS, Framer Motion, lucide-react. `react-router-dom` is in deps but **not used** — see Routing.
- **`apps/mobile`** — Expo SDK 54, Expo Router (file-based), React Native 0.81.5, Hermes, NativeWind v4 wired (most components use inline `style` objects), native iOS build via `expo prebuild` + `expo run:ios`.
- **`packages/shared`** — platform-agnostic constants (`COLORS`, `RSVP_OPTIONS`, `EMOJIS`) + utils (`getMemberTags`, `getGroupTags`, `getTimeTag`, `formatTimeAgo`, `getPriorityScore`). Consumed via `@goodfriends/shared`.
- **Backend**: Supabase (Postgres 17, RLS, Realtime, Edge Functions, Storage, pg_cron)
- **Hosting (web)**: Vercel auto-deploys from `main`, root `vercel.json` builds `apps/web/`
- **Mobile distribution**: local native build for now (no TestFlight / EAS yet)
- **Repo**: https://github.com/iamalexko/goodfriends (public)
- **Live web URL**: https://goodfriends-git-main-alex-ko-projects.vercel.app

## Run locally

```bash
# install everything (web + mobile + shared)
npm install
```

**Web:**
```bash
npm run web              # or: cd apps/web && npm run dev
# → http://localhost:5173
```
Requires `apps/web/.env`:
```
VITE_SUPABASE_URL=https://ligemjbtjpqmrrwyiiyu.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_hhoJDZ5D-V_rtcsbMPrSGA_rBSmvq1t
```

**Mobile** (see the dedicated [Mobile app](#mobile-app-appsmobile) section for the full dev loop):
```bash
cd apps/mobile
# JS-only iteration (fast — bundle reloads in the already-installed native app)
npx expo start
# Native rebuild (5-10 min, only when app.json / native deps / permissions change)
npx expo run:ios
```
Requires `apps/mobile/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://ligemjbtjpqmrrwyiiyu.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_hhoJDZ5D-V_rtcsbMPrSGA_rBSmvq1t
```

If you've never built mobile before:
```bash
cd apps/mobile && npx expo prebuild --platform ios --clean   # generates apps/mobile/ios/
npx expo run:ios                                              # first build ~5-10 min
```

`.claude/launch.json` has a hardcoded node path — committed but environment-specific. Update or ignore for your env. Defines `expo-web` server config for Claude Preview MCP (see [Mobile app](#mobile-app-appsmobile)).

---

## File layout

```
/
├── apps/
│   ├── web/                ← Vite + React, the production app
│   │   ├── src/
│   │   │   ├── App.jsx                 ← root + custom switch-based router
│   │   │   ├── main.jsx                ← entry
│   │   │   ├── index.css               ← design tokens, .phone-shell, .orb,
│   │   │   │                              .glass-card, .scroll-area
│   │   │   ├── lib/supabase.js         ← Vite-flavoured client (import.meta.env)
│   │   │   ├── context/AuthContext.jsx ← session + profile + useAuth()
│   │   │   ├── components/UI.jsx       ← TopBar, NavBar, EmojiAvatar, Pill,
│   │   │   │                              BackButton, SectionHeader, Divider, Orb,
│   │   │   │                              StatCell, Loader
│   │   │   └── screens/                ← Auth, Home, Crew, CreatePlan, PlanDetail,
│   │   │                                  Plans, Profile, Summary, Notifications,
│   │   │                                  JoinPage
│   │   ├── index.html, vite.config.js, tailwind.config.js, postcss.config.js
│   │   └── package.json   (name: "@goodfriends/web")
│   │
│   └── mobile/             ← Expo SDK 54, native iOS build via expo prebuild
│       ├── app/                  ← Expo Router file-based routes
│       │   ├── _layout.tsx       ← fonts + AuthProvider + StatusBar + GestureHandler
│       │   ├── index.tsx         ← auth gate redirect
│       │   ├── auth.tsx          ← login + signup toggle
│       │   └── (tabs)/
│       │       ├── _layout.tsx   ← bottom tab bar
│       │       ├── home.tsx      ← real, ports apps/web/.../Home.jsx
│       │       ├── crew.tsx      ← placeholder
│       │       ├── create.tsx    ← placeholder (Phase 3)
│       │       ├── plans.tsx     ← real, Upcoming/Past tabs
│       │       └── profile.tsx   ← real, hero + stats + history + emoji picker
│       ├── components/           ← TopBar, NavBar, Pill, EmojiAvatar,
│       │                            BackButton, SectionHeader, Loader,
│       │                            PlanCard, CrewPill, EmojiPicker, StatCell,
│       │                            PlaceholderScreen
│       ├── context/AuthContext.tsx
│       ├── lib/supabase.ts       ← Platform-split: SecureStore (native) / localStorage (web)
│       ├── ios/                  ← GITIGNORED — regenerated by expo prebuild
│       ├── app.json, babel.config.js, metro.config.js,
│       │   tailwind.config.js, global.css, tsconfig.json
│       └── package.json   (name: "@goodfriends/mobile")
│
├── packages/
│   └── shared/             ← platform-agnostic; consumed via @goodfriends/shared
│       ├── index.js        ← barrel
│       ├── constants.js    ← COLORS, TIER_*, RSVP_OPTIONS, EMOJIS, MEMBER_GRADIENTS
│       ├── utils/scoring.js  ← getMemberTags, getGroupTags
│       └── utils/time.js     ← getTimeTag, formatTimeAgo, getPriorityScore
│
├── supabase/
│   ├── functions/send-reminders/index.ts   ← daily reminders + nudges (cron, no auth)
│   ├── functions/generate-summary/index.ts ← Gemini 2.5 Flash recaps (user, JWT)
│   └── config.toml                         ← project id + cron schedule
├── supabase-schema.sql                     ← committed schema for reference
├── vercel.json                             ← root: builds apps/web/ + SPA rewrite
├── package.json                            ← workspace root, hoists react-native + semver
└── .claude/launch.json                     ← Claude Preview servers (vite-dev, expo-web)
```

---

## Routing

### Web (`apps/web`)

**There is no react-router**, despite the dep. `App.jsx` keeps `screen` in state and renders via a `switch`. Navigate by calling `navigate(id, params)` passed from `App` into every screen. Params land as props.

```jsx
case 'home':          return <Home {...props} />
case 'crew':          return <Crew {...props} />
case 'create':        return <CreatePlan {...props} />
case 'plan-detail':   return <PlanDetail {...props} />
case 'plans':         return <Plans {...props} />
case 'profile':       return <Profile {...props} />
case 'summary':       return <Summary {...props} />
case 'notifications': return <Notifications {...props} />
```

To add a screen: create the file, add an import + case in `App.jsx`, navigate from anywhere via `navigate('your-screen-id')`.

**Special path**: `/join/:code` is handled in `App.jsx` before auth gating — public link for invite redemption.

### Mobile (`apps/mobile`)

**Expo Router**, file-based. Anything in `app/` is a route. Folders in parens like `(tabs)/` are route groups (don't appear in URLs).

```
/                → app/index.tsx          (auth gate → /auth or /(tabs)/home)
/auth            → app/auth.tsx           (login + signup toggle)
/(tabs)/home, /crew, /plans, /profile     (NativeTabs — 4 tabs)
/create          → app/create.tsx         (two-step Create Plan, root Stack modal)
/plan/[id]       → app/plan/[id].tsx       (Plan Detail: view·RSVP·organiser actions·Moments)
/notifications   → app/notifications.tsx   (in-app feed; opened from the AppHeader bell)
```

`create`, `plan/[id]`, and `notifications` live **outside** the `(tabs)` group (they're pushed on the root Stack, so no tab bar). Open Plan Detail with `router.push('/plan/' + id)`.

Navigate with `useRouter()`:
```tsx
import { useRouter } from 'expo-router'
const router = useRouter()
router.push('/(tabs)/home' as any)
router.replace('/auth' as any)
```

**Critical**: after sign in or sign up, **explicitly call `router.replace('/(tabs)/home')`**. The auth gate at `app/index.tsx` only runs when someone hits `/` — sitting on `/auth` after auth success doesn't bounce you anywhere. (Discovered and fixed in PR #20.)

---

## Auth

`AuthContext` provides `{ user, profile, loading, updateProfile, fetchProfile }`. `useAuth()` is the only consumer pattern. Inside event handlers (where stale-closure of `user` would be a risk), most code re-fetches via `supabase.auth.getUser()` rather than reading from context.

**Profile** is a separate `profiles` row keyed on `auth.users.id`. Display name and emoji live there.

---

## Database

### Tables (see `supabase-schema.sql` for full DDL)

| Table | Purpose |
|---|---|
| `profiles` | user metadata (display_name, emoji) |
| `groups` | crews |
| `group_members` | who's in which crew |
| `plans` | events (tier 1/2/3, status: open\|closed) |
| `rsvps` | per-plan per-user status (`in` \| `likely` \| `no` \| null) |
| `attendances` | per-plan per-user `came: bool` after close |
| `member_scores` | denormalised per-member stats (attendance_rate, plans_organised, streak) |
| `posts` | moments feed entries (type: `photo` \| `comment`) |
| `reactions` | emoji reactions on posts |
| `notifications` | in-app notification feed |
| `summaries` | cached AI monthly recap, keyed `(group_id, year_month UNIQUE)`. Stores `headline`, `subtitle`, `moments jsonb`, `model` |

### Notification system (already wired)

- `notifications` table with RLS (`auth.uid() = user_id`)
- `create_notification(p_user_id, p_type, p_title, p_body, p_plan_id, p_actor_id)` RPC — security definer, no-ops if user == actor
- Realtime publication enabled — bell badge subscribes via `postgres_changes` INSERT filter
- **Types**: `event_invite`, `event_rsvp`, `event_comment`, `event_closed`, `event_cancelled`, `event_reminder`, `event_filling`, `no_reply_nudge`, `photo_posted`, `reaction_received`, `event_invite_request`, `event_request_approved`, `event_request_rejected`
- **Where fired** (web `PlanDetail.jsx` and the mobile `app/plan/[id].tsx` fire the same set 1:1):
  - `CreatePlan.jsx` / `app/create.tsx` → invite
  - PlanDetail: setRsvpStatus → rsvp (+ filling on web), deletePlan → cancelled, closeEvent → closed, submitPost → comment/photo, toggleReaction → reaction, nudgeMember → invite (poke), requestInvite → invite_request, decideInviteRequest → request_approved/rejected
  - `send-reminders` edge fn → reminder + no-reply (daily 5 UTC via pg_cron)

### Monthly summary system (already wired)

- `summaries` table with read-only RLS (only group members can see their crew's recaps)
- `generate-summary` edge function: pulls a month of plans/rsvps/attendances/posts for a crew, sends to **Gemini 2.5 Flash** with a `responseSchema` and stores the JSON in `summaries` keyed by `(group_id, year_month)`
- `verify_jwt: true` — caller must be authenticated *and* a member of the group
- Cache hit on subsequent calls is ~500ms; force regeneration via `{ force: true }` body field
- CORS handled for browser callers (preflight + headers on all responses)
- Thinking is **explicitly disabled** (`thinkingConfig.thinkingBudget: 0`) — Gemini 2.5 Flash thinks by default and the thinking tokens would eat the `maxOutputTokens` budget before the structured JSON finishes
- Requires `GEMINI_API_KEY` set as a Supabase Functions secret. Get a free key at https://aistudio.google.com/app/apikey
- Surfaced in `Summary.jsx` — replaces the previously hardcoded "Most fun / embarrassing / heartfelt" blurbs

### RPCs that exist (besides `create_notification`)

- `join_group_by_invite(p_invite_code)`
- `add_points(p_user_id, p_group_id, p_points)`
- `recalculate_member_score(p_user_id, p_group_id)`

### Storage

- Bucket `plan-photos` — **public** bucket, path format `<userId>/<planId>-<timestamp>.<ext>`.
- RLS: anyone can `SELECT`; any authed user can `INSERT`; `DELETE` only your own (`auth.uid() = foldername[1]`, i.e. the leading `<userId>` path segment). So the public anon key can read but **cannot delete** — deletes must run from an authed client.
- **Web upload** (`PlanDetail.jsx`): `supabase.storage.from('plan-photos').upload(path, file)` with a browser `File`.
- **Mobile upload** (`app/plan/[id].tsx`): `expo-image-picker` returns a `file://` asset → `fetch(uri).then(r => r.arrayBuffer())` → `upload(path, arraybuffer, { contentType })`. This is Supabase's RN-recommended path; do **not** pass a `File`/`Blob` on RN. Verified byte-exact (393,493 in = 393,493 out) — no truncation.
- **No native rebuild needed for the picker** — `expo-image-picker` was already in `package.json` since the first scaffold, so autolinking baked `ExpoImagePicker` into the iOS pods, and the camera/photo `Info.plist` strings already live in `app.json` → `ios.infoPlist`. Photo posting is pure JS on the existing dev build.

---

## Design system

Defined in `src/index.css` and Tailwind config:

- **Body bg**: `#FFFBF5` (warm cream)
- **Ink**: `#111`
- **Primary (orange)**: `#FB923C`
- **Mint**: `#34D399` / `#DCFCE7`
- **Pill colors**: defined in `Pill` component (`tier1/2/3`, `gold`, `orange`, `mint`, `violet`, `pink`, `yellow`, `neutral`, `red`)
- **Fonts**: Plus Jakarta Sans for display headings; Inter for body
- **Cards**: `.glass-card` (frosted, used everywhere)
- **Background**: two `.orb` blurs rendered once at App level (yellow top-right, blue bottom-left)
- **Layout**: `.phone-shell` constrains content to a phone-width column; `md:` breakpoints reserve 220px left sidebar for desktop nav

**Typography conventions:**

- Eyebrows: `font-size: 9px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: #bbb`
- Card titles: Plus Jakarta Sans, font-weight: 800, ~16-22px
- Meta text: `#aaa` (12px) or `#bbb` (9-11px)

---

## Component patterns

- **No Redux/Zustand.** Local `useState` + Supabase + `useAuth`.
- **Optimistic updates** on mutations (see `setRsvpStatus`), with rollback on error.
- **Realtime subscriptions** scoped to a screen lifetime — see `TopBar` notifications subscription and `PlanDetail` posts/reactions subscription. Always `removeChannel` on cleanup.
- **Sheets** (bottom modals): inline JSX with `AnimatePresence` + `motion.div` slide-from-bottom. Examples in `PlanDetail.jsx` (edit, delete, action sheets) and `Home.jsx` (sort).

---

## Deployment

- **Frontend**: Vercel auto-deploys from `main`. Project `prj_C7p5KLh6ijiN8x7ZmqseYmTMXeDF` under team `team_B1Eg7ndc0OyJsy9RfTyPlB2z` ("Alex's projects"). Env vars set in Vercel dashboard.
- **DB migrations**: applied via Supabase MCP or dashboard SQL editor. No tracked migrations folder — `supabase-schema.sql` is the source of truth for initial schema; subsequent changes have been applied directly to prod.
- **Edge functions** (deployed):
  - `send-reminders` — `verify_jwt: false` so pg_cron can hit it without auth. Daily reminders + no-reply nudges.
  - `generate-summary` — `verify_jwt: true`. Caller's JWT is verified and group membership is checked before reading anything.
  - Re-deploy either via `supabase functions deploy <name>` (CLI) or via MCP. Pass `--no-verify-jwt` explicitly when redeploying `send-reminders` from the CLI, or the cron will start 401'ing.
- **Edge-function secrets**: set via `supabase secrets set --project-ref ligemjbtjpqmrrwyiiyu KEY=value` or the dashboard. Currently required:
  - `GEMINI_API_KEY` — for `generate-summary` (Google AI Studio, free tier)
  - (Supabase auto-provides `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` to every function.)
- **Cron**: `pg_cron` job `send-reminders-daily` runs `0 5 * * *` UTC (9am Dubai). Calls the `send-reminders` edge function via `net.http_post`. Manage with `cron.alter_job` / `cron.unschedule` / `cron.job_run_details`. (`generate-summary` is user-triggered only; no cron yet.)

---

## Mobile app (`apps/mobile`)

### Status by phase

**🎉 The mobile port is feature-complete** — every web screen now has a native equivalent. Only the web `Summary.jsx` (AI monthly recap) is unported (deliberately deferred — see Roadmap).

- ✅ **Phase 1** — UI primitives (TopBar, NavBar, Pill, EmojiAvatar, BackButton, SectionHeader, Loader) + full Auth flow (login + signup + onboarding emoji). PR #17.
- ✅ **Phase 2.1** — Home (greeting, CrewPill, sort sheet, plan cards, past plans). PR #18.
- ✅ **Phase 2.2** — Plans (Upcoming/Past tabs) + Profile (hero + stats + history + emoji picker) + EmojiPicker + StatCell. PR #19.
- ✅ Auth-screen post-signin redirect + TopBar error handling. PRs #20, #21.
- ✅ **Native iOS build** via `expo prebuild` — replaces Expo Go for development. PR #22.
- ✅ **Nav chrome** — `NativeTabs` (UIKit-rendered Liquid Glass tab bar) + always-on frosted `AppHeader`. PRs #26–#29.
- ✅ **Phase 3 — Create Plan** (two-step flow, native date/time pickers, crew invite toggles). PR #31.
- ✅ **Phase 3 — Plan Detail** (`app/plan/[id].tsx`), built in three slices:
  - **v1** view + RSVP (PR #32)
  - **v2a** organiser edit + close/attendance (PR #35)
  - **v2b** delete/cancel + nudges + invite-requests (PR #36)
  - **Moments** photo + comment feed (PR #37)
- ✅ **Notifications** screen (`app/notifications.tsx`) — markAllRead on view, tap-through to plan. PR #33.
- ✅ **Crew** leaderboard (Hall of Fame podium + show-up race + tags). PR #34.

### Dev loop

Two modes. Pick by what changed:

**JS-only edits → fast loop** (Fast Refresh, ~2s reload):
```bash
cd apps/mobile && npx expo start
# Press `i` to launch the already-installed native build in the simulator.
# Edit any .tsx — saves, reloads in seconds.
```

**Native config changed → rebuild** (5-10 min):
Triggered by edits to `app.json`, new permissions, new native modules, or new icons.
```bash
cd apps/mobile && npx expo run:ios
```

### Local preview for agents (so you don't need to scan QRs at the user)

Three options, in order of fidelity:

1. **iOS Simulator** (highest fidelity, real iOS rendering, what production runs).
   - Boot once: `xcrun simctl boot "iPhone 17"` then `open -a Simulator`.
   - Screenshot at any time: `xcrun simctl io booted screenshot /tmp/x.png` → then `Read /tmp/x.png` (Claude sees pixels).
   - The native build installs into the sim via `npx expo run:ios`.
   - After JS edits, force the sim to refetch the bundle: `xcrun simctl terminate booted com.goodfriends.app && xcrun simctl launch booted com.goodfriends.app`.

2. **Expo for web** via Claude Preview MCP (`expo-web` config in `.claude/launch.json`).
   - `mcp__Claude_Preview__preview_start({ name: 'expo-web' })` → `preview_resize({ preset: 'mobile' })` → `preview_screenshot`.
   - Good for layout, typography, color tokens.
   - **NOT trustworthy** for translucency, `shadow*` props, or `Pressable` behavior — `react-native-web` re-implements these differently than native iOS.
   - Hot pink debugging trick: temporarily set `backgroundColor: '#FF00FF'` to confirm a style is actually being applied at all (#19 used this).

3. **Physical iPhone** (last resort — slow loop, requires the user).
   - `npx expo start --lan` then `xcrun simctl getenv booted SIMULATOR_HOST_HOME` for the LAN URL, or generate a QR (`npx qrcode-terminal "exp://<lan-ip>:8081"`).
   - User needs same WiFi as the Mac + Local Network permission granted to Expo Go (older sessions) or to the dev-built `Goodfriends` app.

### Icons — Phosphor

**Library**: `phosphor-react-native` (peer dep `react-native-svg`). Standardised here, **no Ionicons** anywhere in mobile.

**Weights**:
- inactive → `regular`
- active → `fill`
- emphasis → `bold`
- on dark backgrounds → `bold` white

**Colours** (`apps/mobile/constants/icons.ts` `ICON_COLORS`):
- active `#111111`
- inactive `#666666`
- muted `#AAAAAA`
- accent `#FB923C`
- inverted `#FFFFFF`

**Sizes** (`ICON_SIZES`): tab `24` · inline `16` · header `18` · empty-state `32`

**Rule**: one weight per context. Never mix `regular` and `fill` in the same row.

**Mapping** for common app icons:

| Usage | Phosphor |
|---|---|
| Home | `House` |
| Crew | `Users` |
| Plus / FAB | `Plus` |
| Plans | `CalendarBlank` |
| Profile | `User` |
| Bell | `Bell` |
| Back | `CaretLeft` |
| Chevron right | `CaretRight` |
| Chevron down | `CaretDown` |
| Close | `X` |
| Check | `Check` |
| Camera | `Camera` |
| Edit | `PencilSimple` |
| Sort | `ArrowsDownUp` |
| Sparkle | `Sparkle` |
| Maximize | `ArrowsOutSimple` |
| Reaction | `Smiley` |
| Trending up | `TrendUp` |
| Alert | `WarningCircle` |
| Message | `ChatCircle` |
| Nudge | `HandWaving` |
| Invite | `UserPlus` |
| Send | `ArrowUp` |
| Clock | `Clock` |
| Photo | `Image` |

Usage:
```tsx
import { House } from 'phosphor-react-native'
<House size={24} color="#666" weight="regular" />   // inactive
<House size={24} color="#111" weight="fill" />       // active
```

### Bottom navigation — `NativeTabs` (UIKit Liquid Glass)

`apps/mobile/app/(tabs)/_layout.tsx`, using `expo-router/unstable-native-tabs`.

- **The tab bar is now rendered by UIKit, not by us.** This gives genuine, free iOS 26 Liquid Glass with the correct scroll-edge behaviour — no custom glass component to maintain.
- 4 tabs: `Home · Crew · Plans · Profile`. `<NativeTabs tintColor="#111111" minimizeBehavior="onScrollDown">` with `<NativeTabs.Trigger>` + `<Icon sf=... />` + `<Label>`.
- ⚠️ Import `Icon` / `Label` from **`expo-router/unstable-native-tabs`** (top-level), NOT `NativeTabs.Trigger.Icon`. Icons are **SF Symbols** (`sf="house.fill"` etc.), not Phosphor — Phosphor SVGs can't render inside the native bar. Crew uses a heart SF Symbol (PR #26).
- There is **no Create tab/FAB in the bar** anymore. "+ Plan" lives in the `AppHeader` and pushes the `/create` modal.
- The old custom `LiquidGlassTabBar.tsx` + `GlassSurface.tsx` are **retired** (GlassSurface still exists but is no longer the nav). `paddingBottom: 120` hacks were removed — NativeTabs reserves its own space.

### Top header — `AppHeader` (always-on frosted glass)

`apps/mobile/components/AppHeader.tsx`, mounted by each `(tabs)/*` screen.

- An **always-on `expo-blur` `BlurView`** (`BLUR_INTENSITY = 85`), NOT iOS 26 `GlassView`. Hard-won: `GlassView`'s lens can't be opacity-animated (blur drops out) and `MaskedView` snapshots it to a static bitmap (kills the live lens), so the scroll-fade/feather approaches all failed. A plain always-visible BlurView is the reliable answer. (Saga across PRs #27–#29.)
- Contains the wordmark, a **"+ Plan"** pill (→ `/create`), and the **bell** with a live unread badge (realtime `notifications` subscription). The old profile button was removed from the header.
- Exposes `APP_HEADER_ROW_HEIGHT` so screens can pad their scroll content beneath it. Takes an optional `scrollY` shared value (currently unused — kept for future scroll effects).

### Patterns + gotchas specific to mobile

**Pressable styles must be static objects.** Never `style={({pressed}) => ({...})}` — that form silently drops `backgroundColor`, `borderColor`, and `flexDirection` on iOS RN in this SDK. Cards render flat, rows stack as columns. Use `style={{...}}`. Press feedback still fires via the native default. (Burned us in PR #19.)

**Cards use solid `#FFFFFF`, not translucent.** `rgba(255,255,255,0.92)` mixes with the cream `#FFFBF5` body into ~`#fffcf6` which is invisible on iOS. Web's `glass-card` cheats with `backdrop-filter: blur(14px)` which RN has no equivalent for. Solid white + a real shadow (`shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`, `elevation`) is the replacement.

**Plus Jakarta Sans tops out at 800 ExtraBold.** `@expo-google-fonts/plus-jakarta-sans` does **not** ship a 900 Black variant. Importing the undefined name poisons the whole `useFonts(...)` call and the app silently falls back to system fonts everywhere. Inter ships 900 — use `Inter_900Black` if you genuinely need extra weight. Stick to `PlusJakartaSans_700Bold` and `PlusJakartaSans_800ExtraBold` for headings.

**Supabase client is Platform-split** (`apps/mobile/lib/supabase.ts`):
- **Native**: `expo-secure-store` for session persistence (Keychain on iOS).
- **Web**: `localStorage` fallback. `expo-secure-store` has no web implementation and crashes on import if called.
- The "value larger than 2048 bytes" SecureStore warning is **non-blocking** — JWT + refresh token fits within iOS's 4KB keychain item limit.

**TopBar realtime subscription is best-effort.** The unread-badge channel + count query are both wrapped in try/catch — failures log `__DEV__` warnings instead of surfacing as red LogBox toasts. The badge stays at its last known value.

**Auth gate only runs on `/`.** After sign in/up, explicitly `router.replace('/(tabs)/home')`. (PR #20.)

**Moments photo upload uses `fetch → arrayBuffer`, not `File`.** `expo-image-picker` (`mediaTypes: ['images']`) returns an asset with a `file://` `uri`. Upload via `const ab = await fetch(uri).then(r => r.arrayBuffer()); supabase.storage.from('plan-photos').upload(path, ab, { contentType: asset.mimeType })`. Passing a `Blob`/`File` (the web pattern) silently uploads 0 bytes on RN. Set `contentType` explicitly or the object serves as `application/octet-stream`. (PR #37.)

**Keyboard handling for inline inputs: `automaticallyAdjustKeyboardInsets` on the ScrollView** (iOS) is simpler and less error-prone than `KeyboardAvoidingView` for an input that lives mid-scroll (the Moments composer). Pair it with `keyboardShouldPersistTaps="handled"` so tapping send/camera/reaction buttons while the keyboard is up doesn't get swallowed by the dismiss.

**Pre-existing `tsc` noise — don't chase it.** `npx tsc --noEmit` reports ~17 errors in `notifications.tsx`, `GlassSurface.tsx`, `LiquidGlassTabBar.tsx`, `AuthContext.tsx` — all `@types/react` `bigint`/`ReactNode` and phosphor `Icon`-as-JSX type mismatches from a version skew, not real bugs (the app runs fine). The guardrail is **zero NEW errors in the file you touched**: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep 'yourfile'`.

**Sim verification technique (no tap automation).** `idb` won't install (Command Line Tools too old vs Xcode 26.x); `cliclick` exists but the native iOS picker/alert sheets aren't reliably scriptable. To verify a pushed detail screen renders: temporarily inject a one-shot `router.push('/plan/<id>')` after `setPlans(...)` in `home.tsx` (guard with a `globalThis` flag), `terminate`+`launch` the app, then `xcrun simctl io booted screenshot`. To reach lower content, a temp `contentOffset` works only within the *initially* laid-out height (async-loaded lists clamp it) — flip the list `.order()` instead to bring new rows to the top. **Always revert these temp injections before committing** (grep for a marker like `TEMP-`). To exercise a mutation that needs a file (e.g. the photo upload) without the picker, feed the real handler an `expo-asset` `file://` URI — it runs 100% of the production code path against the real backend.

### Build environment gotchas (one-time setup)

- **CocoaPods must be ≥1.16** for `visionos` podspec compatibility (`react-native-safe-area-context.podspec` references it). `brew upgrade cocoapods` if you see "unrecognized OS visionos".
- **UTF-8 locale required for `expo prebuild`**: `export LANG=en_US.UTF-8` in the shell first, otherwise `pod install` crashes on ASCII-8BIT encoding.
- **`apps/mobile/ios/` is gitignored.** `app.json` is the single source of truth for native config — regenerate locally via `npx expo prebuild --platform ios --clean`.
- **`react-native`, `react`, and `semver@^7` are hoisted to the root `package.json`** (deps + `overrides`). Without that, npm workspaces leave RN only in `apps/mobile/node_modules` and the hoisted `nativewind` / `react-native-css-interop` can't find it. `semver` needed v7 for `functions/satisfies` which `react-native-reanimated`'s worklets script imports.
- **Metro is workspace-aware** via `apps/mobile/metro.config.js` — `watchFolders` covers the workspace root, `nodeModulesPaths` covers both local + root `node_modules`.

### Component reuse

`@goodfriends/shared` is the cross-platform escape hatch:
- **Pure data + utils ✓** — sort/filter/format helpers, color tokens, RSVP/tier constants. Drop them here.
- **UI components ✗** — `<div>` doesn't exist in RN; styles don't compose across platforms. Build mobile-native equivalents under `apps/mobile/components/`.
- **Data fetching hooks** are good candidates for sharing once they stabilise (`useGroup`, `useUpcomingPlans`, `useRSVP`). Not yet extracted — each screen still queries Supabase directly.

### Mobile-side Supabase nuances

- Same project, same RLS, same RPCs as the web app. No mobile-specific schema.
- `EXPO_PUBLIC_*` env vars are inlined at build time, fine for the anon key (already public).
- Realtime subscriptions work but iOS WebSocket can flake during cold network — always wrap subscribe + handle the status callback.

---

## Current feature set (working in production)

- Email/password auth, profile w/ emoji
- Create + join groups via invite link `/join/:code`
- Create plans (3 tiers), invite crew
- RSVP (in / likely / no) with optimistic UI
- Close event + record attendance + score calc
- Edit plan (rename, reschedule, add/remove invitees)
- Delete plan (with cancellation notifications for open plans)
- Moments feed: photo posts + text comments + emoji reactions
- Crew dashboard: podium, race, identity tags, monthly stats
- Notifications: in-app feed + live bell badge + 10 trigger types + daily cron
- Profile with score history and emoji change
- Home: unlimited upcoming events, inline sort control (urgency/date/tier)
- Monthly AI recap on the Summary screen (Gemini 2.5 Flash, structured output, cached per `group_id × year_month`, Generate/Regenerate CTA)

## Roadmap

**Mobile** — ✅ **core port complete** (Auth, Home, Plans, Crew, Profile, Create Plan, Plan Detail + Moments, Notifications). Remaining:
- [ ] **Summary screen** — port web `Summary.jsx` (AI monthly recap). The only unported screen; needs the `generate-summary` edge fn wired + the recap UI.
- [ ] **Deep links** — handle `goodfriends://join/...` (invite) and `goodfriends://plan/<id>` cold-start routing.
- [ ] **Push notifications** via `expo-notifications` — NOTE: the plugin + `aps-environment` entitlement were **removed** to unblock device builds on a free/personal Apple team (it can't sign push entitlements). Re-add when on a paid team / EAS Build.
- [ ] **Device tap-through QA** — the native photo-picker tap and the in-app mutation buttons (RSVP submit, edit save, close attendance, delete, nudge, approve/reject, react) are verified at render + backend level but not via real taps (no sim tap automation). A quick pass on a physical device closes the loop.
- [ ] TestFlight distribution via EAS Build.

**Web + cross-platform**:
- [ ] Group invite share UX (link generation + share sheet beyond raw `/join/:code`)
- [ ] Push notifications (web push or Expo push — WhatsApp layered on top)
- [ ] Grace pass mechanic (one missed event doesn't break streak)
- [ ] Extract data-fetching hooks (`useGroup`, `useUpcomingPlans`, `useRSVP`) into `@goodfriends/shared`

---

## Gotchas

1. **`react-router-dom` is in deps but unused** — don't add `<Routes>` etc., follow the existing custom switch pattern.
2. **`currentUser` vs `user`** — most handlers re-fetch via `supabase.auth.getUser()` to avoid stale closure. Match existing style in each file.
3. **`notifications.plan_id` is `ON DELETE CASCADE`** — if writing a notification about a row that's about to be deleted (like `event_cancelled`), set `p_plan_id: null` and put the plan name in the body. Otherwise the cascade nukes it.
4. **RSVP statuses are `in` / `likely` / `no`** — the `no` value used to be `maybe`; do not regress.
5. **Edge function has `verify_jwt: false`** — re-deploying `send-reminders` via Supabase CLI without `--no-verify-jwt` will flip this back to true and break the cron. Stay explicit. `generate-summary` is the opposite — leave its `verify_jwt: true`.
6. **Gemini 2.5 Flash thinks by default** — when calling Gemini with `responseSchema`, set `generationConfig.thinkingConfig.thinkingBudget: 0` (or bump `maxOutputTokens` to ~4000+). Otherwise the model burns the output budget on reasoning tokens and returns a truncated JSON that fails to parse.
7. **Realtime subscription cleanup** — every `supabase.channel(...).subscribe()` needs a matching `removeChannel` in the effect return. The channel name should include the user/plan id to avoid cross-tab collisions.
8. **`launch.json`** has a hardcoded `/Users/alex/.nvm/...` path — it's per-machine and ideally would be `.gitignore`d. Don't commit edits to it.
9. **Supabase project ref**: `ligemjbtjpqmrrwyiiyu`. Dashboard: https://supabase.com/dashboard/project/ligemjbtjpqmrrwyiiyu
10. **Mobile `Pressable` styles must be static** — `style={({pressed}) => ({...})}` drops `backgroundColor`/`borderColor`/`flexDirection` on iOS in this Expo SDK. See full explanation in [Mobile app → patterns + gotchas](#mobile-app-appsmobile).
11. **Plus Jakarta Sans only goes to 800 ExtraBold** in `@expo-google-fonts` — no 900 Black. Importing the undef name poisons `useFonts` and falls everything back to system fonts.
12. **Web preview lies about translucency + shadows + Pressable** — `react-native-web` re-implements these. Always verify in iOS Simulator before trusting the design.
13. **Native build setup**: CocoaPods ≥1.16 + `LANG=en_US.UTF-8` for `expo prebuild`. `apps/mobile/ios/` is gitignored.
14. **Mobile uses Phosphor only** (`phosphor-react-native`), not Ionicons. `@expo/vector-icons` is removed from the mobile package. Don't reintroduce it — see [Mobile app → Icons](#icons--phosphor) for the convention.
15. **`react-native-svg` is a native module** — Phosphor requires it. Adding Phosphor (or any other SVG library) means a `expo prebuild` + `expo run:ios` rebuild; Fast Refresh on an older build won't pick it up.
16. **`expo-glass-effect` API guard** — always call `isLiquidGlassAvailable()` ONCE at module load before rendering `<GlassView>`. Some iOS 26 beta builds ship without the API and an unguarded `<GlassView>` crashes the app. See `components/GlassSurface.tsx` for the canonical pattern — re-use that wrapper rather than calling `<GlassView>` directly anywhere else.

---

## How to add a new notification type

1. Migration: `ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;` then re-add the CHECK with your new type appended.
2. Add icon entry in `src/screens/Notifications.jsx` `TYPE_ICON` map.
3. Call `supabase.rpc('create_notification', { p_user_id, p_type, p_title, p_body, p_plan_id, p_actor_id })` at the action site, *after* the underlying mutation succeeds, *before* any cascade-deleting parent rows.
