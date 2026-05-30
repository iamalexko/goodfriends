import { useEffect } from 'react'
import { View, Pressable, StyleSheet } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useRouter, usePathname } from 'expo-router'
import {
  House,
  Users,
  Plus,
  CalendarBlank,
  User,
  type IconProps,
} from 'phosphor-react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import type { ComponentType } from 'react'

import { ICON_COLORS, ICON_SIZES } from '../constants/icons'

// Full-width edge-to-edge glass nav (Option C).
// - BlurView intensity 50 frosts whatever scrolls underneath.
// - 5 equal flex slots: home, crew, FAB, plans, profile.
// - FAB sits inline at icon height (not raised).
// - No labels — icons only.
// - Active icon swaps to Phosphor `fill` weight + ink, spring-scales to 1.1.
// - Bottom inset respected so it clears the iOS home indicator.

type Tab = {
  name: string
  route: string
  Icon?: ComponentType<IconProps>
  isFab?: boolean
}

const TABS: Tab[] = [
  { name: 'home',    route: '/(tabs)/home',    Icon: House },
  { name: 'crew',    route: '/(tabs)/crew',    Icon: Users },
  { name: 'create',  route: '/(tabs)/create',  isFab: true },
  { name: 'plans',   route: '/(tabs)/plans',   Icon: CalendarBlank },
  { name: 'profile', route: '/(tabs)/profile', Icon: User },
]

export function LiquidGlassTabBar() {
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()

  function go(route: string, isFab?: boolean) {
    Haptics.impactAsync(
      isFab ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    ).catch(() => {})
    router.push(route as any)
  }

  return (
    <BlurView
      intensity={50}
      tint="light"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 16) }]}
    >
      <View style={styles.innerHighlight} pointerEvents="none" />

      {TABS.map((tab) => {
        const isActive = pathname?.includes(tab.name) ?? false

        if (tab.isFab) {
          return (
            <Pressable
              key={tab.name}
              onPress={() => go(tab.route, true)}
              style={styles.slot}
            >
              <View style={styles.fab}>
                <Plus size={22} weight="bold" color={ICON_COLORS.inverted} />
              </View>
            </Pressable>
          )
        }

        return (
          <Pressable key={tab.name} onPress={() => go(tab.route)} style={styles.slot}>
            <TabIcon active={isActive} Icon={tab.Icon!} />
          </Pressable>
        )
      })}
    </BlurView>
  )
}

function TabIcon({
  active,
  Icon,
}: {
  active: boolean
  Icon: ComponentType<IconProps>
}) {
  const scale = useSharedValue(active ? 1.1 : 1)
  useEffect(() => {
    scale.value = withSpring(active ? 1.1 : 1, { damping: 12, stiffness: 180 })
  }, [active])
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Animated.View style={style}>
      <Icon
        size={ICON_SIZES.tab}
        weight={active ? 'fill' : 'regular'}
        color={active ? ICON_COLORS.active : ICON_COLORS.inactive}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 14,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.4)',
    overflow: 'hidden',
  },
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(17,17,17,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 8,
  },
})
