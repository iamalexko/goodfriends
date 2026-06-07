# Goodfriends — Design System

_Last updated: June 2026. Living spec — keep in repo root alongside `HANDOFF.md`._
_Companion file: `ROADMAP.md` (product roadmap & ideas). This file owns **design intent and rules**; `HANDOFF.md` owns **technical build state**._

---

## 1. Design philosophy — "The gallery wall"

> **The chrome stays quiet so the content sings.**

Goodfriends is full of color already — every plan has an emoji, every cover is a gradient or photo, every person is a bright avatar, and the Moments feed fills with user photos. If the **interface** is also colorful, it competes with that content and creates noise.

So the interface goes near-monochrome: **ink on warm cream**, like a gallery wall whose white space and quiet labels make whatever you hang on it pop. The users bring the color; the app is the frame.

Three principles follow from this:

1. **Ink + Cream carry ~95% of the UI.** Text, buttons, icons, structure, dividers, chips, status — all ink on cream. The app reads as black-on-warm-paper.
2. **Color comes from the content, not the chrome.** Emojis, cover gradients, photos, avatars. Every plan and crew looks different because the people fill the space.
3. **Clay is a rare signature, used like a watermark.** Reserved for the logo smile and at most one functional accent per screen (e.g. the "your reaction" ring). So infrequent that when clay appears, it _means_ something.

This is more premium than any colored palette, because **restraint reads as confidence.** It also makes the brand mark powerful: in a monochrome world, a single clay smile is unforgettable — which is why the brand favors the smiley/smile mark.

---

## 2. Color tokens

### Core (carry the whole UI)

| Token | Hex | Role |
|---|---|---|
| `paper` | `#FFFBF5` | Base background. **Never pure white** — the warmth is load-bearing. |
| `ink` | `#111111` | All text, primary buttons, icons, structure. |
| `inkMuted` | `#777777` | Secondary text. |
| `inkFaint` | `#BBBBBB` | Labels, captions, placeholders. |
| `surface` | `#FFFFFF` | Card/sheet fills (solid white islands over cream — gives real shadow depth). |
| `hairline` | `rgba(0,0,0,0.07)` | Dividers, card borders. |
| `warmGreyTint` | `#F3EFE7` | Quiet chip/badge fills (structural chrome). Warm — never cold grey. |
| `warmGrey` | `#9A8C74` | Muted text/labels in the cream family — the warm replacement for cold greys. |

### Signature accent (rare)

| Token | Hex | Role |
|---|---|---|
| `clay` | `#E2683F` | The lone signature. Logo smile; at most one functional accent per screen. |
| `clayTint` | `#FBEAE3` | Soft clay background, for the rare clay-flagged item. |
| `clayDeep` | `#A23E1F` | Clay text on tint. |

### Semantic — kept quiet

Status is communicated by **ink weight, position, and small text first** — color is the exception, not the rule.

| Token | Hex | Role | Default rendering |
|---|---|---|---|
| `success` | `#3D9970` (sage) | "In" / showed up | Prefer **ink + a check**; reserve sage for cases that genuinely need a positive hue. |
| `gold` | `#D9A441` (ochre) | "Likely" / streaks | Small text/icon only. |
| `info` | `#6B7F9E` (dusty blue) | Informational | Faint. (Tier chips are soft tints, not this — see §4.) |
| `nudge` | `#E2683F` or ink | Nudge action | An **ink pill** with one clay touch — supersedes the old amber (mobile) / bubblegum (web) split. |
| `danger` | `#C0392B` | Destructive / error | Only for genuine errors and destructive confirms. |

> **Color carries meaning, not decoration.** Status, signals, reply-states, and **tier level** may use color (soft tinted chips); purely **structural/decorative chrome stays quiet**. Quiet means **warm-grey in the cream family** (`#F3EFE7` tint / `#9A8C74` text), **never cold dead grey** — the screen stays calm and warm, never austere. Tier chips are coloured soft tints, **one per tier** (see §4). Zero-counts still go muted so non-zero values stand out.

---

## 3. Buttons & components

**Hierarchy (ink leads):**

