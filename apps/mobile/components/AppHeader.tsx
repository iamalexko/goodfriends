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
import { LinearGradient } from 'expo-linear-gradient'
import MaskedView from '@react-native-masked-view/masked-view'

import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Pattern 2 fixed app header.
//
// The wordmark + "+ Plan" pill + bell are ALWAYS visible (they never
// translate / fade); only the *background* animates. At scrollY 0 the
// background is invisible — the buttons sit on warm paper. By scrollY 40
// the glass background has faded fully in.
//
// The key trick is that the glass doesn't end at a hard edge. A
// MaskedView + vertical LinearGradient feathers the bottom 24px of the
// background to transparent, so the material dissolves into the feed
// instead of cutting off at a hairline border (which is what makes a
// regular BlurView read as "blur panel" instead of "iOS glass").
//
// On iOS 26 (where `isLiquidGlassAvailable()` returns true), the
// material is `GlassView` so we get UIKit's progressive lens. On
// earlier iOS / Android, we fall back to a masked BlurView — same
// feather, just a uniform blur radius instead of progressive.
const LIQUID = isLiquidGlassAvailable()

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

  // Glass fades in over the first 40px of scroll, clamped.
  const glassStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 40], [0, 1], Extrapolation.CLAMP),
  }))

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]} pointerEvents="box-none">
      {/* Animated glass background — fades in, feathers at bottom. */}
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

// The glass background. Sized to header height + FADE so the LinearGradient
// mask can ramp from opaque (over the header rows) to fully transparent at
// the bottom — the feather that kills the cut-off seam.
function GlassBlend({ topInset }: { topInset: number }) {
  const HEADER_H = topInset + 52
  const FADE = 24

  // iOS 26 `regular` glass alone reads too subtle against a warm-paper
  // background — almost transparent. A nearly-opaque warm tint biases the
  // material toward the page color so the glass reads as a clear soft frost
  // panel (still refracts content beneath via the underlying GlassView
  // lens). For the BlurView fallback, intensity 90 = Apple's "system thick".
  const Material = LIQUID ? (
    <GlassView
      style={{ flex: 1 }}
      glassEffectStyle="regular"
      tintColor="rgba(255, 251, 245, 0.85)"
    />
  ) : (
    <BlurView intensity={90} tint="light" style={{ flex: 1 }} />
  )

  return (
    <MaskedView
      style={{ height: HEADER_H + FADE }}
      maskElement={
        <LinearGradient
          colors={['#000', '#000', 'transparent']}
          locations={[0, HEADER_H / (HEADER_H + FADE), 1]}
          style={{ flex: 1 }}
        />
      }
    >
      {Material}
    </MaskedView>
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
