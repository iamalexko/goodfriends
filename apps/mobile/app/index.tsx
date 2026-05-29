import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'

import { useAuth } from '../context/AuthContext'

// SCAFFOLD MODE — auth/onboarding flow not yet ported to mobile, so we
// short-circuit straight to the (tabs) layout while there's no session.
// Restore the original gate (commented below) once Auth.tsx ships for mobile.
//
// Original gate:
//   if (!user || !profile?.display_name) return <Redirect href="/onboarding" />
//   return <Redirect href="/(tabs)/home" />
export default function Index() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFBF5' }}>
        <ActivityIndicator color="#FB923C" />
      </View>
    )
  }

  // Signed-in users with a profile still land on home; everyone else also
  // lands on home until the real onboarding flow ships.
  if (user && profile?.display_name) {
    return <Redirect href="/(tabs)/home" />
  }
  return <Redirect href="/(tabs)/home" />
}
