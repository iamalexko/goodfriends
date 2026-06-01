import { useEffect, useState } from 'react'
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { CalendarBlank, Clock, MapPin, PencilSimple, Check } from 'phosphor-react-native'
import * as Haptics from 'expo-haptics'
import DateTimePicker from '@react-native-community/datetimepicker'

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
type InviteRequest = {
  id: string
  requester_id: string
  status: 'pending' | 'approved' | 'rejected'
  requester?: { id: string; display_name: string; emoji: string | null } | null
}
type PlanRow = {
  id: string
  group_id: string
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

  // Organiser: edit modal
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDate, setEditDate] = useState<Date | null>(null)
  const [editTime, setEditTime] = useState<Date | null>(null)
  const [editLocation, setEditLocation] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [showEditDate, setShowEditDate] = useState(false)
  const [showEditTime, setShowEditTime] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')

  // Organiser: close + attendance
  const [closeOpen, setCloseOpen] = useState(false)
  const [attendance, setAttendance] = useState<Record<string, boolean>>({})
  const [closing, setClosing] = useState(false)

  // Organiser: delete
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Nudges (organiser pokes undecided members)
  const [nudges, setNudges] = useState<{ nudgee_id: string; created_at: string }[]>([])
  const [nudging, setNudging] = useState<string | null>(null)

  // Invite requests
  const [inviteRequests, setInviteRequests] = useState<InviteRequest[]>([])
  const [myInviteRequest, setMyInviteRequest] = useState<InviteRequest | null>(null)
  const [requestBusy, setRequestBusy] = useState(false)

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

    const organiserId = (planData as PlanRow).organiser_id
    const amOrganiser = !!user && organiserId === user.id

    // Nudges I've sent on this plan (organiser only) — drives 24h cooldown UI.
    if (amOrganiser && user) {
      const { data: nudgeData } = await supabase
        .from('nudges')
        .select('nudgee_id, created_at')
        .eq('plan_id', id)
        .eq('nudger_id', user.id)
      setNudges((nudgeData || []) as any)
    }

    // Invite requests: organiser sees all; a non-invited member sees only theirs.
    if (user) {
      let q = supabase
        .from('event_invite_requests')
        .select('*, requester:requester_id(id, display_name, emoji)')
        .eq('plan_id', id)
      if (!amOrganiser) q = q.eq('requester_id', user.id)
      const { data: reqData } = await q.order('created_at', { ascending: true })
      setInviteRequests((reqData || []) as InviteRequest[])
      setMyInviteRequest(((reqData || []) as InviteRequest[]).find((r) => r.requester_id === user.id) || null)
    }

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
        return [...prev, { user_id: user.id, status, profiles: profile ? { id: user.id, display_name: profile.display_name || 'You', emoji: profile.emoji ?? null } : null }]
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

  // ---- Organiser: edit ----
  function openEdit() {
    if (!plan) return
    setEditName(plan.name)
    // plan.date is YYYY-MM-DD; parse as local noon to avoid TZ day-shift.
    setEditDate(plan.date ? new Date(`${plan.date}T12:00:00`) : null)
    // plan.time is HH:MM (24h); build a Date for the picker.
    if (plan.time) {
      const [h, m] = plan.time.split(':').map((n) => parseInt(n, 10))
      const d = new Date()
      d.setHours(h || 0, m || 0, 0, 0)
      setEditTime(d)
    } else {
      setEditTime(null)
    }
    setEditLocation(plan.location || '')
    setEditNotes(plan.notes || '')
    setEditError('')
    setShowEditDate(false)
    setShowEditTime(false)
    setEditOpen(true)
  }

  async function saveEdits() {
    if (!plan) return
    if (!editName.trim() || !editDate) { setEditError('Add a name and date'); return }
    setSavingEdit(true)
    setEditError('')
    const y = editDate.getFullYear()
    const mo = String(editDate.getMonth() + 1).padStart(2, '0')
    const da = String(editDate.getDate()).padStart(2, '0')
    const dateStr = `${y}-${mo}-${da}`
    const timeStr = editTime
      ? `${String(editTime.getHours()).padStart(2, '0')}:${String(editTime.getMinutes()).padStart(2, '0')}`
      : null
    const { error } = await supabase
      .from('plans')
      .update({
        name: editName.trim(),
        date: dateStr,
        time: timeStr,
        location: editLocation.trim() || null,
        notes: editNotes.trim() || null,
      })
      .eq('id', plan.id)
    setSavingEdit(false)
    if (error) { setEditError(error.message); return }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    setEditOpen(false)
    load()
  }

  // ---- Organiser: close + attendance ----
  function openClose() {
    // Default everyone who said "in" to present; everyone else unchecked.
    const init: Record<string, boolean> = {}
    rsvps.forEach((r) => { init[r.user_id] = r.status === 'in' })
    setAttendance(init)
    setCloseOpen(true)
  }

  async function closeEvent() {
    if (!plan || closing) return
    setClosing(true)
    const rows = Object.entries(attendance).map(([userId, came]) => ({
      plan_id: plan.id, user_id: userId, came,
    }))
    if (rows.length) {
      await supabase.from('attendances').upsert(rows, { onConflict: 'plan_id,user_id' })
    }
    await supabase.from('plans').update({ status: 'closed' }).eq('id', plan.id)
    // Server-side RPCs own the points/score maths so web + mobile stay in sync.
    try { await supabase.rpc('award_points_for_plan', { p_plan_id: plan.id }) } catch (e) { if (__DEV__) console.warn('award_points_for_plan', e) }
    try { await supabase.rpc('recalculate_group_scores', { p_group_id: plan.group_id }) } catch (e) { if (__DEV__) console.warn('recalculate_group_scores', e) }
    setClosing(false)
    setCloseOpen(false)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    load()
  }

  // ---- Organiser: delete ----
  async function deletePlan() {
    if (!plan || deleting) return
    setDeleting(true)
    // Notify invitees only when cancelling an OPEN plan (deleting a closed
    // plan is record-cleanup). plan_id null — the row is about to be deleted.
    if (plan.status === 'open') {
      for (const r of rsvps) {
        if (r.user_id === user?.id) continue
        try {
          await supabase.rpc('create_notification', {
            p_user_id: r.user_id,
            p_type: 'event_cancelled',
            p_title: 'Plan cancelled ❌',
            p_body: `${profile?.display_name || 'The organiser'} cancelled ${plan.name}`,
            p_plan_id: null,
            p_actor_id: user?.id,
          })
        } catch (e) { if (__DEV__) console.warn('cancel notify', e) }
      }
    }
    // Child rows first (explicit, so RLS errors surface), then the plan.
    await supabase.from('rsvps').delete().eq('plan_id', plan.id)
    await supabase.from('attendances').delete().eq('plan_id', plan.id)
    await supabase.from('event_invite_requests').delete().eq('plan_id', plan.id)
    const { error } = await supabase.from('plans').delete().eq('id', plan.id)
    setDeleting(false)
    if (error) { if (__DEV__) console.warn('deletePlan', error); return }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    setDeleteOpen(false)
    router.replace('/(tabs)/plans' as any)
  }

  // ---- Nudges ----
  function canNudge(userId: string) {
    const existing = nudges.find((n) => n.nudgee_id === userId)
    if (!existing) return true
    return (Date.now() - new Date(existing.created_at).getTime()) / 3600000 >= 24
  }

  async function nudgeMember(targetUserId: string) {
    if (!user || !plan || nudging) return
    setNudging(targetUserId)
    // Delete + reinsert so unique(plan_id,nudger_id,nudgee_id) doesn't block a
    // re-nudge after the 24h cooldown.
    await supabase.from('nudges').delete()
      .eq('plan_id', plan.id).eq('nudger_id', user.id).eq('nudgee_id', targetUserId)
    const { error } = await supabase.from('nudges').insert({
      plan_id: plan.id, nudger_id: user.id, nudgee_id: targetUserId,
    })
    if (error) { if (__DEV__) console.warn('nudge insert', error); setNudging(null); return }
    try {
      await supabase.rpc('create_notification', {
        p_user_id: targetUserId,
        p_type: 'event_invite',
        p_title: `${profile?.display_name || 'Someone'} poked you 👈`,
        p_body: `Are you in for ${plan.name} or not? 👀`,
        p_plan_id: plan.id,
        p_actor_id: user.id,
      })
    } catch (e) { if (__DEV__) console.warn('nudge notify', e) }
    setNudges((prev) => [
      ...prev.filter((n) => n.nudgee_id !== targetUserId),
      { nudgee_id: targetUserId, created_at: new Date().toISOString() },
    ])
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    setNudging(null)
  }

  // ---- Invite requests ----
  async function requestInvite() {
    if (!user || !plan || requestBusy || myInviteRequest?.status === 'pending') return
    setRequestBusy(true)
    const { data, error } = await supabase
      .from('event_invite_requests')
      .upsert(
        { plan_id: plan.id, requester_id: user.id, status: 'pending', decided_by: null, decided_at: null },
        { onConflict: 'plan_id,requester_id' },
      )
      .select('*, requester:requester_id(id, display_name, emoji)')
      .single()
    if (error || !data) { setRequestBusy(false); if (__DEV__) console.warn('requestInvite', error); return }
    setMyInviteRequest(data as InviteRequest)
    setInviteRequests((prev) => [data as InviteRequest, ...prev.filter((r) => r.id !== (data as any).id)])
    try {
      await supabase.rpc('create_notification', {
        p_user_id: plan.organiser_id,
        p_type: 'event_invite_request',
        p_title: 'Invite request',
        p_body: `${profile?.display_name || 'Someone'} asked to join ${plan.name}`,
        p_plan_id: plan.id,
        p_actor_id: user.id,
      })
    } catch (e) { if (__DEV__) console.warn('request notify', e) }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    setRequestBusy(false)
  }

  async function decideInviteRequest(request: InviteRequest, status: 'approved' | 'rejected') {
    if (!user || !plan || requestBusy) return
    setRequestBusy(true)
    if (status === 'approved') {
      const { error } = await supabase.from('rsvps').upsert(
        { plan_id: plan.id, user_id: request.requester_id, status: null },
        { onConflict: 'plan_id,user_id', ignoreDuplicates: true },
      )
      if (error) { setRequestBusy(false); if (__DEV__) console.warn('approve rsvp', error); return }
    }
    const { error } = await supabase
      .from('event_invite_requests')
      .update({ status, decided_by: user.id, decided_at: new Date().toISOString() })
      .eq('id', request.id)
    if (error) { setRequestBusy(false); if (__DEV__) console.warn('decide update', error); return }
    try {
      await supabase.rpc('create_notification', {
        p_user_id: request.requester_id,
        p_type: status === 'approved' ? 'event_request_approved' : 'event_request_rejected',
        p_title: status === 'approved' ? 'You were invited' : 'Request declined',
        p_body: status === 'approved'
          ? `${profile?.display_name || 'The planner'} added you to ${plan.name}`
          : `${profile?.display_name || 'The planner'} declined your request for ${plan.name}`,
        p_plan_id: status === 'approved' ? plan.id : null,
        p_actor_id: user.id,
      })
    } catch (e) { if (__DEV__) console.warn('decide notify', e) }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    setRequestBusy(false)
    load()
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
  const isOrganiser = !!user && plan.organiser_id === user.id
  // A signed-in non-organiser who isn't in the RSVP list can request an invite.
  const isInvited = !!user && rsvps.some((r) => r.user_id === user.id)
  const canRequestInvite = !!user && !isOrganiser && !isInvited && !isClosed
  const pendingRequests = inviteRequests.filter((r) => r.status === 'pending')
  // Attendees sorted: "in" first, then likely, then no, then undecided.
  const order: Record<string, number> = { in: 0, likely: 1, no: 2 }
  const sortedRsvps = [...rsvps].sort(
    (a, b) => (order[a.status ?? ''] ?? 3) - (order[b.status ?? ''] ?? 3),
  )

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFBF5', paddingTop: insets.top }}>
      <Header onBack={goBack} onEdit={isOrganiser && !isClosed ? openEdit : undefined} />

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
                ) : isOrganiser && !isClosed && r.user_id !== user?.id ? (
                  <Pressable
                    onPress={() => canNudge(r.user_id) && nudgeMember(r.user_id)}
                    disabled={!canNudge(r.user_id) || nudging === r.user_id}
                    hitSlop={6}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 999,
                      backgroundColor: canNudge(r.user_id) ? '#FEF3C7' : '#F3F4F6',
                    }}
                  >
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, fontWeight: '700', color: canNudge(r.user_id) ? '#92400E' : '#BBBBBB' }}>
                      {nudging === r.user_id ? 'Poking…' : canNudge(r.user_id) ? '👈 Nudge' : 'Nudged'}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#CCCCCC' }}>no reply</Text>
                )}
              </View>
            ))
          )}
        </View>

        {/* Invite requests — organiser approves/rejects pending ones */}
        {isOrganiser && pendingRequests.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <Text style={SECTION_LABEL}>Requests to join · {pendingRequests.length}</Text>
            {pendingRequests.map((req) => (
              <View
                key={req.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }}
              >
                <EmojiAvatar emoji={req.requester?.emoji || '😎'} size="sm" />
                <Text style={{ flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#111111' }}>
                  {req.requester?.display_name || 'Someone'}
                </Text>
                <Pressable
                  onPress={() => decideInviteRequest(req, 'rejected')}
                  disabled={requestBusy}
                  hitSlop={4}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F3F4F6', marginRight: 6 }}
                >
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, fontWeight: '700', color: '#6B7280' }}>Decline</Text>
                </Pressable>
                <Pressable
                  onPress={() => decideInviteRequest(req, 'approved')}
                  disabled={requestBusy}
                  hitSlop={4}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#111111' }}
                >
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>Approve</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Non-invited member: request to join */}
        {canRequestInvite && (
          <View style={{ marginTop: 28 }}>
            {myInviteRequest?.status === 'pending' ? (
              <View style={{ backgroundColor: '#FEF3C7', borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, fontWeight: '700', color: '#92400E' }}>Request sent — waiting on the host</Text>
              </View>
            ) : myInviteRequest?.status === 'rejected' ? (
              <View style={{ backgroundColor: '#FEF2F2', borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, fontWeight: '700', color: '#B91C1C' }}>Your request was declined</Text>
              </View>
            ) : (
              <Pressable
                onPress={requestInvite}
                disabled={requestBusy}
                style={{ backgroundColor: '#111111', borderRadius: 999, paddingVertical: 16, alignItems: 'center', opacity: requestBusy ? 0.5 : 1 }}
              >
                <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>
                  {requestBusy ? 'Sending…' : 'Ask to join'}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Organiser: close the plan (open plans only) */}
        {isOrganiser && !isClosed && (
          <Pressable
            onPress={openClose}
            style={{
              marginTop: 28,
              backgroundColor: '#111111',
              borderRadius: 999,
              paddingVertical: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>
              Close plan & mark attendance
            </Text>
          </Pressable>
        )}

        {/* Organiser: delete / cancel */}
        {isOrganiser && (
          <Pressable onPress={() => setDeleteOpen(true)} style={{ marginTop: 12, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, fontWeight: '700', color: '#B91C1C' }}>
              {isClosed ? 'Delete plan' : 'Cancel plan'}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {/* ---- Edit modal ---- */}
      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => !savingEdit && setEditOpen(false)}>
        <Pressable onPress={() => !savingEdit && setEditOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: '#FFFBF5', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: Math.max(24, insets.bottom + 12), maxHeight: '90%' }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.1)', alignSelf: 'center', marginBottom: 16 }} />
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, fontWeight: '800', color: '#111111', marginBottom: 14 }}>Edit plan</Text>

              <Text style={FIELD_LABEL}>Plan name</Text>
              <TextInput style={FIELD_INPUT} value={editName} onChangeText={setEditName} placeholder="Plan name" placeholderTextColor="#BBBBBB" maxLength={50} />

              <Text style={FIELD_LABEL}>Date</Text>
              <Pressable onPress={() => { setShowEditTime(false); setShowEditDate((s) => !s) }} style={FIELD_INPUT as any}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: editDate ? '#111111' : '#BBBBBB' }}>
                  {editDate ? editDate.toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Pick a date'}
                </Text>
              </Pressable>
              {showEditDate && (
                <DateTimePicker
                  value={editDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(e, d) => { if (Platform.OS !== 'ios') setShowEditDate(false); if (e.type === 'set' && d) setEditDate(d) }}
                />
              )}

              <Text style={FIELD_LABEL}>Time</Text>
              <Pressable onPress={() => { setShowEditDate(false); setShowEditTime((s) => !s) }} style={FIELD_INPUT as any}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: editTime ? '#111111' : '#BBBBBB' }}>
                  {editTime ? editTime.toLocaleTimeString('en-AE', { hour: 'numeric', minute: '2-digit' }) : 'Add a time (optional)'}
                </Text>
              </Pressable>
              {showEditTime && (
                <DateTimePicker
                  value={editTime || new Date()}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, d) => { if (Platform.OS !== 'ios') setShowEditTime(false); if (e.type === 'set' && d) setEditTime(d) }}
                />
              )}

              <Text style={FIELD_LABEL}>Location</Text>
              <TextInput style={FIELD_INPUT} value={editLocation} onChangeText={setEditLocation} placeholder="Venue or area" placeholderTextColor="#BBBBBB" />

              <Text style={FIELD_LABEL}>Notes</Text>
              <TextInput style={FIELD_INPUT} value={editNotes} onChangeText={setEditNotes} placeholder="Optional" placeholderTextColor="#BBBBBB" />

              {editError ? <Text style={{ color: '#EF4444', fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 4 }}>{editError}</Text> : null}

              <Pressable onPress={saveEdits} disabled={savingEdit} style={{ marginTop: 16, backgroundColor: '#111111', borderRadius: 999, paddingVertical: 15, alignItems: 'center', opacity: savingEdit ? 0.5 : 1 }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>{savingEdit ? 'Saving…' : 'Save changes'}</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ---- Close + attendance modal ---- */}
      <Modal visible={closeOpen} transparent animationType="slide" onRequestClose={() => !closing && setCloseOpen(false)}>
        <Pressable onPress={() => !closing && setCloseOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: '#FFFBF5', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: Math.max(24, insets.bottom + 12), maxHeight: '90%' }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.1)', alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, fontWeight: '800', color: '#111111', marginBottom: 4 }}>Who showed up?</Text>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#AAAAAA', marginBottom: 14 }}>Tick everyone who came. Closing awards points and updates scores.</Text>
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {sortedRsvps.map((r) => {
                const came = !!attendance[r.user_id]
                return (
                  <Pressable
                    key={r.user_id}
                    onPress={() => setAttendance((p) => ({ ...p, [r.user_id]: !p[r.user_id] }))}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }}
                  >
                    <EmojiAvatar emoji={r.profiles?.emoji || '😎'} size="sm" />
                    <Text style={{ flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#111111' }}>{r.profiles?.display_name || 'Someone'}</Text>
                    <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: came ? '#34D399' : 'transparent', borderColor: came ? '#34D399' : '#DDDDDD' }}>
                      {came && <Check size={14} weight="bold" color="#FFFFFF" />}
                    </View>
                  </Pressable>
                )
              })}
            </ScrollView>
            <Pressable onPress={closeEvent} disabled={closing} style={{ marginTop: 16, backgroundColor: '#111111', borderRadius: 999, paddingVertical: 15, alignItems: 'center', opacity: closing ? 0.5 : 1 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>{closing ? 'Closing…' : 'Close plan'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ---- Delete / cancel confirm modal ---- */}
      <Modal visible={deleteOpen} transparent animationType="slide" onRequestClose={() => !deleting && setDeleteOpen(false)}>
        <Pressable onPress={() => !deleting && setDeleteOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: '#FFFBF5', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: Math.max(24, insets.bottom + 12) }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.1)', alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, fontWeight: '800', color: '#111111', marginBottom: 4 }}>
              {isClosed ? 'Delete this plan?' : 'Cancel this plan?'}
            </Text>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#AAAAAA', marginBottom: 18 }}>
              {isClosed
                ? 'This permanently removes the plan and its records. This can’t be undone.'
                : 'Everyone invited will be notified it’s cancelled. This can’t be undone.'}
            </Text>
            <Pressable onPress={deletePlan} disabled={deleting} style={{ backgroundColor: '#B91C1C', borderRadius: 999, paddingVertical: 15, alignItems: 'center', opacity: deleting ? 0.5 : 1 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>
                {deleting ? 'Deleting…' : isClosed ? 'Delete plan' : 'Cancel plan'}
              </Text>
            </Pressable>
            <Pressable onPress={() => !deleting && setDeleteOpen(false)} style={{ paddingVertical: 12, alignItems: 'center', marginTop: 4 }}>
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, fontWeight: '600', color: 'rgba(17,17,17,0.6)' }}>Keep it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

function Header({ onBack, onEdit }: { onBack: () => void; onEdit?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
      <BackButton onPress={onBack} />
      <Text style={{ flex: 1, fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, fontWeight: '800', color: '#111111', letterSpacing: -0.3 }}>
        Plan
      </Text>
      {onEdit && (
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' }}
        >
          <PencilSimple size={16} weight="bold" color="#111111" />
        </Pressable>
      )}
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

const FIELD_LABEL = {
  fontFamily: 'Inter_700Bold' as const,
  fontSize: 10,
  fontWeight: '700' as const,
  letterSpacing: 0.8,
  textTransform: 'uppercase' as const,
  color: '#AAAAAA',
  marginBottom: 6,
}

const FIELD_INPUT = {
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
