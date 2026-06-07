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
// full-width row — NOT headerLeft/headerRight. Why: iOS 26 wraps left/right
// bar-button items in ONE glass "shared background" capsule (no opt-out in
// react-native-screens 4.16), which put a pill behind the wordmark and grouped
// the two buttons. The title view is not wrapped, so rendering the row as the
// title gives us full control: a BARE wordmark + two SEPARATE buttons that each
// carry their OWN liquid glass.

// One-time guard — some iOS 26 betas ship without the Liquid Glass API; calling
// <GlassView> there crashes (HANDOFF gotcha #16).
const LIQUID_GLASS = isLiquidGlassAvailable()

// Just the wordmark — plain title text in our font, NO glass/pill behind it.
export function HomeWordmark() {
  return <Text style={styles.wordmark}>Goodfriends.</Text>
}

// "+ Plan" — its OWN liquid-glass pill on iOS 26; solid-ink pill fallback on
// iOS 18 / unsupported.
function PlanButton({ onPress }: { onPress: () => void }) {
  const fg = LIQUID_GLASS ? '#111111' : '#FFFFFF'
  const inner = (
    <View style={styles.planInner}>
      <Plus size={14} weight="bold" color={fg} />
      <Text style={[styles.planLabel, { color: fg }]}>Plan</Text>
    </View>
  )
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      {LIQUID_GLASS ? (
        <GlassView style={styles.planGlass} glassEffectStyle="regular" isInteractive>
          {inner}
        </GlassView>
      ) : (
        <View style={styles.planInk}>{inner}</View>
      )}
    </Pressable>
  )
}

// Bell — its OWN liquid-glass circle on iOS 26; flat rgba(0,0,0,0.05) circle
// fallback. Carries the live unread badge.
function BellButton({ onPress, unread }: { onPress: () => void; unread: number }) {
  const icon = <Bell size={18} weight="regular" color="#555555" />
  const badge =
    unread > 0 ? (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{unread > 9 ? '9+' : String(unread)}</Text>
      </View>
    ) : null
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.bellWrap}>
      {LIQUID_GLASS ? (
        <GlassView style={styles.bellGlass} glassEffectStyle="regular" isInteractive>
          {icon}
        </GlassView>
      ) : (
        <View style={[styles.bellGlass, styles.bellFlat]}>{icon}</View>
      )}
      {badge}
    </Pressable>
  )
}

// Right-side controls: two INDEPENDENT glass buttons with a gap between them.
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
// AppHeader's paddingHorizontal. Wordmark left, the two glass buttons right.
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
  // "+ Plan" — glass pill (iOS 26) vs ink pill (fallback). Both clip to the pill
  // radius; `inner` holds the icon + label so the glass material sits behind them.
  planGlass: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  planInk: {
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#111111',
  },
  planInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  planLabel: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  // Bell — glass circle (iOS 26) vs flat circle (fallback).
  bellWrap: {
    width: 34,
    height: 34,
  },
  bellGlass: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellFlat: {
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
