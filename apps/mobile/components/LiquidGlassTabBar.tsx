import { useEffect } from 'react'
import { View, Pressable, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useRouter, usePathname } from 'expo-router'
import {
  House,
  Users,
  CalendarBlank,
  User,
  Plus,
  type IconProps,
} from 'phosphor-react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import type { ComponentType } from 'react'

import { GlassSurface } from './GlassSurface'

// News+ style nav: a floating Liquid Glass pill with 4 labelled tabs
// (home, crew, plans, profile) and a detached dark "Create" circle on the
// right. Genuine iOS 26 Liquid Glass via GlassSurface; BlurView fallback
// on older iOS.

type Tab = {
  name: string
  route: string
  Icon: ComponentType<IconProps>
  label: string
}

const TABS: Tab[] = [
  { name: 'home',    route: '/(tabs)/home',    Icon: House,         label: 'Home' },
  { name: 'crew',    route: '/(tabs)/crew',    Icon: Users,         label: 'Crew' },
  { name: 'plans',   route: '/(tabs)/plans',   Icon: CalendarBlank, label: 'Plans' },
  { name: 'profile', route: '/(tabs)/profile', Icon: User,          label: 'Profile' },
]

export function LiquidGlassTabBar() {
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()

  function go(route: string, heavy?: boolean) {
    Haptics.impactAsync(
      heavy ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    ).catch(() => {})
    router.push(route as any)
  }

  return (
    <View
      style={[styles.zone, { bottom: Math.max(insets.bottom, 16) + 8 }]}
      pointerEvents="box-none"
    >
      {/* Floating glass pill — 4 labelled tabs */}
      <GlassSurface style={styles.pill} radius={34}>
        {TABS.map((tab) => {
          const isActive = pathname?.includes(tab.name) ?? false
          return (
            <Pressable key={tab.name} onPress={() => go(tab.route)} style={styles.tab}>
              <TabContent active={isActive} Icon={tab.Icon} label={tab.label} />
            </Pressable>
          )
        })}
      </GlassSurface>

      {/* Detached dark Create circle */}
      <Pressable onPress={() => go('/(tabs)/create', true)}>
        <View style={styles.createCircle}>
          <Plus size={26} weight="bold" color="#fff" />
        </View>
      </Pressable>
    </View>
  )
}

function TabContent({
  active,
  Icon,
  label,
}: {
  active: boolean
  Icon: ComponentType<IconProps>
  label: string
}) {
  const scale = useSharedValue(active ? 1.08 : 1)
  useEffect(() => {
    scale.value = withSpring(active ? 1.08 : 1, { damping: 12, stiffness: 180 })
  }, [active])
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Animated.View style={[styles.tabInner, style]}>
      <Icon size={22} weight={active ? 'fill' : 'regular'} color={active ? '#111' : '#888'} />
      <Text style={[styles.label, { color: active ? '#111' : '#888' }]}>{label}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  zone: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 11,
    paddingHorizontal: 6,
  },
  tab: { flex: 1, alignItems: 'center' },
  tabInner: { alignItems: 'center', gap: 3 },
  label: {
    fontSize: 9,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  createCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(17,17,17,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
})
