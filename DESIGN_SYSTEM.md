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
| `info` | `#6B7F9E` (dusty blue) | Tier / informational | Faint; tier chips are grey by default (see §4). |
| `nudge` | `#E2683F` or ink | Nudge action | An **ink pill** with one clay touch — supersedes the old amber (mobile) / bubblegum (web) split. |
| `danger` | `#C0392B` | Destructive / error | Only for genuine errors and destructive confirms. |

> **Status by weight, not hue.** Zero-counts go muted grey (`#D8D2C8`) so non-zero values stand out without color. "In" is ink + a check, not a green pill. Color is reserved for real signal.

---

## 3. Buttons & components

**Hierarchy (ink leads):**

- **Primary** — solid `ink` fill, white text. The "+ Plan", "I'm in", main CTAs.
- **Secondary** — white fill, hairline border, ink text. Dismissals, "Can't make it".
- **Soft** — `clayTint` fill, `clayDeep` text. Rare; for a clay-flagged background.
- **Accent (solid clay)** — almost never. Earns its exception only when it's the _only_ thing on screen (see empty states).

**Selected states** use ink fill (e.g. selected RSVP = solid ink), not a colored fill.

**Cards** are solid white over cream with a real shadow (translucent fills disappear on cream — never use them for cards).

**Liquid glass / blur** — `AppHeader` uses an always-on `expo-blur` BlurView. **Open question (see ROADMAP P0):** "liquid glass on buttons" needs a feasibility check on the current Expo SDK — UIKit liquid glass (`expo-glass-effect`) can't be opacity-animated (this is why the fade-on-scroll header was abandoned). Buttons likely get the _look_ (translucent + blur) rather than true liquid glass. Resolve before speccing button glass.

---

## 4. Patterns & rules

- **Cream, never white**, for backgrounds. White is reserved for card/sheet islands.
- **Tier system:** tier gradients live on **covers** (content — fine to be colorful). Tier **chips** in the UI are monochrome — a faint grey "T1/T2/T3", all tiers identical faint treatment (T1 is _not_ a dark pill).
- **Covers** resolve via the shared `resolveCover(plan)` helper: uploaded image → preset gradient → tier-gradient fallback. Preset gradients are content-as-color and may be fully saturated.
- **Maps / links** render as ink with an underline (not bare orange/clay text).
- **Empty states are the exception.** When there's no user content yet (new crew, no plans), the screen has no color to provide — so empty states _may_ use clay or a warm illustration deliberately, to avoid feeling clinical. This is the one place solid clay is welcome.
- **Legibility over any background:** content bubbles/cards stay solid cream/white islands floating _over_ any background image — never transparent onto it. (Relevant to the custom-background feature — see `ROADMAP.md`.)

---

## 5. Notes for implementation

- The ink/cream retokening is **mostly removing color, not swapping it** — simpler than a full palette swap. Replace `#FB923C`/peach usages with ink or (rarely) clay; demote bright mint/violet semantics to quiet/weight-based status.
- **Centralize tokens first.** Any hardcoded `#FB923C` (etc.) should move into `tailwind.config.js` + shared style constants before retokening, so future palette changes are one-line.
- The nudge-color cross-platform reconciliation (mobile amber vs web bubblegum) **dissolves** under this system — a nudge is an ink pill with one clay touch on both platforms.
- Keep `paper` out of `#FFFFFF`. If a screen starts feeling clinical/cold, check: is cream being used (not white)? Are corners rounded? Is there content to provide color? Those three keep it warm.
