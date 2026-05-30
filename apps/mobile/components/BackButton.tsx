import { Pressable } from 'react-native'
import { CaretLeft } from 'phosphor-react-native'

import { ICON_COLORS } from '../constants/icons'

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
      <CaretLeft size={18} weight="bold" color={ICON_COLORS.active} />
    </Pressable>
  )
}
