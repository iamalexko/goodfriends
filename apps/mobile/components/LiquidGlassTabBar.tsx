import { View, Pressable, StyleSheet } from 'react-native'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useRouter, usePathname } from 'expo-router'

// Floating Liquid Glass tab bar — replaces the default Expo Router bar.
//
// - BlurView gives the iOS frosted-glass look (only true blur on device/sim;
//   in some preview contexts it flattens to a semi-transparent block).
// - Active tab gets a brighter glass pill behind it.
// - Centre `create` tab renders as a dark FAB instead of a flat icon.
// - Light haptic on every tap so the nav feels physical.

type Tab = {
  name: string
  route: string
  icon?: keyof typeof Ionicons.glyphMap
  iconOutline?: keyof typeof Ionicons.glyphMap
  isFab?: boolean
}

const TABS: Tab[] = [
  { name: 'home',    route: '/(tabs)/home',    icon: 'home',     iconOutline: 'home-outline' },
  { name: 'crew',    route: '/(tabs)/crew',    icon: 'people',   iconOutline: 'people-outline' },
  { name: 'create',  route: '/(tabs)/create',  isFab: true },
  { name: 'plans',   route: '/(tabs)/plans',   icon: 'calendar', iconOutline: 'calendar-outline' },
  { name: 'profile', route: '/(tabs)/profile', icon: 'person',   iconOutline: 'person-outline' },
]

export function LiquidGlassTabBar() {
  const router = useRouter()
  const pathname = usePathname()

  function go(route: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    router.push(route as any)
  }

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <BlurView intensity={60} tint="light" style={styles.pill}>
        {/* Inner highlight overlay — the glass sheen along the top */}
        <View style={styles.innerHighlight} pointerEvents="none" />

        {TABS.map((tab) => {
          // pathname comes through like "/home", "/crew", etc — match by segment.
          const isActive = pathname?.includes(tab.name) ?? false

          if (tab.isFab) {
            return (
              <Pressable key={tab.name} onPress={() => go(tab.route)} style={styles.fab}>
                <Ionicons name="add" size={22} color="#fff" />
              </Pressable>
            )
          }

          return (
            <Pressable
              key={tab.name}
              onPress={() => go(tab.route)}
              style={[styles.item, isActive && styles.itemActive]}
            >
              <Ionicons
                name={(isActive ? tab.icon : tab.iconOutline) as keyof typeof Ionicons.glyphMap}
                size={22}
                color={isActive ? '#111' : '#666'}
              />
            </Pressable>
          )
        })}
      </BlurView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 34,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    // Glass shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemActive: {
    backgroundColor: 'rgba(255,255,255,0.45)',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.7,
    shadowRadius: 2,
  },
  fab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(17,17,17,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
})
