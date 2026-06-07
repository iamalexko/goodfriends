import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Plus, Bell } from 'phosphor-react-native'
import * as Haptics from 'expo-haptics'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'

import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Brand content for the Home screen's NATIVE Stack header (one-screen spike —
// see app/(tabs)/home/_layout.tsx). Replaces the custom AppHeader on Home only;
// other screens still render <AppHeader>.
//
// Two pieces: HomeWordmark (headerLeft) keeps OUR font; HomeHeaderActions
// (headerRight) is the "+ Plan" ink pill + a bell whose chip is REAL iOS 26
// Liquid Glass when available, and the flat circular fallback otherwise.

// One-time guard at module load — some iOS 26 beta builds ship without the
// Liquid Glass API; calling <GlassView> there crashes. (See HANDOFF gotcha #16.)
const LIQUID_GLASS = isLiquidGlassAvailable()

// headerLeft — our wordmark in OUR font, matched to the old AppHeader exactly
// (Plus Jakarta Sans 800 ExtraBold, ink #111, fontSize 18, letterSpacing -0.4).
// This is our own <Text>, NOT the system navigation title.
export function HomeWordmark() {
  return <Text style={styles.wordmark}>Goodfriends.</Text>
}

// A 34pt circular button whose background is real Liquid Glass on iOS 26 and a
// flat rgba(0,0,0,0.05) circle on iOS 18 / unsupported. Icon + optional badge
// layer above. Pressable wraps the chip so taps work in both states.
function GlassChipButton({
  onPress,
  children,
}: {
  onPress: () => void
  children: React.ReactNode
}) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.chipWrap}>
      {LIQUID_GLASS ? (
        <GlassView style={styles.chip} glassEffectStyle="regular" isInteractive>
          {children}
        </GlassView>
      ) : (
        <View style={[styles.chip, styles.chipFlat]}>{children}</View>
      )}
    </Pressable>
  )
}

// headerRight — "+ Plan" ink pill + glass/flat bell with live unread badge.
export function HomeHeaderActions() {
  const router = useRouter()
  const { user } = useAuth()
  const [unread, setUnread] = useState(0)

  // Live unread badge — same logic as AppHeader (kept self-contained so the
  // Home spike doesn't depend on AppHeader). Failures are silent; the badge
  // just holds its last value.
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
        if (__DEV__) console.warn('HomeHeader: notifications count failed', err)
      }
    })()

    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      channel = supabase
        .channel('home-notif-count-' + user.id)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          () => setUnread((n) => n + 1),
        )
        .subscribe((status, err) => {
          if (err && __DEV__) console.warn('HomeHeader: notifications channel error', status, err)
        })
    } catch (err) {
      if (__DEV__) console.warn('HomeHeader: notifications subscribe threw', err)
    }

    return () => {
      cancelled = true
      if (channel) {
        try { supabase.removeChannel(channel) } catch {}
      }
    }
  }, [user])

  return (
    <View style={styles.actions}>
      {/* Primary CTA stays solid ink (design system: primary = ink fill). */}
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

      {/* Bell rides real Liquid Glass on iOS 26, flat circle otherwise. */}
      <GlassChipButton onPress={() => router.push('/notifications' as any)}>
        <Bell size={18} weight="regular" color="#555555" />
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : String(unread)}</Text>
          </View>
        )}
      </GlassChipButton>
    </View>
  )
}

const styles = StyleSheet.create({
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
  chipWrap: {
    width: 34,
    height: 34,
  },
  chip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipFlat: {
    backgroundColor: 'rgba(0,0,0,0.05)',
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
