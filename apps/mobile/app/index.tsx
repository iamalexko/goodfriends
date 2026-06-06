import { Redirect } from 'expo-router'

import { View } from 'react-native'
import { useAuth } from '../context/AuthContext'

// Boot router: park on the branded loader until AuthContext resolves, then
// jump to /auth if there's no session OR no profile.display_name yet,
// otherwise land on the home tab. Sign-up captures display_name + emoji
// inline, so there's no separate /onboarding step — /auth handles both.
export default function Index() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    // Plain cream — the launch wordmark overlay (root _layout) covers this on
    // cold start; for warm navigations the redirect is instant.
    return <View style={{ flex: 1, backgroundColor: '#FFFBF5' }} />
  }

  if (!user || !profile?.display_name) {
    return <Redirect href={'/auth' as any} />
  }

  return <Redirect href={'/(tabs)/home' as any} />
}
