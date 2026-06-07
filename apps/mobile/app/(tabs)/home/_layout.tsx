import { Stack } from 'expo-router'

import { HomeHeaderRow } from '../../../components/HomeStackHeader'

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
        // Render the whole header row as the TITLE element rather than
        // headerLeft/headerRight: iOS 26 capsule-wraps left/right bar-button
        // items (no opt-out in react-native-screens 4.16), but the title view is
        // not wrapped — so the wordmark stays bare and "+ Plan"/bell are distinct
        // buttons over the native glass bar. Not headerTransparent: we keep the
        // system glass bar background; content lays out below it.
        headerTitleAlign: 'center',
        headerTitle: () => <HomeHeaderRow />,
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  )
}
