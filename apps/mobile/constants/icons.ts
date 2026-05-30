/**
 * ICON SYSTEM — Phosphor (phosphor-react-native)
 *
 * Weights:
 *   inactive → regular · active → fill · emphasis → bold · on dark → bold white
 * Active = fill + ink (#111). Inactive = regular + grey (#666). No duotone.
 * Sizes:   tab 24 · inline 16 · header 18 · empty-state 32
 * One weight per context. Never mix regular and fill in the same row.
 */
export const ICON_SIZES = {
  tab: 24,
  inline: 16,
  header: 18,
  large: 32,
} as const

export const ICON_COLORS = {
  active: '#111111',
  inactive: '#666666',
  muted: '#AAAAAA',
  accent: '#FB923C',
  inverted: '#FFFFFF',
} as const
