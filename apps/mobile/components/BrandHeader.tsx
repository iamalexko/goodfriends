import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useRouter } from 'expo-router'
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack'
import { Plus, Bell } from 'phosphor-react-native'
import * as Haptics from 'expo-haptics'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'

import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Shared brand content for the tab screens' NATIVE Stack headers (Home, Crew,
// Plans, Profile — each a Stack nested under its tab). Rendered as the header's
// TITLE element — a single full-width row — NOT headerLeft/headerRight, because
// iOS 26 wraps left/right bar-button items in ONE glass capsule (no opt-out in
// react-native-screens 4.16). The title view isn't wrapped, so we get full
// control: a BARE wordmark, the BLACK liquid-glass "+ Plan" CTA, and a SEPARATE
// liquid-glass bell. Spread `brandStackScreenOptions` into each tab's <Stack>.

// One-time guard — some iOS 26 betas ship without the Liquid Glass API; calling
// <GlassView> there crashes (HANDOFF gotcha #16).
const LIQUID_GLASS = isLiquidGlassAvailable()

// Just the wordmark — plain title text in our font, NO glass/pill behind it.
export function HomeWordmark() {
  return <Text style={styles.wordmark}>Goodfriends.</Text>
}

// "+ Plan" — the primary CTA as a BLACK liquid-glass pill: GlassView tinted ink
// (#111) with a dark color scheme + white icon/label. Solid-ink pill fallback on
// iOS 18 / unsupported. Stays black-with-white either way.
function PlanButton({ onPress }: { onPress: () => void }) {
  const inner = (
    <View style={styles.planInner}>
      <Plus size={14} weight="bold" color="#FFFFFF" />
      <Text style={styles.planLabel}>Plan</Text>
    </View>
  )
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      {LIQUID_GLASS ? (
        <GlassView
          style={styles.planGlass}
          glassEffectStyle="regular"
          colorScheme="dark"
          tintColor="#000000"
          isInteractive
        >
          {/* Translucent dark fill deepens the glass (the tint alone reads light
              over cream) while keeping the liquid-glass highlights. */}
          <View style={[StyleSheet.absoluteFill, styles.planDarken]} />
          {inner}
        </GlassView>
      ) : (
        <View style={[styles.planGlass, styles.planInk]}>{inner}</View>
      )}
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
export function BrandHeaderRow() {
  const { width } = useWindowDimensions()
  return (
    <View style={{ width: width - 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <HomeWordmark />
      <HomeHeaderActions />
    </View>
  )
}

// Shared screenOptions for a tab's native Stack header — transparent bar (iOS
// renders its own glass) + our full-width brand row as the title (avoids the
// iOS 26 left/right bar-button capsules). Spread into each tab's <Stack>.
export const brandStackScreenOptions: NativeStackNavigationOptions = {
  headerShown: true,
  headerTransparent: true,
  headerTitleAlign: 'center',
  headerTitle: () => <BrandHeaderRow />,
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
  planGlass: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  planInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  planInk: {
    backgroundColor: '#111111',
  },
  planDarken: {
    backgroundColor: 'rgba(0,0,0,0.55)',
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
