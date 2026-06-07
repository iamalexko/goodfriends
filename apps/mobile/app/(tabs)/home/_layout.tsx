import { Stack } from 'expo-router'

import { HomeWordmark, HomeHeaderActions } from '../../../components/HomeStackHeader'

// One-screen spike: give Home a NATIVE Stack header so it rides the iOS 26
// Liquid Glass nav bar (vs. the custom AppHeader the other tabs still use).
//
// - headerTransparent so the system glass shows through; we deliberately do NOT
//   set a solid headerStyle background (that would kill the glass).
// - headerLeft / headerRight carry OUR brand content (wordmark in our font; the
//   "+ Plan" pill + bell). headerTitle is suppressed — branding lives in
//   headerLeft.
// - No scroll-away / fade / custom animation: the header behaves as the standard
//   native header. Content is inset via contentInsetAdjustmentBehavior on the
//   screen's ScrollView (see index.tsx).
//
// Requires a real device on iOS 26 to see the glass — it does not render in
// Expo Go or meaningfully in the Simulator.
export default function HomeStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTransparent: true,
        // Empty string (not a () => null component) — native-stack falls back to
        // the route name ("index") when headerTitle renders nothing. Branding
        // lives in headerLeft.
        headerTitle: '',
        headerBackButtonDisplayMode: 'minimal',
        headerLeft: () => <HomeWordmark />,
        headerRight: () => <HomeHeaderActions />,
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  )
}
