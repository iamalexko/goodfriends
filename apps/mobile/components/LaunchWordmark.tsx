import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  FadeInDown,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

// Tier 1 — app launch. The "Goodfriends." wordmark assembles itself: each
// character fades + rises in, left-to-right, then the whole word holds briefly
// and the cream overlay fades out to reveal the app. Pure ink on cream — loading
// is chrome, so no clay. Plays once (cold start); never loops.
const WORD = 'Goodfriends.'
const STAGGER = 38 // ms between letters
const LETTER_MS = 320 // per-letter ease
const HOLD = 460 // settle before fade-out
const FADE_MS = 320

export function LaunchWordmark({ onDone }: { onDone?: () => void }) {
  const fade = useSharedValue(1)
  const settleStart = WORD.length * STAGGER + LETTER_MS + HOLD

  useEffect(() => {
    fade.value = withDelay(
      settleStart,
      withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.quad) }, (finished) => {
        'worklet'
        if (finished && onDone) runOnJS(onDone)()
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const overlay = useAnimatedStyle(() => ({ opacity: fade.value }))

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.fill, overlay]}>
      <View style={{ flexDirection: 'row' }}>
        {WORD.split('').map((ch, i) => (
          <Animated.Text
            key={`${ch}-${i}`}
            entering={FadeInDown.delay(i * STAGGER).duration(LETTER_MS)}
            style={[styles.letter, i < WORD.length - 1 && styles.tighten]}
          >
            {ch}
          </Animated.Text>
        ))}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fill: {
    backgroundColor: '#FFFBF5',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  letter: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 30,
    fontWeight: '800',
    color: '#111111',
  },
  // Per-letter views can't share a single letterSpacing, so nudge each glyph
  // ~1px closer to match the tight header wordmark.
  tighten: { marginRight: -1 },
})
