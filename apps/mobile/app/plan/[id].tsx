import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { CalendarBlank, Clock, MapPin } from 'phosphor-react-native'
import * as Haptics from 'expo-haptics'

import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { BackButton } from '../../components/BackButton'
import { EmojiAvatar } from '../../components/EmojiAvatar'
import { Pill } from '../../components/Pill'
import { Loader } from '../../components/Loader'

// RSVP options mirror the live DB CHECK constraint on rsvps.status.
const RSVP_OPTIONS = [
  { key: 'in', emoji: '✅', label: "I'm in" },
  { key: 'likely', emoji: '🤔', label: 'Likely' },
  { key: 'no', emoji: '😬', label: 'No' },
] as const

const RSVP_LABEL: Record<string, string> = { in: "I'm in", likely: 'Likely', no: 'No' }
const TIER_VARIANT: Record<number, 'tier1' | 'tier2' | 'tier3'> = { 1: 'tier1', 2: 'tier2', 3: 'tier3' }
const TIER_LABEL: Record<number, string> = { 1: 'Tier 1 · Big deal', 2: 'Tier 2 · Weekend plan', 3: 'Tier 3 · Low-key' }
const RSVP_PILL: Record<string, 'mint' | 'yellow' | 'neutral'> = { in: 'mint', likely: 'yellow', no: 'neutral' }

function formatPlanDate(dateStr?: string | null) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'short' })
}

type Profile = { id: string; display_name: string; emoji: string | null }
type Rsvp = { user_id: string; status: string | null; profiles: Profile | null }
type PlanRow = {
  id: string
  name: string
  date: string
  time: string | null
  location: string | null
  tier: number
  status: string
  organiser_id: string
  notes: string | null
  organiser?: { display_name: string; emoji: string | null } | null
}

