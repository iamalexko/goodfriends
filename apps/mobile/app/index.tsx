import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'

import { useAuth } from '../context/AuthContext'

// Boot router: park on an inline spinner until AuthContext resolves, then
// jump to onboarding if there's no session OR no display_name yet, otherwise
// land on the home tab.
export default function Index() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFBF5' }}>
        <ActivityIndicator color="#FB923C" />
      </View>
    )
  }

  if (!user || !profile?.display_name) {
    return <Redirect href="/onboarding" />
  }

  return <Redirect href="/(tabs)/home" />
}
