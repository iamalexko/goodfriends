import { Text, View, StyleProp, ViewStyle, TextStyle } from 'react-native'

// One-to-one with the web Pill. tier1/2/3 use inline styles for the
// border-or-no-border requirement; the rest are flat colour pairs.

type Variant =
  | 'tier1' | 'tier2' | 'tier3'
  | 'gold' | 'orange' | 'mint' | 'violet' | 'pink' | 'yellow' | 'neutral' | 'red'

const palette: Record<Exclude<Variant, 'tier1' | 'tier2' | 'tier3'>, { bg: string; fg: string }> = {
  gold:    { bg: '#FFFBEB', fg: '#78350F' },
  orange:  { bg: '#FB923C', fg: '#FFFFFF' },
  mint:    { bg: '#DCFCE7', fg: '#166534' },
  violet:  { bg: '#EEF2FF', fg: '#3730A3' },
  pink:    { bg: '#FDF2F8', fg: '#9D174D' },
  yellow:  { bg: '#FEF3C7', fg: '#92400E' },
  neutral: { bg: '#F3F4F6', fg: '#6B7280' },
  red:     { bg: '#FEF2F2', fg: '#B91C1C' },
}

const base: StyleProp<ViewStyle> = {
  alignSelf: 'flex-start',
  paddingHorizontal: 10,
  paddingVertical: 2,
  borderRadius: 999,
}

const baseText: StyleProp<TextStyle> = {
  fontSize: 10,
  fontWeight: '700',
  fontFamily: 'Inter_700Bold',
}

export function Pill({ children, variant = 'neutral' }: { children: React.ReactNode; variant?: Variant }) {
  if (variant === 'tier1') {
    return (
      <View style={[base, { backgroundColor: '#111111' }]}>
        <Text style={[baseText, { color: '#FFFFFF' }]}>{children}</Text>
      </View>
    )
  }
  if (variant === 'tier2') {
    return (
      <View style={[base, { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D' }]}>
        <Text style={[baseText, { color: '#92400E' }]}>{children}</Text>
      </View>
    )
  }
  if (variant === 'tier3') {
    return (
      <View style={[base, { backgroundColor: '#F3F4F6' }]}>
        <Text style={[baseText, { color: '#AAAAAA' }]}>{children}</Text>
      </View>
    )
  }
  const c = palette[variant]
  return (
    <View style={[base, { backgroundColor: c.bg }]}>
      <Text style={[baseText, { color: c.fg }]}>{children}</Text>
    </View>
  )
}
