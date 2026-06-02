import { useEffect, useMemo } from 'react'
import { useWindowDimensions, View } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  withTiming,
  runOnJS,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated'

// Dependency-free celebration: a burst of emoji pops up from the page centre
// and rains down past the bottom, then fades. Driven by one shared progress
// value on the UI thread. Mount it with a fresh `key` to (re)fire.
const FESTIVE = ['🎉', '✨', '🥳', '🔥', '🙌', '💫']
const COUNT = 22

type Particle = {
  startX: number
  driftX: number
  peak: number
  rotTurns: number
  size: number
  emoji: string
  delay: number
}

export function EmojiBurst({ emojis, onDone }: { emojis: string[]; onDone?: () => void }) {
  const { width, height } = useWindowDimensions()
  const progress = useSharedValue(0)
  const pool = emojis.length ? emojis : FESTIVE

  const particles = useMemo<Particle[]>(() => {
    const arr: Particle[] = []
    for (let i = 0; i < COUNT; i++) {
      arr.push({
        startX: width / 2 - 16 + (Math.random() - 0.5) * 90,
        driftX: (Math.random() - 0.5) * 300,
        peak: 260 + Math.random() * 190,
        rotTurns: (Math.random() - 0.5) * 3,
        size: 22 + Math.random() * 13,
        emoji: pool[Math.floor(Math.random() * pool.length)],
        delay: Math.random() * 0.12,
      })
    }
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width])

  useEffect(() => {
    progress.value = withTiming(1, { duration: 1600 }, (fin) => {
      'worklet'
      if (fin && onDone) runOnJS(onDone)()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const anchorY = height * 0.5

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 999 }}>
      {particles.map((p, i) => (
        <EmojiParticle key={i} p={p} progress={progress} anchorY={anchorY} height={height} />
      ))}
    </View>
  )
}

function EmojiParticle({ p, progress, anchorY, height }: { p: Particle; progress: SharedValue<number>; anchorY: number; height: number }) {
  const style = useAnimatedStyle(() => {
    // Shift each particle by its own delay so they don't move in lockstep.
    const t = Math.min(1, Math.max(0, (progress.value - p.delay) / (1 - p.delay)))
    return {
      opacity: interpolate(t, [0, 0.1, 0.8, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(t, [0, 1], [0, p.driftX], Extrapolation.CLAMP) },
        { translateY: interpolate(t, [0, 0.3, 1], [40, -p.peak, height + 80], Extrapolation.CLAMP) },
        { rotate: `${interpolate(t, [0, 1], [0, p.rotTurns * 360], Extrapolation.CLAMP)}deg` },
        { scale: interpolate(t, [0, 0.15, 1], [0.4, 1, 0.9], Extrapolation.CLAMP) },
      ],
    }
  })
  return (
    <Animated.Text style={[{ position: 'absolute', left: p.startX, top: anchorY, fontSize: p.size }, style]}>
      {p.emoji}
    </Animated.Text>
  )
}
