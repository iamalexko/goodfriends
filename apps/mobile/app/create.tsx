import { useEffect, useState } from 'react'
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { PaperPlaneTilt, Check } from 'phosphor-react-native'
import * as Haptics from 'expo-haptics'
import DateTimePicker from '@react-native-community/datetimepicker'

import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { BackButton } from '../components/BackButton'
import { EmojiAvatar } from '../components/EmojiAvatar'

// Tier definitions mirror apps/web/src/screens/CreatePlan.jsx — emoji, label,
// the one-line vibe description, and the points multiplier copy.
const TIERS = [
  { id: 1, emoji: '🎉', label: 'Big deal',     desc: 'Special occasion · advance booking · dress up', pts: '3× points · planner bonus', bg: '#F5F5F5', ptsColor: '#111111' },
  { id: 2, emoji: '🌅', label: 'Weekend plan', desc: 'Intentional outing · some coordination needed',  pts: '2× points',                ptsColor: '#92400E', bg: '#FFFBEB' },
  { id: 3, emoji: '☕', label: 'Low-key',      desc: 'Casual · spontaneous · low commitment',          pts: '1× base points',           ptsColor: '#AAAAAA', bg: '#F5F0E8' },
] as const

type Member = { id: string; display_name: string; emoji: string | null }

const LABEL = {
  fontFamily: 'Inter_700Bold' as const,
  fontSize: 10,
  fontWeight: '700' as const,
  letterSpacing: 0.8,
  textTransform: 'uppercase' as const,
  color: '#AAAAAA',
  marginBottom: 6,
}

const INPUT = {
  paddingHorizontal: 16,
  paddingVertical: 14,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: 'rgba(0,0,0,0.1)',
  backgroundColor: 'rgba(255,255,255,0.8)',
  fontSize: 14,
  fontFamily: 'Inter_500Medium' as const,
  color: '#111111',
  marginBottom: 14,
}

// Local YYYY-MM-DD (not toISOString, which shifts by timezone and can land on
// the wrong day for evening Dubai times).
function ymd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function prettyDate(d: Date | null) {
  if (!d) return 'Pick a date'
  return d.toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short' })
}

function prettyTime(d: Date | null) {
  if (!d) return 'Add a time (optional)'
  return d.toLocaleTimeString('en-AE', { hour: 'numeric', minute: '2-digit' })
}

