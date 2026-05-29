import { Text, View } from 'react-native'

// Stub shown until the real screen ships. Wired into the router so
// navigation, fonts, and the tab bar can all be eyeballed end-to-end
// before any feature code lands.
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: '#FFFBF5',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Text style={{
        fontFamily: 'PlusJakartaSans_800ExtraBold',
        fontSize: 28,
        color: '#111',
        letterSpacing: -0.5,
      }}>
        {title}.
      </Text>
      <Text style={{
        fontFamily: 'Inter_500Medium',
        fontSize: 12,
        color: '#aaa',
        marginTop: 6,
      }}>
        coming soon
      </Text>
    </View>
  )
}
