import { useEffect, useMemo } from 'react'
import { useWindowDimensions, View } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  withTiming,
  Easing,
  runOnJS,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated'

// Dependency-free celebration: a shower of emoji falls from above the screen,
// drifting + spinning, then fades. Driven by one shared progress value on the
// UI thread. Mount with a fresh `key` to (re)fire. Particles start at staggered
// heights above the top so they enter the page at different times — a natural
// rain rather than a single burst.
const FESTIVE = ['🎉', '✨', '🥳', '🔥', '🙌', '💫']
const COUNT = 28

type Particle = {
  startX: number
  startY: number
  driftX: number
  rotTurns: number
  size: number
  emoji: string
}

export function EmojiBurst({ emojis, onDone }: { emojis: string[]; onDone?: () => void }) {
  const { width, height } = useWindowDimensions()
  const progress = useSharedValue(0)
  const pool = emojis.length ? emojis : FESTIVE

  const particles = useMemo<Particle[]>(() => {
    const arr: Particle[] = []
    for (let i = 0; i < COUNT; i++) {
      arr.push({
        startX: Math.random() * (width - 24),
        startY: -40 - Math.random() * (height * 0.75), // staggered above the top
        driftX: (Math.random() - 0.5) * 70,
        rotTurns: (Math.random() - 0.5) * 4,
        size: 20 + Math.random() * 13,
        emoji: pool[Math.floor(Math.random() * pool.length)],
      })
    }
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height])

  useEffect(() => {
    progress.value = withTiming(1, { duration: 1900, easing: Easing.linear }, (fin) => {
      'worklet'
      if (fin && onDone) runOnJS(onDone)()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 999 }}>
      {particles.map((p, i) => (
        <EmojiParticle key={i} p={p} progress={progress} height={height} />
      ))}
    </View>
  )
}

function EmojiParticle({ p, progress, height }: { p: Particle; progress: SharedValue<number>; height: number }) {
  const style = useAnimatedStyle(() => {
    const t = progress.value
    return {
      opacity: interpolate(t, [0, 0.06, 0.85, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(t, [0, 1], [0, p.driftX], Extrapolation.CLAMP) },
        { translateY: interpolate(t, [0, 1], [p.startY, height + 100], Extrapolation.CLAMP) },
        { rotate: `${interpolate(t, [0, 1], [0, p.rotTurns * 360], Extrapolation.CLAMP)}deg` },
      ],
    }
  })
  return (
    <Animated.Text style={[{ position: 'absolute', left: p.startX, top: 0, fontSize: p.size }, style]}>
      {p.emoji}
    </Animated.Text>
  )
}
