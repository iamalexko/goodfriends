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
// The wordmark + "+ Plan" pill + bell are ALWAYS visible (they never
// translate / fade); only the *background* animates. At scrollY 0 the
// background is invisible — the buttons sit on warm paper. By scrollY 40
// the glass background has faded fully in.
//
// The background is a REAL iOS 26 GlassView (live lens), feathered at the
// bottom by a stack of stepped-opacity glass strips so it dissolves into the
// feed with no hard cut-off line — never a mask or a paper gradient. See
// GlassBlend below for the full rationale.
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

// The glass background. Real iOS 26 Liquid Glass, feathered at the bottom.
//
// REQUIREMENT: the header background MUST be a real `GlassView` (live lens /
// refraction), not a BlurView and not a tinted-paper approximation.
//
// The hard part is feathering its bottom edge. You CANNOT do it with a
// `MaskedView`: the mask snapshots its subtree to an alpha bitmap, and the
// glass material is a separate real-time backdrop pass that doesn't survive
// the snapshot — so a masked GlassView renders only its flat tint, no blur
// (the "I see no glass" bug). A warm-paper gradient laid OVER the glass also
// isn't real glass — it just paints page color on top.
//
// So we feather with REAL glass: a stack of thin GlassView strips down the
// fade zone, each a genuine unmasked lens, with stepped opacity from ~0.89
// at the top of the fade to ~0.11 at the bottom. Ancestor/instance opacity
// attenuates the live glass, so the lens dissolves progressively into the
// feed — real glass all the way down, no mask, no paper.
//
// (iOS < 26 / Android: GlassView isn't available, so the solid region and
// the strips use BlurView instead — same stepped-opacity feather.)
// Visibility knobs — `regular` glass over the warm-paper background is subtle
// (the lens has little tonal contrast to refract), so a warm tint biased
// toward the page color gives it presence. 0.85 is intentionally strong: it
// reads as a clear warm-frost panel while the underlying GlassView still
// refracts content beneath (verified on iOS 26 — the title that scrolls under
// the header blurs; content below the feather stays sharp). Lower toward ~0.5
// for a more transparent, airier look; raise toward 1.0 for a near-solid bar.
//
// NB: GlassView's native tint only re-applies on a FULL app reload, not Fast
// Refresh — if a tint tweak looks like a no-op, relaunch the app.
const GLASS_STYLE = 'regular' as const
const TINT = 'rgba(255, 251, 245, 0.85)'

function GlassBlend({ topInset }: { topInset: number }) {
  const HEADER_H = topInset + 52
  const FADE = 32
  const STRIPS = 8
  const stripH = FADE / STRIPS

  // Solid region — full-strength real glass behind the header rows.
  const Solid = LIQUID ? (
    <GlassView
      style={{ height: HEADER_H }}
      glassEffectStyle={GLASS_STYLE}
      tintColor={TINT}
    />
  ) : (
    <BlurView intensity={90} tint="light" style={{ height: HEADER_H }} />
  )

  return (
    <View style={{ height: HEADER_H + FADE }}>
      {Solid}

      {/* Progressive feather: real-glass strips with stepped opacity. Strip i
          sits just below the solid region; opacity ramps 1→0 going down so
          the lens dissolves into the content with no hard cut-off line. */}
      {Array.from({ length: STRIPS }).map((_, i) => {
        const opacity = 1 - (i + 1) / (STRIPS + 1)
        const top = HEADER_H + i * stripH
        const stripStyle = {
          position: 'absolute' as const,
          left: 0,
          right: 0,
          top,
          // +0.5 overlap so sub-pixel rounding can't leave gaps.
          height: stripH + 0.5,
          opacity,
        }
        return LIQUID ? (
          <GlassView
            key={i}
            glassEffectStyle={GLASS_STYLE}
            tintColor={TINT}
            style={stripStyle}
          />
        ) : (
          <BlurView key={i} intensity={90} tint="light" style={stripStyle} />
        )
      })}
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
