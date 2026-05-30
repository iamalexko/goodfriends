import { Pressable, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { Plus } from 'phosphor-react-native'
import * as Haptics from 'expo-haptics'

// Dark "+ Plan" pill that sits in every tab screen's TopBar. Routes to the
// modal `/create` route — registered at the root Stack, not inside (tabs),
// so it slides up over whatever tab the user was on.
//
// Style notes: kept STATIC instead of the `style={({pressed}) => ...}`
// function form — iOS RN drops most properties from the initial render
// when Pressable's style is a function (the same bug worked around in
// profile.tsx's emoji-picker Pressable). The press feedback comes from
// the built-in opacity dim via `pressRetentionOffset` + iOS default.
export function CreatePlanButton() {
  const router = useRouter()
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
        router.push('/create' as any)
      }}
      hitSlop={6}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#111111',
        borderRadius: 999,
        paddingVertical: 7,
        paddingHorizontal: 12,
      }}
    >
      <Plus size={14} weight="bold" color="#FFFFFF" />
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: 12,
          fontWeight: '700',
          fontFamily: 'Inter_700Bold',
        }}
      >
        Plan
      </Text>
    </Pressable>
  )
}
