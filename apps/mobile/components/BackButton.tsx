import { Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(0,0,0,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      hitSlop={8}
    >
      <Ionicons name="arrow-back" size={18} color="#111111" />
    </Pressable>
  )
}
