import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'

import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Sticky top bar with the Goodfriends. wordmark on the left, an unread-
// badged bell + the user's emoji avatar on the right. The avatar opens
// the profile tab; the bell opens notifications.
export function TopBar() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { profile, user } = useAuth()
  const [unread, setUnread] = useState(0)

  // Subscribe to notifications so the badge stays live.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)
      if (!cancelled) setUnread(count || 0)
    })()

    const channel = supabase
      .channel('notif-count-' + user.id)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => setUnread((n) => n + 1),
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [user])

  return (
    <View
      style={{
        paddingTop: Math.max(12, insets.top),
        paddingBottom: 12,
        paddingHorizontal: 20,
        backgroundColor: '#FFFBF5',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.06)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Text
        style={{
          fontFamily: 'PlusJakartaSans_800ExtraBold',
          fontSize: 15,
          fontWeight: '800',
          color: '#111111',
          letterSpacing: -0.3,
        }}
      >
        Goodfriends.
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {/* Bell with optional unread badge */}
        <Pressable
          onPress={() => router.push('/notifications' as any)}
          hitSlop={6}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: 'rgba(0,0,0,0.05)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="notifications-outline" size={14} color="#111111" />
          {unread > 0 && (
            <View
              style={{
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
              }}
            >
              <Text style={{ fontSize: 8, fontWeight: '700', color: '#FFFFFF', lineHeight: 10 }}>
                {unread > 9 ? '9+' : String(unread)}
              </Text>
            </View>
          )}
        </Pressable>

        {/* Profile emoji shortcut */}
        <Pressable
          onPress={() => router.push('/(tabs)/profile' as any)}
          hitSlop={6}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: '#F3F4F6',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 16 }}>{profile?.emoji || '😎'}</Text>
        </Pressable>
      </View>
    </View>
  )
}
