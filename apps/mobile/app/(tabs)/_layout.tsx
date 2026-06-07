import { useColorScheme } from 'react-native'
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs'
import { ThemeProvider, DefaultTheme, DarkTheme } from '@react-navigation/native'

// Native iOS tab bar — genuine Liquid Glass material + interactive lens
// rendered by UIKit, not by us. Replaces the custom LiquidGlassTabBar
// (file kept on disk for the GlassSurface dependency / future reuse).
//
// 4 tabs: home, crew, plans, profile. `create` is no longer a tab — it
// lives at app/create.tsx as a root-level modal, reached from the dark
// "+ Plan" pill in each screen's TopBar.
//
// API note: `Icon` and `Label` are top-level exports from
// `expo-router/unstable-native-tabs`, NOT `NativeTabs.Trigger.Icon` /
// `.Label`. Using the wrong namespacing renders nothing and crashes the
// reconciler with "Cannot read property 'displayName' of undefined".
//
// ThemeProvider override sets the navigator background to our warm cream so iOS
// doesn't flash white during tab transitions. The base theme is matched to the
// system colour scheme (useColorScheme) so the iOS 26 Liquid Glass — the tab bar
// and Home's native header buttons — doesn't flash on tab-switch in dark mode.
// (We always force the cream background; the app itself is light/cream only.)
export default function TabLayout() {
  const scheme = useColorScheme()
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: { ...base.colors, background: '#FFFBF5' },
      }}
    >
      <NativeTabs tintColor="#111111" minimizeBehavior="never">
        <NativeTabs.Trigger name="home">
          <Icon sf={{ default: 'house', selected: 'house.fill' }} />
          <Label>Home</Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="crew">
          <Icon sf={{ default: 'heart', selected: 'heart.fill' }} />
          <Label>Crew</Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="plans">
          <Icon sf={{ default: 'calendar', selected: 'calendar' }} />
          <Label>Plans</Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile">
          <Icon sf={{ default: 'person', selected: 'person.fill' }} />
          <Label>Profile</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  )
}
