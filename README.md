# Goodfriends

Show up. Be remembered.

## Setup (do this once)

### 1. Run the database schema
- Go to https://supabase.com/dashboard/project/ligemjbtjpqmrrwyiiyu/sql/new
- Paste the contents of `supabase-schema.sql`
- Click Run

### 2. Enable Phone Auth in Supabase
- Go to Authentication → Providers → Phone
- Enable it
- For testing: enable "Confirm phone" = OFF (so OTP works without Twilio)
- For production: add Twilio credentials

### 3. Install and run locally
```bash
npm install
npm run dev
```
Open http://localhost:5173

### 4. Deploy to Vercel
```bash
npm install -g vercel
vercel
```
Then add these environment variables in Vercel dashboard:
- `VITE_SUPABASE_URL` = https://ligemjbtjpqmrrwyiiyu.supabase.co
- `VITE_SUPABASE_ANON_KEY` = sb_publishable_hhoJDZ5D-V_rtcsbMPrSGA_rBSmvq1t

## Project structure
```
src/
  context/
    AuthContext.jsx     ← user session + profile
  lib/
    supabase.js         ← supabase client
  components/
    UI.jsx              ← shared components (StatusBar, NavBar, Pill, etc)
  screens/
    Onboarding.jsx      ← phone OTP + emoji picker + group join
    Home.jsx            ← feed with live plans
    Crew.jsx            ← race bars + hall of fame
    CreatePlan.jsx      ← tier picker + form + invite
    PlanDetail.jsx      ← RSVP + close event
    Profile.jsx         ← scores + history
    Summary.jsx         ← monthly recap
  App.jsx               ← router
  main.jsx              ← entry point
  index.css             ← design tokens + animations
```

## What's working
- Phone OTP auth
- Create groups and invite by link
- Create plans (all 3 tiers)
- RSVP with tiered responses
- Close events + record attendance
- Points + score calculation
- Crew dashboard with real race bars
- Profile with real history

## Next things to build
- Group invite flow (share link → join)
- Push notifications for commit chain nudges
- Photo upload to plan feed
- Monthly summary AI generation (Claude API)
- Grace pass mechanic
