import { useEffect } from 'react'
import { Image, StyleSheet } from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

// Tier 1 — app launch. Mirrors the native splash EXACTLY: the same
// "Goodfriends." wordmark PNG, ink on cream, centered at the same width. The
// native splash paints it from the very first frame; this JS overlay holds the
// identical image briefly, then fades out to reveal the app — a seamless
// cream→cream, same-wordmark handoff with no flicker. Plays once (cold start);
// never loops. (No letter stagger: a static native splash can't animate, and
// re-staggering the same word here would flicker. See DESIGN_SYSTEM §5.)
const WORDMARK = require('../assets/splash_wordmark.png')
// Match the native splash `imageWidth` (app.json) so the handoff is pixel-aligned.
const WM_W = 190
const WM_H = (WM_W * 217) / 1498 // preserve the PNG aspect ratio
const HOLD = 450 // brief settle before fade-out
const FADE_MS = 320

export function LaunchWordmark({ onDone }: { onDone?: () => void }) {
  const fade = useSharedValue(1)

  useEffect(() => {
    fade.value = withDelay(
      HOLD,
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
      <Image source={WORDMARK} style={{ width: WM_W, height: WM_H }} resizeMode="contain" />
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
})