- **Primary** — solid `ink` fill, white text. The "+ Plan", "I'm in", main CTAs.
- **Secondary** — white fill, hairline border, ink text. Dismissals, "Can't make it".
- **Soft** — `clayTint` fill, `clayDeep` text. Rare; for a clay-flagged background.
- **Accent (solid clay)** — almost never. Earns its exception only when it's the _only_ thing on screen (see empty states).

**Selected states** use ink fill (e.g. selected RSVP = solid ink), not a colored fill.

**Cards** are solid white over cream with a real shadow (translucent fills disappear on cream — never use them for cards).

**Tab headers — native Stack headers on iOS 26 glass.** All four tabs (Home, Crew, Plans, Profile) use a real **native Stack header** (each tab is a Stack nested under it: `app/(tabs)/<tab>/_layout.tsx` + `index.tsx`) so they ride the system iOS 26 Liquid Glass nav bar. The custom `AppHeader` (BlurView) is **retired**. Shared config + content live in `components/BrandHeader.tsx` (`brandStackScreenOptions` + `BrandHeaderRow`). Rules that make it on-brand:
- **Render the whole header row as the `headerTitle` element — NOT `headerLeft`/`headerRight`.** This is the load-bearing trick: iOS 26 wraps left/right bar-button items in glass "shared background" capsules (an unwanted pill behind the wordmark, and one capsule grouping `+ Plan`+bell), and **react-native-screens 4.16 exposes no opt-out** (`hidesSharedBackground` isn't surfaced). The **title view is not capsule-wrapped**, so a full-width title row (`BrandHeaderRow`, `width − 32`, `space-between`) keeps the wordmark bare and the two buttons distinct. If a future screens version adds the opt-out, left/right items become viable.
- **Wordmark stays our font** — our own `<Text>` "Goodfriends." in Plus Jakarta Sans 800 / ink `#111` / `letterSpacing -0.4`. Not the system title.
- **Both buttons are their own liquid glass, two separate elements (gap 8) in the title row — NOT grouped, NOT the system shared-background capsule.** `+ Plan` is a **black liquid-glass pill** (`GlassView` `tintColor="#000000"` + `colorScheme="dark"` + an inner `rgba(0,0,0,0.55)` darken fill so it reads deep-black over cream while keeping the glass highlights; white icon + label) — solid-ink `#111` pill fallback on iOS 18. The **bell is its own liquid-glass circle**, brightened to read on cream with `tintColor="#FFFFFF"` + `colorScheme="light"` + a hairline edge; flat-white circle fallback. Both guarded by `isLiquidGlassAvailable()`. Badge unchanged.
- **Transparent bar:** `headerTransparent: true`, no `headerStyle` background — no solid color; iOS renders its own glass / scroll-edge appearance.
- **Native scroll behavior — no fade, no custom scroll animation.** Where the screen root is a scroll view (Home, Crew, Profile), it's the direct first child with `contentInsetAdjustmentBehavior="automatic"` (no manual top padding). Plans has a FIXED header section (its "Plans." title + tabs) above a pager, so it pads that with `useHeaderHeight()` (`@react-navigation/elements`) since a fixed View isn't auto-inset.
- **Dark-mode flicker fix:** the `(tabs)` `ThemeProvider` base is matched to `useColorScheme()` so glass doesn't flash on tab-switch in dark mode (cream background still forced).
- **Still pending real-device (iOS 26) validation** — Liquid Glass doesn't render in Expo Go or meaningfully in the Simulator (sim shows layout/font/fallback only).

---

## 4. Patterns & rules

- **Cream, never white**, for backgrounds. White is reserved for card/sheet islands.
- **Tier system:** tier gradients live on **covers** (content — fine to be colorful). Tier **chips** in the UI are **soft tinted, one colour per tier** (tier level is a meaningful signal): clay `#FBEAE3`/`#A23E1F` (T1, big deal), amber `#FEF3C7`/`#92400E` (T2, weekend), warm-grey `#F3EFE7`/`#9A8C74` (T3, low-key). Calm soft tints — tint bg + darker same-hue text, `borderRadius: 7`, no border — **never loud pills** (T1 is _not_ a dark/solid pill).
- **Covers** resolve via the shared `resolveCover(plan)` helper: uploaded image → preset gradient → tier-gradient fallback. Preset gradients are content-as-color and may be fully saturated.
- **Maps / links** render as ink with an underline (not bare orange/clay text).
- **Empty states are the exception.** When there's no user content yet (new crew, no plans), the screen has no color to provide — so empty states _may_ use clay or a warm illustration deliberately, to avoid feeling clinical. This is the one place solid clay is welcome.
- **Legibility over any background:** content bubbles/cards stay solid cream/white islands floating _over_ any background image — never transparent onto it. (Relevant to the custom-background feature — see `ROADMAP.md`.)

---

## 5. Loading states (three-tier)

**Loading is chrome, so loading is ink-on-cream — never clay.** Clay is the rare signature accent; spending it on spinners cheapens it. The whole system is `#111` on `#FFFBF5` plus a warm-grey skeleton family. Match the tier to the wait:

- **Tier 1 — App launch: the wordmark.** The **native splash** shows the **"Goodfriends."** wordmark — a baked PNG (`assets/splash_wordmark.png`), pure ink on cream, Plus Jakarta Sans 800, tight tracking, period as the final ink glyph (no clay dot) — so the brand is on screen from the very first frame. Once JS loads, `components/LaunchWordmark.tsx` (mounted at root `_layout`) renders the **same PNG at the same width/position**, holds ~0.45s, then fades the cream overlay out to reveal the app — a seamless cream→cream, same-wordmark handoff. Plays **once**, never loops. **No letter stagger:** the native splash is a static image (no JS/fonts/motion) and re-staggering the same word in JS would flicker, so we trade the stagger for an instant, branded, flicker-free splash. Mobile-only constraint — web (`App.jsx`) keeps the CSS letter stagger. (Splash + asset bake in on the next prebuild/EAS build.)
- **Tier 2 — Routine loads: warm-grey skeletons.** Every full-screen fetch (Home, Plans, Crew, PlanDetail, Notifications) shows a skeleton that **mirrors that screen's real layout** so content fills in instead of popping onto a blank page. Fill breathes between the cream-family base `#F3EFE7` and a slightly darker shimmer `#E9E2D6` — **warm, never cold grey**. Primitives in `components/Skeleton.tsx`: `SkeletonBlock` (animated base), `SkeletonText`, `SkeletonStat`, `SkeletonRow`, `SkeletonCard` (mirrors PlanCard). Compose per screen; don't reach for a spinner.
- **Tier 3 — Special moments only: the smile-draw `BrandLoader`.** An ink dot with the cream negative-space smile drawing in and out, looping (`components/BrandLoader.tsx`). **Reserved** for deliberate brand moments (e.g. AI summary generation) — keep it rare so it stays meaningful. Never use it for routine fetches; those are Tier 2.
- **Button busy state — a breathing ink dot.** A small pulsing dot (`BreathingDot` from `BrandLoader.tsx`), **not** a spinner and **not** the smile-draw. Pair it with the existing busy text ("Saving…", "Closing…"). On a dark button the dot is white; on cream/grey it's ink.

**Retired:** the orange-dot `Loader`, the `⚡` emoji spinner, and the `ti-loader-2` spinner are gone — don't reintroduce them. No `ActivityIndicator` in app code; use `BreathingDot`.

---

## 6. Notes for implementation

- The ink/cream retokening is **mostly removing color, not swapping it** — simpler than a full palette swap. Replace `#FB923C`/peach usages with ink or (rarely) clay; demote bright mint/violet semantics to quiet/weight-based status.
- **Centralize tokens first.** Any hardcoded `#FB923C` (etc.) should move into `tailwind.config.js` + shared style constants before retokening, so future palette changes are one-line.
- The nudge-color cross-platform reconciliation (mobile amber vs web bubblegum) **dissolves** under this system — a nudge is an ink pill with one clay touch on both platforms.
- Keep `paper` out of `#FFFFFF`. If a screen starts feeling clinical/cold, check: is cream being used (not white)? Are corners rounded? Is there content to provide color? Those three keep it warm.
