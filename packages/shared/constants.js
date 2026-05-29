// Design tokens and domain constants shared between web and mobile.

export const COLORS = {
  base:    '#FFFBF5',
  ink:     '#111111',
  primary: '#FB923C',
  mint:    '#34D399',
  violet:  '#818CF8',
  pink:    '#F472B6',
  gold:    '#FCD34D',
}

export const TIER_LABEL = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' }
export const TIER_PILL  = { 1: 'gold',   2: 'orange', 3: 'neutral' }

// Mirrors the live DB CHECK constraint on rsvps.status: ('in','likely','no').
// Keep these keys in sync with supabase-schema.sql.
export const RSVP_OPTIONS = [
  { key: 'in',     emoji: '✅', label: "I'm in",  sub: '100% there' },
  { key: 'likely', emoji: '🤔', label: 'Likely',  sub: 'pretty sure' },
  { key: 'no',     emoji: '😬', label: 'No',      sub: "can't make it" },
]

export const EMOJIS = [
  '😎','🤩','😄','😜','🫶','🥳','😇','🤗','😏','🥸',
  '🤠','😍','🥹','🫡','😤','🤓','👻','🦁','🐯','🦊',
  '🐼','🐸','🦋','🌊','⚡','🔥','🌈','💫','🎯','🎸','🏄','🌴',
]

export const MEMBER_GRADIENTS = [
  ['#FB923C','#FCD34D'],
  ['#818CF8','#A78BFA'],
  ['#34D399','#6EE7B7'],
  ['#F472B6','#FB7185'],
  ['#60A5FA','#93C5FD'],
]