export default function PlanDetail() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user, profile } = useAuth()

  const [plan, setPlan] = useState<PlanRow | null>(null)
  const [rsvps, setRsvps] = useState<Rsvp[]>([])
  const [myStatus, setMyStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    if (!id) return
    setLoading(true)
    const { data: planData } = await supabase
      .from('plans')
      .select('*, organiser:profiles!organiser_id(display_name, emoji)')
      .eq('id', id)
      .maybeSingle()
    if (!planData) { setLoading(false); return }
    setPlan(planData as PlanRow)

    const { data: rsvpData } = await supabase
      .from('rsvps')
      .select('*, profiles(id, display_name, emoji)')
      .eq('plan_id', id)
    setRsvps((rsvpData || []) as Rsvp[])
    const mine = (rsvpData || []).find((r: any) => r.user_id === user?.id)
    setMyStatus(mine?.status ?? null)
    setLoading(false)
  }

  async function setRsvpStatus(status: string) {
    if (!user || !plan || saving) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    setMyStatus(status) // optimistic
    setSaving(true)
    const { error } = await supabase
      .from('rsvps')
      .upsert({ plan_id: plan.id, user_id: user.id, status }, { onConflict: 'plan_id,user_id' })
    setSaving(false)
    if (error) { console.error('PlanDetail: rsvp upsert failed', error); return }

    // Reflect my change in the local attendee list without a full reload.
    setRsvps((prev) => {
      const idx = prev.findIndex((r) => r.user_id === user.id)
      if (idx === -1) {
        return [...prev, { user_id: user.id, status, profiles: profile ? { id: user.id, display_name: profile.display_name, emoji: profile.emoji } : null }]
      }
      const next = [...prev]
      next[idx] = { ...next[idx], status }
      return next
    })

    // Notify the organiser (never self).
    if (plan.organiser_id !== user.id) {
      try {
        await supabase.rpc('create_notification', {
          p_user_id: plan.organiser_id,
          p_type: 'event_rsvp',
          p_title: 'RSVP update',
          p_body: `${profile?.display_name || 'Someone'} is ${RSVP_LABEL[status]} for ${plan.name}`,
          p_plan_id: plan.id,
          p_actor_id: user.id,
        })
      } catch (err) {
        if (__DEV__) console.warn('PlanDetail: notify organiser failed', err)
      }
    }
  }

  function goBack() {
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)/home' as any)
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFBF5', paddingTop: insets.top }}>
        <Header onBack={goBack} />
        <Loader />
      </View>
    )
  }

  if (!plan) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFBF5', paddingTop: insets.top }}>
        <Header onBack={goBack} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Text style={{ fontSize: 28, marginBottom: 8 }}>🤷</Text>
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: '#AAAAAA', textAlign: 'center' }}>
            This plan no longer exists.
          </Text>
        </View>
      </View>
    )
  }

  const isClosed = plan.status !== 'open'
  // Attendees sorted: "in" first, then likely, then no, then undecided.
  const order: Record<string, number> = { in: 0, likely: 1, no: 2 }
  const sortedRsvps = [...rsvps].sort(
    (a, b) => (order[a.status ?? ''] ?? 3) - (order[b.status ?? ''] ?? 3),
  )

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFBF5', paddingTop: insets.top }}>
      <Header onBack={goBack} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(40, insets.bottom + 24) }}>
        {/* Title + tier */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
          <Text style={{ flex: 1, fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 26, fontWeight: '800', color: '#111111', letterSpacing: -0.5, lineHeight: 30 }}>
            {plan.name}
          </Text>
          <View style={{ marginTop: 4 }}>
            <Pill variant={TIER_VARIANT[plan.tier] || 'tier3'}>{TIER_LABEL[plan.tier] || `Tier ${plan.tier}`}</Pill>
          </View>
        </View>

        {isClosed && (
          <View style={{ marginTop: 8 }}>
            <Pill variant="neutral">Closed</Pill>
          </View>
        )}

        {/* Meta rows */}
        <View style={{ gap: 10, marginTop: 16 }}>
          <MetaRow icon={<CalendarBlank size={16} weight="regular" color="#888888" />} text={formatPlanDate(plan.date)} />
          {plan.time ? <MetaRow icon={<Clock size={16} weight="regular" color="#888888" />} text={plan.time} /> : null}
          {plan.location ? <MetaRow icon={<MapPin size={16} weight="regular" color="#888888" />} text={plan.location} /> : null}
        </View>

        {/* Organiser */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }}>
          <EmojiAvatar emoji={plan.organiser?.emoji || '😎'} size="sm" />
          <View>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: '#AAAAAA', letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Organised by
            </Text>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#111111', marginTop: 1 }}>
              {plan.organiser?.display_name || 'Someone'}
            </Text>
          </View>
        </View>

        {plan.notes ? (
          <View style={{ marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 14 }}>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: '#555555', lineHeight: 19 }}>{plan.notes}</Text>
          </View>
        ) : null}

        {/* RSVP selector */}
        {!isClosed && (
          <View style={{ marginTop: 24 }}>
            <Text style={SECTION_LABEL}>Your RSVP</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {RSVP_OPTIONS.map((opt) => {
                const active = myStatus === opt.key
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setRsvpStatus(opt.key)}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      paddingVertical: 14,
                      borderRadius: 16,
                      borderWidth: 2,
                      backgroundColor: active ? '#111111' : '#FFFFFF',
                      borderColor: active ? '#111111' : 'rgba(0,0,0,0.1)',
                    }}
                  >
                    <Text style={{ fontSize: 22, marginBottom: 4 }}>{opt.emoji}</Text>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, fontWeight: '700', color: active ? '#FFFFFF' : '#111111' }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        )}

        {/* Attendees */}
        <View style={{ marginTop: 28 }}>
          <Text style={SECTION_LABEL}>
            Who's coming · {rsvps.filter((r) => r.status === 'in').length} in
          </Text>
          {sortedRsvps.length === 0 ? (
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#AAAAAA', paddingVertical: 8 }}>
              No one's been invited yet.
            </Text>
          ) : (
            sortedRsvps.map((r) => (
              <View
                key={r.user_id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(0,0,0,0.05)',
                }}
              >
                <EmojiAvatar emoji={r.profiles?.emoji || '😎'} size="sm" />
                <Text style={{ flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#111111' }}>
                  {r.profiles?.display_name || 'Someone'}
                  {r.user_id === plan.organiser_id ? '  ·  host' : ''}
                </Text>
                {r.status ? (
                  <Pill variant={RSVP_PILL[r.status] || 'neutral'}>{RSVP_LABEL[r.status] || r.status}</Pill>
                ) : (
                  <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#CCCCCC' }}>no reply</Text>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
      <BackButton onPress={onBack} />
      <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, fontWeight: '800', color: '#111111', letterSpacing: -0.3 }}>
        Plan
      </Text>
    </View>
  )
}

function MetaRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {icon}
      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: '#555555' }}>{text}</Text>
    </View>
  )
}

const SECTION_LABEL = {
  fontFamily: 'Inter_700Bold' as const,
  fontSize: 10,
  fontWeight: '700' as const,
  letterSpacing: 0.8,
  textTransform: 'uppercase' as const,
  color: '#BBBBBB',
  marginBottom: 12,
}