export default function Create() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user, profile } = useAuth()

  const [step, setStep] = useState<1 | 2>(1)
  const [tier, setTier] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [dateObj, setDateObj] = useState<Date | null>(null)
  const [timeObj, setTimeObj] = useState<Date | null>(null)
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [showDate, setShowDate] = useState(false)
  const [showTime, setShowTime] = useState(false)

  const [members, setMembers] = useState<Member[]>([])
  const [invited, setInvited] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadMembers()
  }, [user])

  async function getGroupId(userId: string) {
    const { data } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId)
      .single()
    return data?.group_id as string | undefined
  }

  async function loadMembers() {
    if (!user) return
    const groupId = await getGroupId(user.id)
    if (!groupId) return
    const { data } = await supabase
      .from('group_members')
      .select('user_id, profiles(id, display_name, emoji)')
      .eq('group_id', groupId)
    if (data) {
      const others = data
        .filter((m: any) => m.user_id !== user.id)
        .map((m: any) => m.profiles)
        .filter(Boolean) as Member[]
      setMembers(others)
      const all: Record<string, boolean> = {}
      others.forEach((m) => { all[m.id] = true })
      setInvited(all)
    }
  }

  function dismiss() {
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)/home' as any)
  }

  async function createPlan() {
    if (!name || !dateObj) { setError('Add a name and date'); return }
    const today = ymd(new Date())
    const dateStr = ymd(dateObj)
    if (dateStr < today) { setError('Pick today or a future date'); return }
    setError('')
    setLoading(true)

    if (!user) { setError('Not signed in'); setLoading(false); return }
    const groupId = await getGroupId(user.id)
    if (!groupId) { setError("Couldn't find your group"); setLoading(false); return }

    const { data: plan, error: planErr } = await supabase
      .from('plans')
      .insert({
        group_id: groupId,
        organiser_id: user.id,
        name,
        date: dateStr,
        time: timeObj ? `${String(timeObj.getHours()).padStart(2, '0')}:${String(timeObj.getMinutes()).padStart(2, '0')}` : null,
        location: location || null,
        notes: notes || null,
        tier,
        status: 'open',
      })
      .select()
      .single()

    if (planErr || !plan) {
      setError(planErr?.message || 'Could not create plan')
      setLoading(false)
      return
    }

    const invitedIds = Object.entries(invited)
      .filter(([id, on]) => on && id !== user.id)
      .map(([id]) => id)

    const rsvpRows = invitedIds.map((userId) => ({ plan_id: plan.id, user_id: userId, status: null }))
    rsvpRows.push({ plan_id: plan.id, user_id: user.id, status: 'in' as any })

    const { error: rsvpErr } = await supabase.from('rsvps').insert(rsvpRows)
    if (rsvpErr) {
      console.error('CreatePlan: failed to insert RSVPs', rsvpErr)
      setError(`Plan created but couldn't invite everyone: ${rsvpErr.message}`)
      setLoading(false)
      return
    }

    // Fan out invite notifications (best-effort; don't block on failures).
    for (const userId of invitedIds) {
      try {
        await supabase.rpc('create_notification', {
          p_user_id: userId,
          p_type: 'event_invite',
          p_title: "You're invited 🎉",
          p_body: `${profile?.display_name || 'Someone'} invited you to ${name}`,
          p_plan_id: plan.id,
          p_actor_id: user.id,
        })
      } catch (err) {
        if (__DEV__) console.warn('CreatePlan: notification failed', err)
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    setLoading(false)
    dismiss()
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFBF5', paddingTop: insets.top }}>
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <BackButton onPress={() => (step > 1 ? setStep(1) : dismiss())} />
        <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 26, fontWeight: '800', color: '#111111', letterSpacing: -0.6 }}>
          New plan.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(40, insets.bottom + 24) }}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 ? (
          <>
            <Text style={[LABEL, { marginBottom: 10 }]}>Pick the vibe</Text>
            {TIERS.map((t) => {
              const active = tier === t.id
              return (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
                    setTier(t.id)
                    setStep(2)
                  }}
                  style={{
                    backgroundColor: t.bg,
                    borderRadius: 20,
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 16,
                    marginBottom: 12,
                    borderWidth: 2,
                    borderColor: active ? '#111111' : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 32 }}>{t.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, fontWeight: '800', color: '#111111' }}>{t.label}</Text>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#666666', marginTop: 2 }}>{t.desc}</Text>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, fontWeight: '700', color: t.ptsColor, marginTop: 4 }}>{t.pts}</Text>
                  </View>
                </Pressable>
              )
            })}
          </>
        ) : (
          <>
            <Text style={LABEL}>Plan name</Text>
            <TextInput
              style={INPUT}
              placeholder="e.g. Rooftop dinner at Ce La Vi"
              placeholderTextColor="#BBBBBB"
              value={name}
              onChangeText={setName}
              maxLength={50}
            />

            <Text style={LABEL}>Date</Text>
            <Pressable onPress={() => { setShowTime(false); setShowDate((s) => !s) }} style={INPUT as any}>
              <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: dateObj ? '#111111' : '#BBBBBB' }}>
                {prettyDate(dateObj)}
              </Text>
            </Pressable>
            {showDate && (
              <DateTimePicker
                value={dateObj || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={new Date()}
                onChange={(e, d) => {
                  if (Platform.OS !== 'ios') setShowDate(false)
                  if (e.type === 'set' && d) setDateObj(d)
                }}
              />
            )}

            <Text style={LABEL}>Time</Text>
            <Pressable onPress={() => { setShowDate(false); setShowTime((s) => !s) }} style={INPUT as any}>
              <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: timeObj ? '#111111' : '#BBBBBB' }}>
                {prettyTime(timeObj)}
              </Text>
            </Pressable>
            {showTime && (
              <DateTimePicker
                value={timeObj || new Date()}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(e, d) => {
                  if (Platform.OS !== 'ios') setShowTime(false)
                  if (e.type === 'set' && d) setTimeObj(d)
                }}
              />
            )}

            <Text style={LABEL}>Location</Text>
            <TextInput
              style={INPUT}
              placeholder="Venue or area"
              placeholderTextColor="#BBBBBB"
              value={location}
              onChangeText={setLocation}
            />

            {tier === 1 && (
              <>
                <Text style={LABEL}>Notes / booking ref</Text>
                <TextInput
                  style={INPUT}
                  placeholder="Optional"
                  placeholderTextColor="#BBBBBB"
                  value={notes}
                  onChangeText={setNotes}
                />
              </>
            )}

            <Text style={[LABEL, { marginTop: 4 }]}>Invite your crew</Text>
            {members.length === 0 ? (
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#AAAAAA', paddingVertical: 8 }}>
                No one else in your crew yet.
              </Text>
            ) : (
              members.map((m) => {
                const on = !!invited[m.id]
                return (
                  <View
                    key={m.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: 'rgba(0,0,0,0.05)',
                    }}
                  >
                    <EmojiAvatar emoji={m.emoji || '😎'} size="sm" />
                    <Text style={{ flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#111111' }}>{m.display_name}</Text>
                    <Pressable
                      onPress={() => setInvited((p) => ({ ...p, [m.id]: !p[m.id] }))}
                      hitSlop={8}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        borderWidth: 2,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: on ? '#34D399' : 'transparent',
                        borderColor: on ? '#34D399' : '#DDDDDD',
                      }}
                    >
                      {on && <Check size={14} weight="bold" color="#FFFFFF" />}
                    </Pressable>
                  </View>
                )
              })
            )}

            {error ? (
              <Text style={{ color: '#EF4444', fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 12 }}>{error}</Text>
            ) : null}

            <Pressable
              onPress={createPlan}
              disabled={loading}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: '#111111',
                borderRadius: 999,
                paddingVertical: 16,
                marginTop: 20,
                opacity: loading ? 0.5 : 1,
              }}
            >
              <PaperPlaneTilt size={18} weight="fill" color="#FFFFFF" />
              <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>
                {loading ? 'Creating…' : 'Send invites'}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  )
}
