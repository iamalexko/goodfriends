// Plan cover sources, shared between web + mobile so the create flow, detail
// page, Home cards, and Plans memory cards all resolve covers identically.

// Cover presets — pure gradients the plan emoji floats over. Keyed by id;
// id is stored in plans.cover_preset. Colors are [from, to] for a linear gradient.
export const COVER_PRESETS = [
  { id: 'sunset', colors: ['#FDE68A', '#FB923C'] },
  { id: 'ocean',  colors: ['#BAE6FD', '#818CF8'] },
  { id: 'ink',    colors: ['#1a1a1a', '#3a3a3a'] },
  { id: 'mint',   colors: ['#6EE7B7', '#34D399'] },
  { id: 'dusk',   colors: ['#A78BFA', '#F472B6'] },
  { id: 'gold',   colors: ['#FCD34D', '#F59E0B'] },
]

// Tier fallback gradient when no cover_image_url AND no cover_preset.
export const TIER_COVER = {
  1: ['#1a1a1a', '#3a3a3a'],
  2: ['#FDE68A', '#FB923C'],
  3: ['#818CF8', '#A78BFA'],
}

// Resolve a plan's cover to a render decision. Returns either
// { type: 'image', url } or { type: 'gradient', colors }.
export function resolveCover(plan) {
  if (plan.cover_image_url) return { type: 'image', url: plan.cover_image_url }
  const preset = COVER_PRESETS.find((p) => p.id === plan.cover_preset)
  if (preset) return { type: 'gradient', colors: preset.colors }
  return { type: 'gradient', colors: TIER_COVER[plan.tier] || TIER_COVER[3] }
}
