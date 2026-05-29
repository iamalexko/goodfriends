import { Pressable, Text, View } from 'react-native'

// Plain circle, no ring. The only "you" indicator in the app is the dark
// border on the current user's race avatar in Crew, applied inline there.

type Size = 'sm' | 'md' | 'lg'

const sizes: Record<Size, { dim: number; fontSize: number }> = {
  sm: { dim: 32, fontSize: 18 },
  md: { dim: 44, fontSize: 24 },
  lg: { dim: 56, fontSize: 36 },
}

export function EmojiAvatar({
  emoji = '😎',
  size = 'md',
  onPress,
}: {
  emoji?: string
  size?: Size
  onPress?: () => void
}) {
  const s = sizes[size]
  const inner = (
    <View
      style={{
        width: s.dim,
        height: s.dim,
        borderRadius: s.dim / 2,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: s.fontSize, lineHeight: s.fontSize * 1.1 }}>{emoji}</Text>
    </View>
  )
  if (onPress) {
    return (
      <Pressable onPress={onPress} hitSlop={6}>
        {inner}
      </Pressable>
    )
  }
  return inner
}
