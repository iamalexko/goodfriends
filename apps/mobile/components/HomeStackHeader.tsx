import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { Plus, Bell } from 'phosphor-react-native'
import * as Haptics from 'expo-haptics'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'

import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Brand content for the Home screen's NATIVE Stack header (see
// app/(tabs)/home/_layout.tsx). Rendered as the header's TITLE element — a single
// full-width row — NOT headerLeft/headerRight, because iOS 26 wraps left/right
// bar-button items in ONE glass capsule (no opt-out in react-native-screens 4.16).
// The title view isn't wrapped, so we get full control: a BARE wordmark, the
// solid-ink "+ Plan" CTA, and a SEPARATE liquid-glass bell.

// One-time guard — some iOS 26 betas ship without the Liquid Glass API; calling
// <GlassView> there crashes (HANDOFF gotcha #16).
const LIQUID_GLASS = isLiquidGlassAvailable()

// Just the wordmark — plain title text in our font, NO glass/pill behind it.
export function HomeWordmark() {
  return <Text style={styles.wordmark}>Goodfriends.</Text>
}

// "+ Plan" — the primary CTA: solid ink (#111) pill, white icon + label.
function PlanButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.planPill}>
      <Plus size={14} weight="bold" color="#FFFFFF" />
      <Text style={styles.planLabel}>Plan</Text>
    </Pressable>
  )
}

// Bell — its OWN liquid-glass circle on iOS 26, brightened with a white tint +
// forced-light color scheme + a hairline edge so it reads against the cream.
// Flat white circle fallback on iOS 18 / unsupported. Carries the unread badge.
function BellButton({ onPress, unread }: { onPress: () => void; unread: number }) {
  const icon = <Bell size={18} weight="regular" color="#3A3A3A" />
  const badge =
    unread > 0 ? (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{unread > 9 ? '9+' : String(unread)}</Text>
      </View>
    ) : null
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.bellWrap}>
      {LIQUID_GLASS ? (
        <GlassView
          style={styles.bell}
          glassEffectStyle="regular"
          colorScheme="light"
          tintColor="#FFFFFF"
          isInteractive
        >
          {icon}
        </GlassView>
      ) : (
        <View style={[styles.bell, styles.bellFlat]}>{icon}</View>
      )}
      {badge}
    </Pressable>
  )
}

// Right-side controls: ink "+ Plan" pill + a separate glass bell, with a gap.
export function HomeHeaderActions() {
  const router = useRouter()
  const { user } = useAuth()
  const [unread, setUnread] = useState(0)

  // Live unread badge — same logic as AppHeader (kept self-contained so Home
  // doesn't depend on AppHeader). Failures are silent; the badge holds its value.
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
      <PlanButton
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
          router.push('/create' as any)
        }}
      />
      <BellButton onPress={() => router.push('/notifications' as any)} unread={unread} />
    </View>
  )
}

// Full-width header row used as the native header's TITLE element. width - 32,
// centered in the (transparent) bar → a 16pt margin each side, matching the old
// AppHeader's paddingHorizontal. Wordmark left, "+ Plan" + bell right.
export function HomeHeaderRow() {
  const { width } = useWindowDimensions()
  return (
    <View style={{ width: width - 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <HomeWordmark />
      <HomeHeaderActions />
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
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  planLabel: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  bellWrap: {
    width: 34,
    height: 34,
  },
  bell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.10)',
  },
  bellFlat: {
    backgroundColor: '#FFFFFF',
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
