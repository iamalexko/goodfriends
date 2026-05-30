import { useEffect, useState } from 'react'
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
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import type { ComponentType } from 'react'

import { GlassSurface } from './GlassSurface'

// News+ style nav: a floating Liquid Glass pill with 4 labelled tabs +
// a detached dark Create circle to the right. The pill carries a brighter
// glass "lens" that springs to the active tab, mirroring the native iOS 26
// behaviour where a highlight follows the selection.

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

const TAB_COUNT = TABS.length
const LENS_INSET = 6

export function LiquidGlassTabBar() {
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()

  // Index of the active pill tab, or -1 if we're on /create (the detached
  // circle's screen). -1 hides the lens entirely.
  const activeIndex = TABS.findIndex((t) => pathname?.includes(t.name) ?? false)

  const [pillWidth, setPillWidth] = useState(0)
  const slotWidth = pillWidth / TAB_COUNT

  const x = useSharedValue(0)
  const stretch = useSharedValue(1)
  const lensOpacity = useSharedValue(activeIndex >= 0 ? 1 : 0)

  useEffect(() => {
    if (activeIndex < 0) {
      lensOpacity.value = withTiming(0, { duration: 140 })
      return
    }
    lensOpacity.value = withTiming(1, { duration: 140 })
    if (!slotWidth) return
    x.value = withSpring(activeIndex * slotWidth + LENS_INSET, {
      damping: 15,
      stiffness: 150,
      mass: 0.8,
    })
    stretch.value = withSequence(
      withTiming(1.25, { duration: 150 }),
      withSpring(1, { damping: 13, stiffness: 180 }),
    )
  }, [activeIndex, slotWidth])

  const lensStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { scaleX: stretch.value }],
    width: Math.max(0, slotWidth - LENS_INSET * 2),
    opacity: lensOpacity.value,
  }))

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
      {/* Floating glass pill with the sliding lens behind the icons */}
      <GlassSurface style={styles.pill} radius={34} interactive>
        <View
          style={styles.pillInner}
          onLayout={(e) => setPillWidth(e.nativeEvent.layout.width)}
        >
          {/* Brighter glass lens that springs between tabs. Sits above the
              base pill glass, below the icons. This is the one intentional
              exception to the "never stack glass on glass" rule — mirrors
              the native iOS 26 control. */}
          {slotWidth > 0 && (
            <Animated.View style={[styles.lens, lensStyle]} pointerEvents="none">
              <GlassSurface
                variant="chrome"
                radius={24}
                style={StyleSheet.absoluteFill}
                interactive
              />
            </Animated.View>
          )}

          {TABS.map((tab) => {
            const isActive = pathname?.includes(tab.name) ?? false
            return (
              <Pressable
                key={tab.name}
                onPress={() => go(tab.route)}
                style={styles.tab}
              >
                <TabContent active={isActive} Icon={tab.Icon} label={tab.label} />
              </Pressable>
            )
          })}
        </View>
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
    paddingVertical: 11,
    paddingHorizontal: 6,
  },
  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  lens: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    left: 0,
    borderRadius: 24,
    overflow: 'hidden',
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
