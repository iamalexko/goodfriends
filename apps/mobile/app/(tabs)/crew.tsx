import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSharedValue } from 'react-native-reanimated'

import { AppHeader, APP_HEADER_ROW_HEIGHT } from '../../components/AppHeader'

// Placeholder Crew tab. AppHeader renders for consistency across tabs;
// scrollY stays at 0 because there's nothing to scroll yet, so the
// glass background stays fully transparent — what shows is just the
// wordmark + "+ Plan" pill + bell sitting on warm paper.
export default function Crew() {
  const insets = useSafeAreaInsets()
  const scrollY = useSharedValue(0)
  const headerPadTop = insets.top + APP_HEADER_ROW_HEIGHT + 12

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFBF5' }}>
      <View
        style={{
          flex: 1,
          paddingTop: headerPadTop,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{
          fontFamily: 'PlusJakartaSans_800ExtraBold',
          fontSize: 28,
          color: '#111111',
          letterSpacing: -0.5,
        }}>
          Crew.
        </Text>
        <Text style={{
          fontFamily: 'Inter_500Medium',
          fontSize: 12,
          color: '#AAAAAA',
          marginTop: 6,
        }}>
          coming soon
        </Text>
      </View>

      <AppHeader scrollY={scrollY} />
    </View>
  )
}
