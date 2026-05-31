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
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { BlurView } from 'expo-blur'

import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Pattern 2 fixed app header.
//
// The wordmark + "+ Plan" pill + bell are ALWAYS visible and pinned. The
// background crossfades on scroll between two layers:
//   • at rest  → a SOLID cream panel matching the page, so the header is
//     invisible and seamless with the feed (no glass edge-shadow);
//   • scrolled → the real iOS 26 Liquid Glass (live lens).
// See AppHeader's body for the crossfade and GlassBlend for the material.
const LIQUID = isLiquidGlassAvailable()

// Warm-paper page color — must match the screens' backgroundColor so the
// at-rest header is indistinguishable from the content behind it.
const PAGE_BG = '#FFFBF5'

// Scroll distance (px) over which the solid→glass crossfade completes.
const FADE_DISTANCE = 40

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

  // Two background layers crossfade on scroll:
  //   • At rest (scrollY 0): a SOLID cream panel, fully opaque. Same color as
  //     the page, no shadow — so the header is invisible / blends seamlessly
  //     with the content below. (The native glass edge-shadow only appears
  //     when the GlassView itself is visible, so hiding the glass at rest
  //     removes the shadow.)
  //   • Scrolled (scrollY ≥ FADE_DISTANCE): the real Liquid Glass.
  // The two opacities are exact inverses → a clean crossfade.
  // TEMP_PULSE_DIAG: self-pulsing opacity, independent of scroll, to test
  // whether a GlassView can be opacity-animated at all.
  const pulse = useSharedValue(0)
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 2000 }), -1, true)
  }, [])
  const glassStyle = useAnimatedStyle(() => ({ opacity: pulse.value }))
  const solidStyle = useAnimatedStyle(() => ({ opacity: 1 - pulse.value }))

  const bgHeight = insets.top + APP_HEADER_ROW_HEIGHT

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]} pointerEvents="box-none">
      {/* Solid cream panel — visible at rest, fades out on scroll. Blends with
          the page so there's no header edge / shadow when not scrolled. */}
      <Animated.View
        style={[StyleSheet.absoluteFill, solidStyle]}
        pointerEvents="none"
      >
        <View style={{ height: bgHeight, backgroundColor: PAGE_BG }} />
      </Animated.View>

      {/* Liquid glass — fades in on scroll. */}
      <Animated.View
        style={[StyleSheet.absoluteFill, glassStyle]}
        pointerEvents="none"
      >
        <GlassBlend topInset={insets.top} />
      </Animated.View>

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

// Visibility knobs — `regular` glass over the warm-paper background is subtle
// (the lens has little tonal contrast to refract), so a warm tint biased
// toward the page color gives it presence. 0.85 is intentionally strong: it
// reads as a clear warm-frost panel while the underlying GlassView still
// refracts content beneath (verified on iOS 26 — the title that scrolls under
// the header blurs). Lower toward ~0.5 for a more transparent, airier look;
// raise toward 1.0 for a near-solid bar.
//
// NB: GlassView's native tint only re-applies on a FULL app reload, not Fast
// Refresh — if a tint tweak looks like a no-op, relaunch the app.
const GLASS_STYLE = 'regular' as const
// Lower tint (0.3) so the SCROLLED glass state is visually distinct from the
// at-rest solid cream panel — otherwise we'd be crossfading cream→cream and
// the transition would be imperceptible. At this tint the lens reads as real
// glass (content/cards show through, frosted) rather than a flat color.
const TINT = 'rgba(255, 251, 245, 0.3)'

// The glass background — a single real iOS 26 GlassView (live lens /
// refraction) the full height of the header, with a clean straight bottom
// edge. No feather.
//
// REQUIREMENT: the background MUST be a real `GlassView`, not a BlurView and
// not a tinted-paper approximation. (iOS < 26 / Android: GlassView isn't
// available, so it falls back to a BlurView.)
function GlassBlend({ topInset }: { topInset: number }) {
  const HEADER_H = topInset + 52

  return LIQUID ? (
    <GlassView
      style={{ height: HEADER_H }}
      glassEffectStyle={GLASS_STYLE}
      tintColor={TINT}
    />
  ) : (
    <BlurView intensity={90} tint="light" style={{ height: HEADER_H }} />
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
