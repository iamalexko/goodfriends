import { useEffect } from 'react'
import { View, Pressable, StyleSheet } from 'react-native'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useRouter, usePathname } from 'expo-router'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

// iOS 26-style Liquid Glass tab bar with an animated lens that slides between
// tabs with spring overshoot and a horizontal stretch during travel.

const ITEM_W = 52
const FAB_W = 52
const LENS_W = 48
const PAD = 6

type Tab = {
  name: string
  route: string
  icon?: keyof typeof Ionicons.glyphMap
  outline?: keyof typeof Ionicons.glyphMap
  isFab?: boolean
  slot: number
}

// Tab layout: home, crew, [FAB], plans, profile.
// The lens lives in the same row as the icons but skips the FAB slot — when
// we're on /create the lens hides offscreen-left.
const TABS: Tab[] = [
  { name: 'home',    route: '/(tabs)/home',    icon: 'home',     outline: 'home-outline',     slot: 0 },
  { name: 'crew',    route: '/(tabs)/crew',    icon: 'people',   outline: 'people-outline',   slot: 1 },
  { name: 'create',  route: '/(tabs)/create',  isFab: true,                                   slot: 2 },
  { name: 'plans',   route: '/(tabs)/plans',   icon: 'calendar', outline: 'calendar-outline', slot: 3 },
  { name: 'profile', route: '/(tabs)/profile', icon: 'person',   outline: 'person-outline',   slot: 4 },
]

function lensX(slot: number) {
  return PAD + slot * ITEM_W + (ITEM_W - LENS_W) / 2
}

export function LiquidGlassTabBar() {
  const router = useRouter()
  const pathname = usePathname()

  const activeTab = TABS.find((t) => pathname?.includes(t.name)) ?? TABS[0]
  const activeSlot = activeTab.slot

  const x = useSharedValue(lensX(activeSlot))
  const stretch = useSharedValue(1)
  const lensOpacity = useSharedValue(activeTab.isFab ? 0 : 1)

  useEffect(() => {
    // Hide the lens entirely when the FAB slot is "active" (we're on /create)
    if (activeTab.isFab) {
      lensOpacity.value = withTiming(0, { duration: 120 })
      return
    }
    lensOpacity.value = withTiming(1, { duration: 120 })

    // Spring with overshoot — the lens snaps into the new slot
    x.value = withSpring(lensX(activeSlot), { damping: 14, stiffness: 140, mass: 0.8 })
    // Quick horizontal stretch then spring back to 1 — gives the lens that
    // "elongating-glass" feel mid-travel
    stretch.value = withSequence(
      withTiming(1.35, { duration: 160 }),
      withSpring(1, { damping: 12, stiffness: 180 }),
    )
  }, [activeSlot, activeTab.isFab])

  const lensStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { scaleX: stretch.value }],
    opacity: lensOpacity.value,
  }))

  function go(route: string, isFab?: boolean) {
    Haptics.impactAsync(
      isFab ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    ).catch(() => {})
    router.push(route as any)
  }

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <BlurView intensity={60} tint="light" style={styles.pill}>
        <View style={styles.innerHighlight} pointerEvents="none" />

        {/* Animated sliding lens — behind the icons */}
        <Animated.View style={[styles.lens, lensStyle]} pointerEvents="none">
          <View style={styles.lensHighlight} />
        </Animated.View>

        {TABS.map((tab) => {
          const isActive = pathname?.includes(tab.name) ?? false

          if (tab.isFab) {
            return (
              <Pressable
                key={tab.name}
                onPress={() => go(tab.route, true)}
                style={styles.fabSlot}
              >
                <View style={styles.fab}>
                  <Ionicons name="add" size={22} color="#fff" />
                </View>
              </Pressable>
            )
          }

          return (
            <Pressable key={tab.name} onPress={() => go(tab.route)} style={styles.item}>
              <AnimatedIcon active={isActive} icon={tab.icon!} outline={tab.outline!} />
            </Pressable>
          )
        })}
      </BlurView>
    </View>
  )
}

// Spring-scales up slightly when active so the icon "lifts" as the lens arrives.
function AnimatedIcon({
  active,
  icon,
  outline,
}: {
  active: boolean
  icon: keyof typeof Ionicons.glyphMap
  outline: keyof typeof Ionicons.glyphMap
}) {
  const scale = useSharedValue(active ? 1.12 : 1)
  useEffect(() => {
    scale.value = withSpring(active ? 1.12 : 1, { damping: 12, stiffness: 180 })
  }, [active])

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Animated.View style={style}>
      <Ionicons
        name={(active ? icon : outline) as keyof typeof Ionicons.glyphMap}
        size={22}
        color={active ? '#111' : '#666'}
      />
    </Animated.View>
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
    paddingHorizontal: PAD,
    paddingVertical: PAD,
    borderRadius: 34,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
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
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  lens: {
    position: 'absolute',
    top: PAD,
    left: 0,
    width: LENS_W,
    height: 42,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  lensHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  item: {
    width: ITEM_W,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabSlot: {
    width: FAB_W,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(17,17,17,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
})
