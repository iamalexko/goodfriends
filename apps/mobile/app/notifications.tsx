import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  CalendarPlus,
  Check,
  ChatCircle,
  CheckCircle,
  XCircle,
  Clock,
  TrendUp,
  WarningCircle,
  Camera,
  Smiley,
  UserPlus,
  UserCirclePlus,
  Bell,
  type IconProps,
} from 'phosphor-react-native'

import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { BackButton } from '../components/BackButton'
import { Loader } from '../components/Loader'

// Map notification.type → an icon component + chip colors. Mirrors the web
// TYPE_ICON table (Tabler → Phosphor). Falls back to a generic bell.
type IconCmp = (p: IconProps) => JSX.Element
const TYPE_META: Record<string, { Icon: IconCmp; color: string; bg: string }> = {
  event_invite:           { Icon: CalendarPlus,    color: '#FB923C', bg: '#FEF3C7' },
  event_rsvp:             { Icon: Check,           color: '#16A34A', bg: '#DCFCE7' },
  event_comment:          { Icon: ChatCircle,      color: '#818CF8', bg: '#EEF2FF' },
  event_closed:           { Icon: CheckCircle,     color: '#16A34A', bg: '#DCFCE7' },
  event_cancelled:        { Icon: XCircle,         color: '#EF4444', bg: '#FEE2E2' },
  event_reminder:         { Icon: Clock,           color: '#FB923C', bg: '#FEF3C7' },
  event_filling:          { Icon: TrendUp,         color: '#F472B6', bg: '#FDF2F8' },
  no_reply_nudge:         { Icon: WarningCircle,    color: '#FB923C', bg: '#FEF3C7' },
  photo_posted:           { Icon: Camera,          color: '#818CF8', bg: '#EEF2FF' },
  reaction_received:      { Icon: Smiley,          color: '#F472B6', bg: '#FDF2F8' },
  event_invite_request:   { Icon: UserPlus,        color: '#FB923C', bg: '#FEF3C7' },
  event_request_approved: { Icon: UserCirclePlus,  color: '#16A34A', bg: '#DCFCE7' },
  event_request_rejected: { Icon: XCircle,         color: '#EF4444', bg: '#FEE2E2' },
}
const FALLBACK = { Icon: Bell as IconCmp, color: '#FB923C', bg: '#FEF3C7' }

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

type Notif = {
  id: string
  type: string
  title: string | null
  body: string | null
  read: boolean
  created_at: string
  plan_id: string | null
  plan?: { name: string | null } | null
}

export default function Notifications() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()

  const [items, setItems] = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    load()
    markAllRead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function load() {
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:actor_id(display_name, emoji), plan:plan_id(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setItems(data as Notif[])
    setLoading(false)
  }

  // Clear the unread badge (AppHeader watches this table). Best-effort.
  async function markAllRead() {
    if (!user) return
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)
    } catch (err) {
      if (__DEV__) console.warn('Notifications: markAllRead failed', err)
    }
  }

  function goBack() {
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)/home' as any)
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFBF5', paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' }}>
        <BackButton onPress={goBack} />
        <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, fontWeight: '800', color: '#111111', letterSpacing: -0.3 }}>
          Notifications
        </Text>
      </View>

      {loading ? (
        <Loader />
      ) : items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingBottom: 80 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🔔</Text>
          <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, fontWeight: '800', color: '#111111', marginBottom: 6 }}>
            All caught up
          </Text>
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: '#AAAAAA', textAlign: 'center' }}>
            Notifications will appear here
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: Math.max(40, insets.bottom + 24) }}>
          {items.map((n) => {
            const meta = TYPE_META[n.type] || FALLBACK
            const Icon = meta.Icon
            const tappable = !!n.plan_id
            return (
              <Pressable
                key={n.id}
                onPress={() => { if (n.plan_id) router.push(`/plan/${n.plan_id}` as any) }}
                disabled={!tappable}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 12,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  backgroundColor: n.read ? 'transparent' : 'rgba(251,146,60,0.05)',
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(0,0,0,0.04)',
                }}
              >
                {/* Type icon chip */}
                <View style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, backgroundColor: meta.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={18} weight="bold" color={meta.color} />
                </View>

                {/* Body */}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                    <Text style={{ flex: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, fontWeight: '700', color: '#111111' }} numberOfLines={1}>
                      {n.title || 'Notification'}
                    </Text>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: '#BBBBBB', flexShrink: 0 }}>
                      {timeAgo(n.created_at)}
                    </Text>
                  </View>
                  {n.body ? (
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#888888', lineHeight: 18 }}>{n.body}</Text>
                  ) : null}
                  {n.plan?.name ? (
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: '#BBBBBB', marginTop: 3 }}>{n.plan.name}</Text>
                  ) : null}
                </View>

                {/* Unread dot */}
                {!n.read && (
                  <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#FB923C', flexShrink: 0, marginTop: 6 }} />
                )}
              </Pressable>
            )
          })}
        </ScrollView>
      )}
    </View>
  )
}
