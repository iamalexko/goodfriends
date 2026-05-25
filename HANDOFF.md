# Goodfriends — Project Handoff

A social commitment app for a friend group in Dubai. Plans → RSVPs → attendance scoring → leaderboard. The "race" between members is the core game mechanic; reliability is the metric.

---

## Stack

- **Frontend**: Vite + React 18 (no TypeScript), Tailwind CSS, Framer Motion, lucide-react, react-router-dom is in deps but **not used** — see Routing.
- **Backend**: Supabase (Postgres 17, RLS, Realtime, Edge Functions, Storage, pg_cron)
- **Hosting**: Vercel (auto-deploys from `main`)
- **Repo**: https://github.com/iamalexko/goodfriends (public)
- **Live URL**: https://goodfriends-git-main-alex-ko-projects.vercel.app

## Run locally

```bash
npm install
npm run dev   # http://localhost:5173
```

Requires `.env.local`:

```
VITE_SUPABASE_URL=https://ligemjbtjpqmrrwyiiyu.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_hhoJDZ5D-V_rtcsbMPrSGA_rBSmvq1t
```

`.claude/launch.json` has a hardcoded node path — committed but environment-specific. Update or ignore for your env.

---

## File layout

```
src/
  App.jsx                 ← root + custom switch-based router
  main.jsx                ← entry
  index.css               ← design tokens, .phone-shell, .orb, .glass-card, .scroll-area
  lib/supabase.js         ← supabase client
  context/AuthContext.jsx ← session + profile fetching, useAuth() hook
  components/UI.jsx       ← shared low-level: TopBar, NavBar, EmojiAvatar, Pill,
                              BackButton, SectionHeader, Divider, Orb, StatCell
  screens/
    Auth.jsx              ← email + password
    Home.jsx              ← upcoming + past plans, sort control
    Crew.jsx              ← podium + race + identity tags + stats
    CreatePlan.jsx        ← 2-step (tier → form), invites
    PlanDetail.jsx        ← RSVP + edit + delete + moments feed (posts+reactions+photos) + close event
    Plans.jsx             ← list view
    Profile.jsx           ← scores + history + emoji picker
    Summary.jsx           ← monthly recap
    Notifications.jsx     ← bell-icon list view
    JoinPage.jsx          ← public /join/:code redemption
supabase/
  functions/send-reminders/index.ts   ← daily reminders + no-reply nudges (cron, no auth)
  functions/generate-summary/index.ts ← AI monthly recap via Gemini 2.5 Flash (user-invoked, JWT auth)
  config.toml                         ← project id + cron schedule
supabase-schema.sql                   ← committed schema for reference (run once on setup)
```

---

## Routing

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
- **Types**: `event_invite`, `event_rsvp`, `event_comment`, `event_closed`, `event_cancelled`, `event_reminder`, `event_filling`, `no_reply_nudge`, `photo_posted`, `reaction_received`
- **Where fired**:
  - `CreatePlan.jsx` → invite
  - `PlanDetail.jsx`: setRsvpStatus → rsvp + filling, deletePlan → cancelled, closeEvent → closed, submitPost → comment/photo, toggleReaction → reaction
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

- Bucket `plan-photos` — public URLs, path format `<userId>/<planId>-<timestamp>.<ext>`

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

## On the README's "Next things to build" list

- [ ] Group invite share UX (link generation + share sheet beyond raw `/join/:code`)
- [ ] Push notifications (web push or Twilio/Expo bridge — WhatsApp layered on top)
- [ ] Grace pass mechanic (one missed event doesn't break streak)

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

---

## How to add a new notification type

1. Migration: `ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;` then re-add the CHECK with your new type appended.
2. Add icon entry in `src/screens/Notifications.jsx` `TYPE_ICON` map.
3. Call `supabase.rpc('create_notification', { p_user_id, p_type, p_title, p_body, p_plan_id, p_actor_id })` at the action site, *after* the underlying mutation succeeds, *before* any cascade-deleting parent rows.
