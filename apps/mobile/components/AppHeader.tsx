import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Plus, Bell } from 'phosphor-react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated'
import { BlurView } from 'expo-blur'

import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Pattern 2 fixed app header.
//
// The wordmark + "+ Plan" pill + bell are ALWAYS visible and pinned. The
// background is a frosted-glass BlurView that fades in on scroll:
//   • at rest (scrollY 0): the blur is fully transparent, so the header reads
//     as seamless cream with the feed behind it (no edge, no shadow);
//   • scrolled (scrollY ≥ FADE_DISTANCE): the blur is fully opaque, frosting
//     the content that scrolls underneath.
//
// We use expo-blur's BlurView (not iOS 26 GlassView) on purpose: a BlurView's
// effect alpha-animates reliably, so the scroll crossfade actually works.
// GlassView's native lens does not fade via opacity, which made the crossfade
// invisible.
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView)

// Scroll distance (px) over which the blur fades in.
const FADE_DISTANCE = 40

// Blur strength once fully revealed. ~85 reads as a clear frosted panel over
// the warm-paper content without going fully opaque.
const BLUR_INTENSITY = 85

export function AppHeader({ scrollY }: { scrollY: SharedValue<number> }) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user } = useAuth()
  const [unread, setUnread] = useState(0)

  // Live unread badge — copied verbatim from the old TopBar so the
  // notification dot still works under the new header. Wrapped because
  // (a) the initial count can fail under cold network / RLS race, and
  // (b) the realtime websocket sometimes errors with a generic
  // "TypeError: Network request failed" on iOS sim. Silent failure is
  // fine; the badge just stays at its last known value.
  useEffect(() => {
    if (!user) return
    let cancelled = false

    ;(async () => {
      try {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false)
        if (!cancelled) setUnread(count || 0)
      } catch (err) {
        if (__DEV__) console.warn('AppHeader: notifications count failed', err)
      }
    })()

    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      channel = supabase
        .channel('notif-count-' + user.id)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          () => setUnread((n) => n + 1),
        )
        .subscribe((status, err) => {
          if (err && __DEV__) console.warn('AppHeader: notifications channel error', status, err)
        })
    } catch (err) {
      if (__DEV__) console.warn('AppHeader: notifications subscribe threw', err)
    }

    return () => {
      cancelled = true
      if (channel) {
        try { supabase.removeChannel(channel) } catch {}
      }
    }
  }, [user])

  // Frosted-glass background fades in over the first FADE_DISTANCE px of scroll.
  const blurStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, FADE_DISTANCE], [0, 1], Extrapolation.CLAMP),
  }))

  const bgHeight = insets.top + APP_HEADER_ROW_HEIGHT

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]} pointerEvents="box-none">
      {/* Frosted-glass background — fades in on scroll. */}
      <AnimatedBlurView
        intensity={BLUR_INTENSITY}
        tint="light"
        style={[styles.blur, { height: bgHeight }, blurStyle]}
        pointerEvents="none"
      />

      {/* Always-visible content row. */}
      <View style={styles.row}>
        <Text style={styles.wordmark}>Goodfriends.</Text>

        <View style={styles.actions}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
              router.push('/create' as any)
            }}
            hitSlop={6}
            style={styles.planPill}
          >
            <Plus size={14} weight="bold" color="#FFFFFF" />
            <Text style={styles.planLabel}>Plan</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/notifications' as any)}
            hitSlop={6}
            style={styles.bell}
          >
            <Bell size={18} weight="regular" color="#555555" />
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unread > 9 ? '9+' : String(unread)}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  )
}

// Header height is `safeAreaTop + 52` (the row). Screens should leave at
// least that much top padding on the first ScrollView so content doesn't
// start under the wordmark at rest. Exported for use in screens — keeps
// the magic number in one place.
export const APP_HEADER_ROW_HEIGHT = 52

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  blur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
  },
  wordmark: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 18,
    color: '#111111',
    letterSpacing: -0.4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111111',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  planLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  bell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 14,
    height: 14,
    paddingHorizontal: 3,
    borderRadius: 7,
    backgroundColor: '#FB923C',
    borderWidth: 2,
    borderColor: '#FFFBF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 10,
  },
})
