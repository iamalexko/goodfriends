import { useEffect } from 'react'
import { View, ViewStyle, StyleProp, DimensionValue } from 'react-native'
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

// Tier 2 — routine loads. Warm-grey skeletons that mirror each screen's layout
// so content fills in instead of popping onto a blank screen. Fill breathes
// between the cream-family base (#F3EFE7) and a slightly darker shimmer
// (#E9E2D6) — warm, never cold grey. Low-key.
const BASE = '#F3EFE7'
const SHIMMER = '#E9E2D6'

export function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const a = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(t.value, [0, 1], [BASE, SHIMMER]),
  }))
  return <Animated.View style={[a, style]} />
}

export function SkeletonText({
  width = '100%',
  height = 12,
  style,
}: {
  width?: DimensionValue
  height?: number
  style?: StyleProp<ViewStyle>
}) {
  return <SkeletonBlock style={[{ width, height, borderRadius: height / 2 }, style]} />
}

export function SkeletonStat() {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 8 }}>
      <SkeletonBlock style={{ width: 36, height: 22, borderRadius: 7 }} />
      <SkeletonBlock style={{ width: 50, height: 9, borderRadius: 4 }} />
    </View>
  )
}

export function SkeletonRow() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <SkeletonBlock style={{ width: 38, height: 38, borderRadius: 19 }} />
      <View style={{ flex: 1, gap: 7 }}>
        <SkeletonBlock style={{ width: '55%', height: 12, borderRadius: 6 }} />
        <SkeletonBlock style={{ width: '32%', height: 9, borderRadius: 4 }} />
      </View>
      <SkeletonBlock style={{ width: 52, height: 22, borderRadius: 999 }} />
    </View>
  )
}

// Mirrors PlanCard's footprint (rounded white island, name + meta + faces row).
export function SkeletonCard() {
  return (
    <View
      style={{
        marginHorizontal: 20,
        marginBottom: 10,
        padding: 14,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
      }}
    >
      <SkeletonBlock style={{ width: '62%', height: 16, borderRadius: 7 }} />
      <SkeletonBlock style={{ width: '44%', height: 12, borderRadius: 6, marginTop: 10 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
        <SkeletonBlock style={{ width: 24, height: 24, borderRadius: 12 }} />
        <SkeletonBlock style={{ width: 24, height: 24, borderRadius: 12 }} />
        <SkeletonBlock style={{ width: 64, height: 10, borderRadius: 5, marginLeft: 4 }} />
      </View>
    </View>
  )
}
