import { Tabs } from 'expo-router'

import { LiquidGlassTabBar } from '../../components/LiquidGlassTabBar'

// Custom floating News+-style tab bar — see components/LiquidGlassTabBar.tsx.
// Default Expo Router bar is replaced via the `tabBar` prop. All five screens
// stay registered as <Tabs.Screen> entries — `create` lives outside the pill
// in the detached Create circle but it's still a tab route.
export default function TabLayout() {
  return (
    <Tabs tabBar={() => <LiquidGlassTabBar />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="crew" />
      <Tabs.Screen name="plans" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="create" />
    </Tabs>
  )
}
