import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { Plus, Bell } from 'phosphor-react-native'
import * as Haptics from 'expo-haptics'

import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Brand content for the Home screen's NATIVE Stack header (see
// app/(tabs)/home/_layout.tsx). Rendered as the header's TITLE element — a single
// full-width row — NOT headerLeft/headerRight. Why: iOS 26 wraps left/right
// bar-button items in glass "shared background" capsules and react-native-screens
// 4.16 exposes no opt-out, which put an unwanted pill behind the wordmark and
// grouped "+ Plan" + bell into one capsule. The title view is not wrapped, so
// rendering the whole row as the title keeps the wordmark bare and the two
// buttons distinct — matching the original AppHeader layout — while the native
// iOS 26 glass BAR (and the NativeTabs bar) still provide the glass.

// headerLeft content — our wordmark in OUR font, matched to the old AppHeader
// exactly (Plus Jakarta Sans 800, ink #111, fontSize 18, letterSpacing -0.4).
export function HomeWordmark() {
  return <Text style={styles.wordmark}>Goodfriends.</Text>
}

// Right-side controls: "+ Plan" ink pill + a SEPARATE flat bell circle (matching
// the original AppHeader) with a live unread badge. Two independent buttons, gap
// between them — no shared background.
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
      {/* "+ Plan" — its own ink pill (primary CTA = ink fill). */}
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

      {/* Bell — its own separate flat circle, with the unread badge. */}
      <Pressable onPress={() => router.push('/notifications' as any)} hitSlop={6} style={styles.bell}>
        <Bell size={18} weight="regular" color="#555555" />
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : String(unread)}</Text>
          </View>
        )}
      </Pressable>
    </View>
  )
}

// Full-width header row used as the native header's TITLE element. width - 32,
// centered in the bar → a 16pt margin each side (matches the old AppHeader's
// paddingHorizontal). Wordmark left, actions right, space-between.
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
    width: 34,
    height: 34,
    borderRadius: 17,
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
