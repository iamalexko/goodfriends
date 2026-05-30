import { Tabs } from 'expo-router'

import { LiquidGlassTabBar } from '../../components/LiquidGlassTabBar'

// Custom floating Liquid Glass tab bar — see components/LiquidGlassTabBar.tsx.
// Default Expo Router bar is replaced via the `tabBar` prop. Screens
// themselves still live as <Tabs.Screen> entries so the router knows
// what routes belong to the tab group.
export default function TabLayout() {
  return (
    <Tabs
      tabBar={() => <LiquidGlassTabBar />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="crew" />
      <Tabs.Screen name="create" />
      <Tabs.Screen name="plans" />
      <Tabs.Screen name="profile" />
    </Tabs>
  )
}
