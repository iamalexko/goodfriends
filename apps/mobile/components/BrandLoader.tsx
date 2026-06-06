import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

const AnimatedPath = Animated.createAnimatedComponent(Path)
// Arc length of the smile path "M 362 532 Q 512 682 662 532" (slightly over so
// offset == this fully hides the stroke).
const SMILE_LEN = 360

// Tier 3 — RESERVED for deliberate brand moments only (e.g. AI summary
// generation). The ink dot with the cream negative-space smile drawing in and
// out, looping. Do NOT use for routine fetches — those are Tier 2 skeletons.
// Keep it rare so it stays meaningful. Ink on cream, no clay.
export function BrandLoader({ size = 96, label }: { size?: number; label?: string }) {
  const draw = useSharedValue(0)
  useEffect(() => {
    draw.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true, // reverse: smile draws in, then un-draws — reads as "working"
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const pathProps = useAnimatedProps(() => ({
    strokeDashoffset: SMILE_LEN * (1 - draw.value),
  }))
  return (
    <View style={{ flex: 1, backgroundColor: '#FFFBF5', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Svg width={size} height={size} viewBox="0 0 1024 1024">
        <Circle cx={512} cy={512} r={300} fill="#111111" />
        <AnimatedPath
          d="M 362 532 Q 512 682 662 532"
          fill="none"
          stroke="#FFFBF5"
          strokeWidth={86}
          strokeLinecap="round"
          strokeDasharray={SMILE_LEN}
          animatedProps={pathProps}
        />
      </Svg>
      {label ? (
        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#888888' }}>{label}</Text>
      ) : null}
    </View>
  )
}

// Button busy state — a tiny breathing ink dot (not a spinner, not the full
// smile-draw). Pair with the existing busy text ("Saving…", "Closing…", etc.).
export function BreathingDot({ size = 6, color = '#FFFFFF' }: { size?: number; color?: string }) {
  const o = useSharedValue(1)
  useEffect(() => {
    o.value = withRepeat(withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.ease) }), -1, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const a = useAnimatedStyle(() => ({ opacity: o.value }))
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, a]} />
}
