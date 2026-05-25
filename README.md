# Goodfriends

Show up. Be remembered.

A social commitment app for a friend crew. Plan things, RSVP, show up, get points, climb the leaderboard. Built on React + Supabase, deploys to Vercel.

→ For architecture, gotchas, and how to extend things, read [`HANDOFF.md`](./HANDOFF.md).

## Setup (do this once)

### 1. Run the database schema
- Go to https://supabase.com/dashboard/project/ligemjbtjpqmrrwyiiyu/sql/new
- Paste the contents of `supabase-schema.sql`
- Click Run

### 2. Install and run locally
```bash
npm install
npm run dev
```
Open http://localhost:5173

Create `.env.local` first:
```
VITE_SUPABASE_URL=https://ligemjbtjpqmrrwyiiyu.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_hhoJDZ5D-V_rtcsbMPrSGA_rBSmvq1t
```

### 3. Deploy to Vercel
Auto-deploys from `main`. Add the two env vars above in the Vercel dashboard.

### 4. (Optional) Deploy the daily reminder edge function
```bash
supabase functions deploy send-reminders
```
Already deployed in prod and scheduled via `pg_cron` to run daily at 5 UTC (9am Dubai).

## Project structure
```
src/
  context/
    AuthContext.jsx     ← user session + profile
  lib/
    supabase.js         ← supabase client
  components/
    UI.jsx              ← TopBar (w/ live bell badge), NavBar, Pill, EmojiAvatar, etc
  screens/
    Auth.jsx            ← email + password sign-in / sign-up
    Home.jsx            ← upcoming + past plans, urgency/date/tier sort
    Crew.jsx            ← podium, race bars, identity tags, stats
    CreatePlan.jsx      ← tier picker + form + invite
    PlanDetail.jsx      ← RSVP + edit + delete + moments feed + close event
    Plans.jsx           ← all-plans list
    Profile.jsx         ← scores + history + emoji picker
    Summary.jsx         ← monthly recap
    Notifications.jsx   ← bell-icon feed
    JoinPage.jsx        ← public /join/:code invite redemption
  App.jsx               ← custom switch-based router (react-router is in deps but unused)
  main.jsx              ← entry point
  index.css             ← design tokens + .glass-card / .orb / .phone-shell
supabase/
  functions/send-reminders/index.ts   ← daily reminders + no-reply nudges
  config.toml
```

## What's working
- Email + password auth, profile with emoji (tap avatar on Profile to change)
- Create + join groups via shareable `/join/:code` link
- Create plans (all 3 tiers) and invite your crew
- RSVP — in / likely / no — with optimistic updates everywhere
- Edit plan (rename, reschedule, add/remove invitees)
- Delete plan with cancellation notifications to invitees
- Close events + record attendance + score recalculation
- Points + score calculation
- Crew dashboard: podium, race, identity tags, monthly stats
- Profile with score history
- Moments feed on each plan: photo posts + text comments + emoji reactions
- Home sort control: urgency / date / tier (bottom sheet)
- **Notifications system** — in-app feed, live bell badge via Supabase Realtime:
  - Reactive: invite, RSVP change, event filling, close, comment, photo, reaction, cancellation
  - Daily cron (edge function): tomorrow reminders, no-reply nudges to organisers

## Next things to build
- Group invite share UX (a real share sheet rather than copying the raw URL)
- Push notifications (web push / Twilio / Expo — WhatsApp layered on top)
- Monthly summary AI generation (Claude API from an edge function)
- Grace pass mechanic (one missed event doesn't break the streak)
