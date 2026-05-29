import { useEffect, useRef } from 'react'
import { Animated, Easing, Text, View } from 'react-native'

// Brand loader: Goodfriends. wordmark + pulsing orange dot. Used in place of
// activity spinners so the loading state still feels like the app.

type Size = 'sm' | 'md' | 'lg'

const sizes: Record<Size, { font: number; dot: number; gap: number }> = {
  sm: { font: 14, dot: 4, gap: 8 },
  md: { font: 18, dot: 5, gap: 10 },
  lg: { font: 22, dot: 6, gap: 12 },
}

export function Loader({
  fullScreen = false,
  size = 'md',
}: {
  fullScreen?: boolean
  size?: Size
}) {
  const s = sizes[size]
  const opacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [opacity])

  const inner = (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: s.gap }}>
      <Text
        style={{
          fontFamily: 'PlusJakartaSans_800ExtraBold',
          fontSize: s.font,
          fontWeight: '800',
          color: '#111111',
          letterSpacing: -0.4,
        }}
      >
        Goodfriends.
      </Text>
      <Animated.View
        style={{
          width: s.dot,
          height: s.dot,
          borderRadius: s.dot / 2,
          backgroundColor: '#FB923C',
          opacity,
        }}
      />
    </View>
  )

  if (fullScreen) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFBF5', alignItems: 'center', justifyContent: 'center' }}>
        {inner}
      </View>
    )
  }
  return <View style={{ paddingVertical: 48, alignItems: 'center' }}>{inner}</View>
}
