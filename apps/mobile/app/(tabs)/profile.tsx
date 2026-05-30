import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PencilSimple } from 'phosphor-react-native'

import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { TopBar } from '../../components/TopBar'
import { Pill } from '../../components/Pill'
import { StatCell } from '../../components/StatCell'
import { Loader } from '../../components/Loader'
import { EmojiPicker } from '../../components/EmojiPicker'

type Scores = {
  score?: number
  plans_organised?: number
  attendance_rate?: number
  grace_passes_remaining?: number
} | null

type HistoryRow = {
  came: boolean
  plans?: { name?: string; date?: string; tier?: 1 | 2 | 3 } | null
}

const TIER_VARIANT: Record<1 | 2 | 3, 'gold' | 'orange' | 'neutral'> = {
  1: 'gold',
  2: 'orange',
  3: 'neutral',
}

export default function Profile() {
  const insets = useSafeAreaInsets()
  const { profile, updateProfile } = useAuth()

  const [scores, setScores] = useState<Scores>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [savingEmoji, setSavingEmoji] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: mem } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)
      .single()
    if (!mem) {
      setLoading(false)
      return
    }

    const { data: sc } = await supabase
      .from('member_scores')
      .select('*')
      .eq('user_id', user.id)
      .eq('group_id', mem.group_id)
      .single()
    if (sc) setScores(sc as any)

    const { data: att } = await supabase
      .from('attendances')
      .select('came, plans(name, date, tier)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
    if (att) setHistory(att as any)

    setLoading(false)
  }

  async function pickProfileEmoji(nextEmoji: string) {
    if (savingEmoji) return
    if (nextEmoji === profile?.emoji) {
      setEmojiPickerOpen(false)
      return
    }
    setSavingEmoji(true)
    const { error } = await updateProfile({ emoji: nextEmoji })
    setSavingEmoji(false)
    if (error) {
      console.error('Profile: failed to update emoji', error)
      return
    }
    setEmojiPickerOpen(false)
  }

  const TAGS: { label: string; variant: 'violet' | 'pink' | 'gold' }[] = []
  if ((scores?.plans_organised ?? 0) >= 3) TAGS.push({ label: 'Master planner', variant: 'violet' })
  if ((scores?.attendance_rate ?? 0) >= 85) TAGS.push({ label: 'Always shows up', variant: 'pink' })
  if ((scores?.plans_organised ?? 0) >= 1) TAGS.push({ label: 'Taste curator', variant: 'gold' })

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFBF5' }}>
      <TopBar />

      <ScrollView
        contentContainerStyle={{
          // NativeTabs handles bottom insets automatically for the first
          // ScrollView in each tab screen.
          paddingBottom: 24,
        }}
      >
        {/* Hero */}
        <View style={{ alignItems: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 }}>
          <Pressable
            onPress={() => setEmojiPickerOpen(true)}
            // Static style — function form loses props on iOS RN here.
            style={{
              position: 'relative',
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 72, lineHeight: 78 }}>{profile?.emoji || '😎'}</Text>
            {/* Pencil affordance dot — bottom-right of the emoji */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: '#111111',
                borderWidth: 3,
                borderColor: '#FFFBF5',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.12,
                shadowRadius: 6,
                elevation: 3,
              }}
            >
              <PencilSimple size={12} weight="bold" color="#FFFFFF" />
            </View>
          </Pressable>

          <Text
            style={{
              fontFamily: 'PlusJakartaSans_800ExtraBold',
              fontSize: 28,
              fontWeight: '800',
              color: '#111111',
              marginBottom: 4,
            }}
          >
            {profile?.display_name || 'You'}
          </Text>
          <Text
            style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 12,
              color: '#AAAAAA',
              marginBottom: 12,
            }}
          >
            Dubai · Goodfriends member
          </Text>

          {TAGS.length > 0 && (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {TAGS.map((t) => (
                <Pill key={t.label} variant={t.variant}>
                  {t.label}
                </Pill>
              ))}
            </View>
          )}
        </View>

        {/* Stats */}
        {scores && (
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              paddingHorizontal: 20,
              marginBottom: 16,
            }}
          >
            <StatCell
              value={scores.attendance_rate ? `${scores.attendance_rate}%` : '—'}
              label="attendance"
              color="#FB923C"
            />
            <StatCell value={scores.plans_organised || 0} label="organised" color="#818CF8" />
            <StatCell value={scores.score || 0} label="points" color="#BA7517" />
          </View>
        )}

        <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginHorizontal: 20, marginBottom: 16 }} />

        {/* Grace passes */}
        <View
          style={{
            marginHorizontal: 20,
            marginBottom: 16,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.06)',
            borderRadius: 18,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <Text
            style={{
              fontFamily: 'PlusJakartaSans_800ExtraBold',
              fontSize: 32,
              fontWeight: '800',
              color: '#FB923C',
              lineHeight: 32,
            }}
          >
            {scores?.grace_passes_remaining ?? 2}
          </Text>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: 'PlusJakartaSans_800ExtraBold',
                fontSize: 14,
                fontWeight: '800',
                color: '#111111',
              }}
            >
              Grace passes left
            </Text>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#AAAAAA', marginTop: 4 }}>
              Invisible cancellations · resets each year
            </Text>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginHorizontal: 20, marginBottom: 16 }} />

        {/* History */}
        <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
          <Text
            style={{
              fontFamily: 'Inter_700Bold',
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: '#BBBBBB',
            }}
          >
            Plan history
          </Text>
        </View>

        {loading ? (
          <Loader size="sm" />
        ) : history.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Text style={{ fontSize: 28, marginBottom: 6 }}>🎯</Text>
            <Text
              style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 13,
                color: '#AAAAAA',
              }}
            >
              No plans yet — go make some memories
            </Text>
          </View>
        ) : (
          history.map((h, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(0,0,0,0.04)',
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: h.came ? '#34D399' : '#E5E7EB',
                }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 13,
                    color: '#111111',
                  }}
                >
                  {h.plans?.name}
                </Text>
                <Text
                  style={{
                    fontFamily: 'Inter_500Medium',
                    fontSize: 11,
                    color: '#AAAAAA',
                    marginTop: 2,
                  }}
                >
                  {h.plans?.date &&
                    new Date(h.plans.date).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
              {h.plans?.tier && <Pill variant={TIER_VARIANT[h.plans.tier]}>Tier {h.plans.tier}</Pill>}
              <Pill variant={h.came ? 'mint' : 'neutral'}>{h.came ? 'Went' : 'Missed'}</Pill>
            </View>
          ))
        )}

        {/* Sign out */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 24 }}>
          <Pressable
            onPress={async () => {
              await supabase.auth.signOut()
            }}
            style={{
              paddingVertical: 14,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: 'rgba(0,0,0,0.1)',
              backgroundColor: 'transparent',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 13,
                fontWeight: '600',
                color: '#AAAAAA',
              }}
            >
              Sign out
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <EmojiPicker
        visible={emojiPickerOpen}
        currentEmoji={profile?.emoji}
        saving={savingEmoji}
        onPick={pickProfileEmoji}
        onClose={() => setEmojiPickerOpen(false)}
      />
    </View>
  )
}
