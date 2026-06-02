import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Image, Linking, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { CalendarBlank, Clock, MapPin, PencilSimple, Check, Camera, PaperPlaneTilt, X, DotsThree, Trash, CaretLeft, ArrowSquareOut, Smiley, CornersOut } from 'phosphor-react-native'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation, runOnJS, FadeInDown } from 'react-native-reanimated'
import DateTimePicker from '@react-native-community/datetimepicker'
import { resolveCover, COVER_PRESETS } from '@goodfriends/shared'

import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { EmojiAvatar } from '../../components/EmojiAvatar'
import { Pill } from '../../components/Pill'
import { Loader } from '../../components/Loader'
import { EmojiBurst } from '../../components/EmojiBurst'

const HERO_H = 240

// RSVP options + selected styling — mirrors apps/web/src/screens/PlanDetail.jsx
// exactly (pastel fill + coloured border + soft glow; ink label + grey sub).
const RSVP_OPTIONS = [
  { key: 'in', emoji: '✅', label: "I'm in", sub: '100% there', activeBg: '#DCFCE7', activeBorder: '#16A34A', glow: '#16A34A' },
  { key: 'likely', emoji: '🤔', label: 'Likely', sub: 'pretty sure', activeBg: '#FEF3C7', activeBorder: '#F59E0B', glow: '#F59E0B' },
  { key: 'no', emoji: '😬', label: 'No', sub: "can't make it", activeBg: '#F3F4F6', activeBorder: '#9CA3AF', glow: '#9CA3AF' },
] as const

const RSVP_LABEL: Record<string, string> = { in: "I'm in", likely: 'Likely', no: 'No' }
const TIER_VARIANT: Record<number, 'tier1' | 'tier2' | 'tier3'> = { 1: 'tier1', 2: 'tier2', 3: 'tier3' }
const TIER_LABEL: Record<number, string> = { 1: 'Tier 1 · Big deal', 2: 'Tier 2 · Weekend plan', 3: 'Tier 3 · Low-key' }
const RSVP_PILL: Record<string, 'mint' | 'yellow' | 'neutral'> = { in: 'mint', likely: 'yellow', no: 'neutral' }

// Quick-react palette — mirrors the web Moments feed.
const REACTION_OPTIONS = ['😂', '😍', '🔥', '👏', '😭', '🫶', '❓']

function formatPlanDate(dateStr?: string | null) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'short' })
}

// Compact "2h" / "3d" relative time for Moments post headers.
function formatTimeAgo(iso?: string | null) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })
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
  cover_image_url: string | null
  cover_preset: string | null
  organiser?: { display_name: string; emoji: string | null } | null
}
type PlanReaction = { user_id: string; emoji: string }
type Reaction = { id: string; emoji: string; user_id: string }
type Post = {
  id: string
  plan_id: string
  user_id: string
  type: 'photo' | 'comment'
  content: string | null
  image_url: string | null
  caption: string | null
  created_at: string
  profiles: { display_name: string | null; emoji: string | null } | null
  reactions: Reaction[] | null
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
  // Bumped to (re)fire the "I'm in" emoji-burst celebration.
  const [burstKey, setBurstKey] = useState(0)

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

  // Moments feed
  const [posts, setPosts] = useState<Post[]>([])
  const [composerText, setComposerText] = useState('')
  const [composerPhoto, setComposerPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [uploading, setUploading] = useState(false)
  const [editingPost, setEditingPost] = useState<{ id: string; content: string } | null>(null)
  const [reactionPickerId, setReactionPickerId] = useState<string | null>(null)
  const [actionSheetPost, setActionSheetPost] = useState<Post | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const composerInputRef = useRef<TextInput>(null)

  // Plan-level hype reactions + the floating page reactor (separate from post reactions)
  const [planReactions, setPlanReactions] = useState<PlanReaction[]>([])
  const [planReactorOpen, setPlanReactorOpen] = useState(false)

  // Guest roster sheet + change-cover sheet
  const [guestSheetOpen, setGuestSheetOpen] = useState(false)
  const [coverSheetOpen, setCoverSheetOpen] = useState(false)
  const [coverBusy, setCoverBusy] = useState(false)

  // Parallax — scrollY drives the hero translate/scale (UI thread)
  const scrollY = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y })
  // Parallax: on pull-down the image scales up to fill the stretch; on
  // scroll-down it LAGS DOWNWARD (positive translateY) so its bottom edge
  // never lifts out of the overflow-hidden hero and exposes the page behind.
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-HERO_H, 0, HERO_H], [HERO_H / 2, 0, HERO_H / 3], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-HERO_H, 0], [1.6, 1], Extrapolation.CLAMP) },
    ],
  }))

  useEffect(() => {
    load()
  }, [id])

  // Moments are crew-only (organiser or anyone on the RSVP list). Load once the
  // plan + rsvps are known, and keep the feed live via realtime on posts +
  // reactions. Each mutation also calls loadPosts() so the UI is correct even if
  // the realtime channel is unavailable.
  const canViewMoments =
    !!plan && !!user && (plan.organiser_id === user.id || rsvps.some((r) => r.user_id === user.id))

  useEffect(() => {
    if (!id || !canViewMoments) { setPosts([]); return }
    loadPosts()
    const channel = supabase
      .channel('posts-' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `plan_id=eq.${id}` }, loadPosts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, loadPosts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_reactions', filter: `plan_id=eq.${id}` }, loadPlanReactions)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, canViewMoments])

  async function loadPosts() {
    if (!id) return
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles(display_name, emoji), reactions(id, emoji, user_id)')
      .eq('plan_id', id)
      .order('created_at', { ascending: true })
    if (error) { if (__DEV__) console.warn('loadPosts', error); return }
    setPosts((data || []) as Post[])
  }

  async function loadPlanReactions() {
    if (!id) return
    const { data } = await supabase.from('plan_reactions').select('user_id, emoji').eq('plan_id', id)
    setPlanReactions((data || []) as PlanReaction[])
  }

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

    // Plan-level hype reactions (group members can read).
    const { data: prData } = await supabase
      .from('plan_reactions')
      .select('user_id, emoji')
      .eq('plan_id', id)
    setPlanReactions((prData || []) as PlanReaction[])

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
    const wasIn = myStatus === 'in'
    if (status === 'in' && !wasIn) {
      // Fresh yes → celebrate the whole page.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      setBurstKey((k) => k + 1)
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    }
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

  // ---- Moments ----
  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Photo access needed', 'Enable photo access in Settings to add a photo.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    })
    if (result.canceled || !result.assets?.length) return
    setComposerPhoto(result.assets[0])
  }

  function removeComposerPhoto() {
    setComposerPhoto(null)
  }

  function startEditing(post: Post) {
    setActionSheetPost(null)
    setEditingPost({ id: post.id, content: post.content || '' })
    setComposerPhoto(null)
    setComposerText(post.content || '')
    setTimeout(() => composerInputRef.current?.focus(), 80)
  }

  function cancelEditing() {
    setEditingPost(null)
    setComposerText('')
  }

  // Unified submit: edit a comment, post a text comment, or upload a photo
  // (optionally captioned). Mirrors the web composer's three branches.
  async function submitPost() {
    if (!user || !plan || uploading) return
    const text = composerText.trim()
    if (!text && !composerPhoto) return

    // Edit path — only existing comments carry editable text.
    if (editingPost) {
      if (!text) return
      const { error } = await supabase.from('posts').update({ content: text }).eq('id', editingPost.id)
      if (error) { if (__DEV__) console.warn('edit comment', error); return }
      cancelEditing()
      loadPosts()
      return
    }

    setUploading(true)
    let imageUrl: string | null = null

    if (composerPhoto) {
      try {
        const uri = composerPhoto.uri
        const ext = (uri.split('.').pop() || 'jpg').toLowerCase().split('?')[0]
        const path = `${user.id}/${plan.id}-${Date.now()}.${ext}`
        // Supabase's RN-recommended upload: fetch the local file into an
        // ArrayBuffer, then upload the bytes directly to Storage.
        const arraybuffer = await fetch(uri).then((res) => res.arrayBuffer())
        const { error: upErr } = await supabase.storage
          .from('plan-photos')
          .upload(path, arraybuffer, {
            cacheControl: '3600',
            upsert: false,
            contentType: composerPhoto.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          })
        if (upErr) { if (__DEV__) console.warn('photo upload', upErr); setUploading(false); return }
        imageUrl = supabase.storage.from('plan-photos').getPublicUrl(path).data.publicUrl
      } catch (e) {
        if (__DEV__) console.warn('photo upload threw', e)
        setUploading(false)
        return
      }
    }

    const isPhoto = !!composerPhoto
    const { error: insErr } = await supabase.from('posts').insert({
      plan_id: plan.id,
      user_id: user.id,
      type: isPhoto ? 'photo' : 'comment',
      image_url: imageUrl,
      caption: isPhoto && text ? text : null,
      content: !isPhoto && text ? text : null,
    })
    if (insErr) {
      if (__DEV__) console.warn('insert post', insErr)
    } else {
      // Notify everyone else on the plan (never self).
      const others = [...new Set(rsvps.map((r) => r.user_id))].filter((uid) => uid !== user.id)
      for (const uid of others) {
        try {
          await supabase.rpc('create_notification', {
            p_user_id: uid,
            p_type: isPhoto ? 'photo_posted' : 'event_comment',
            p_title: isPhoto ? 'New photo 📸' : 'New comment',
            p_body: isPhoto
              ? `${profile?.display_name || 'Someone'} added a photo to ${plan.name}`
              : `${profile?.display_name || 'Someone'}: ${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`,
            p_plan_id: plan.id,
            p_actor_id: user.id,
          })
        } catch (e) { if (__DEV__) console.warn('post notify', e) }
      }
    }

    setComposerText('')
    setComposerPhoto(null)
    setUploading(false)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    loadPosts()
  }

  async function toggleReaction(post: Post, emoji: string) {
    if (!user) return
    const existing = post.reactions?.find((r) => r.user_id === user.id)
    setReactionPickerId(null)
    if (existing) {
      // Same emoji → remove. Different emoji → swap (delete then insert).
      const { error } = await supabase.from('reactions').delete().eq('id', existing.id)
      if (error) { if (__DEV__) console.warn('reaction delete', error); return }
      if (existing.emoji === emoji) { loadPosts(); return }
    }
    const { error: insErr } = await supabase.from('reactions').insert({
      post_id: post.id, user_id: user.id, emoji,
    })
    if (insErr) { if (__DEV__) console.warn('reaction insert', insErr); loadPosts(); return }
    if (post.user_id !== user.id) {
      try {
        await supabase.rpc('create_notification', {
          p_user_id: post.user_id,
          p_type: 'reaction_received',
          p_title: 'Someone reacted',
          p_body: `${profile?.display_name || 'Someone'} reacted ${emoji} to your post in ${plan?.name || 'a plan'}`,
          p_plan_id: plan?.id,
          p_actor_id: user.id,
        })
      } catch (e) { if (__DEV__) console.warn('reaction notify', e) }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    loadPosts()
  }

  function confirmDeletePost(post: Post) {
    setActionSheetPost(null)
    Alert.alert(
      post.type === 'photo' ? 'Delete this photo?' : 'Delete this comment?',
      'This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => performDeletePost(post) },
      ],
    )
  }

  async function performDeletePost(post: Post) {
    // Best-effort storage cleanup for photo posts.
    if (post.type === 'photo' && post.image_url) {
      const path = post.image_url.split('/plan-photos/')[1]
      if (path) { try { await supabase.storage.from('plan-photos').remove([path]) } catch (e) { if (__DEV__) console.warn('storage remove', e) } }
    }
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) { if (__DEV__) console.warn('delete post', error); return }
    if (editingPost?.id === post.id) cancelEditing()
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    loadPosts()
  }

  function groupReactions(reactions: Reaction[] | null): [string, number][] {
    const map = new Map<string, number>()
    ;(reactions || []).forEach((r) => map.set(r.emoji, (map.get(r.emoji) || 0) + 1))
    return [...map.entries()]
  }

  // ---- Maps ----
  function openMaps(location: string) {
    const q = encodeURIComponent(location)
    const url = Platform.select({ ios: `maps://?q=${q}`, default: `https://www.google.com/maps/search/?api=1&query=${q}` })!
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`))
  }

  // ---- Plan-level hype reaction (one per user; tapping a new emoji replaces) ----
  async function setPlanReaction(emoji: string) {
    if (!user || !plan) return
    setPlanReactorOpen(false)
    setPlanReactions((prev) => [...prev.filter((r) => r.user_id !== user.id), { user_id: user.id, emoji }])
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    const { error } = await supabase
      .from('plan_reactions')
      .upsert({ plan_id: plan.id, user_id: user.id, emoji }, { onConflict: 'plan_id,user_id' })
    if (error) { if (__DEV__) console.warn('plan reaction', error); loadPlanReactions() }
  }

  // ---- Organiser: change cover after creation ----
  async function updateCover(opts: { url?: string; preset?: string }) {
    if (!plan) return
    setCoverBusy(true)
    const { error } = await supabase
      .from('plans')
      .update({ cover_image_url: opts.url ?? null, cover_preset: opts.url ? null : (opts.preset ?? null) })
      .eq('id', plan.id)
    setCoverBusy(false)
    if (error) { if (__DEV__) console.warn('updateCover', error); return }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    setCoverSheetOpen(false)
    load()
  }

  async function pickCoverForUpdate() {
    if (!user) return
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) { Alert.alert('Photo access needed', 'Enable photo access in Settings.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [16, 9] })
    if (result.canceled || !result.assets?.length) return
    const asset = result.assets[0]
    setCoverBusy(true)
    try {
      const ext = (asset.uri.split('.').pop() || 'jpg').toLowerCase().split('?')[0]
      const path = `covers/${user.id}/${Date.now()}.${ext}`
      const ab = await fetch(asset.uri).then((r) => r.arrayBuffer())
      const { error: upErr } = await supabase.storage.from('plan-photos').upload(path, ab, { contentType: asset.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: false })
      if (upErr) { if (__DEV__) console.warn('cover upload', upErr); setCoverBusy(false); return }
      const url = supabase.storage.from('plan-photos').getPublicUrl(path).data.publicUrl
      await updateCover({ url })
    } catch (e) {
      if (__DEV__) console.warn('cover upload threw', e)
      setCoverBusy(false)
    }
  }

  function goBack() {
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)/home' as any)
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFBF5', paddingTop: insets.top }}>
        <FloatingBack onPress={goBack} dark insets={insets} />
        <Loader />
      </View>
    )
  }

  if (!plan) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFBF5', paddingTop: insets.top }}>
        <FloatingBack onPress={goBack} dark insets={insets} />
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

  // ---- Derived for the revamp ----
  const cover = resolveCover(plan)
  const tierEmoji = plan.tier === 1 ? '🎉' : plan.tier === 2 ? '🌅' : '☕'
  const heroWhen = `${formatPlanDate(plan.date)}${plan.time ? ` · ${plan.time}` : ''}`.toUpperCase()

  const inGuests = rsvps.filter((r) => r.status === 'in')
  const likelyGuests = rsvps.filter((r) => r.status === 'likely')
  const noGuests = rsvps.filter((r) => r.status === 'no')
  const noReplyGuests = rsvps.filter((r) => !r.status)
  const guestCounts = { in: inGuests.length, likely: likelyGuests.length, no: noGuests.length, noReply: noReplyGuests.length }

  const planReactionGroups = (() => {
    const m = new Map<string, number>()
    planReactions.forEach((r) => m.set(r.emoji, (m.get(r.emoji) || 0) + 1))
    return [...m.entries()]
  })()
  const myPlanReaction = planReactions.find((r) => r.user_id === user?.id)?.emoji || null

  // Celebration confetti = festive + the crew's own emojis (personal touch).
  const partyEmojis = [...new Set(['🎉', '✨', '🥳', '🔥', '🙌', '💫', ...(rsvps.map((r) => r.profiles?.emoji).filter(Boolean) as string[])])]

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFBF5' }}>
      <StatusBar style="light" />

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingBottom: Math.max(40, insets.bottom + 24) }}
      >
        {/* ===== SLICE A — Parallax cover hero ===== */}
        <View style={{ height: HERO_H, overflow: 'hidden', backgroundColor: '#1A1A1A' }}>
          <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: HERO_H }, heroStyle]}>
            {cover.type === 'image' ? (
              <Image source={{ uri: cover.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <LinearGradient colors={cover.colors as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
            )}
            {cover.type !== 'image' && (
              <>
                {/* Lit highlight overlay — turns the flat gradient into a dimensional, mesh-like wash. */}
                <LinearGradient colors={['rgba(255,255,255,0.38)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: HERO_H }} pointerEvents="none" />
                <Text style={{ position: 'absolute', top: 34, left: 0, right: 0, textAlign: 'center', fontSize: 112, opacity: 0.8, transform: [{ rotate: '-7deg' }] }}>{tierEmoji}</Text>
              </>
            )}
          </Animated.View>
          {/* scrim for legibility */}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.68)']} locations={[0, 0.45, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none" />
          {/* title + tier + when, pinned to hero bottom (editorial stack) */}
          <View style={{ position: 'absolute', left: 18, right: 100, bottom: 26 }} pointerEvents="none">
            <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginBottom: 8 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9, fontWeight: '700', letterSpacing: 0.4, color: '#FFFFFF' }}>{TIER_LABEL[plan.tier] || `Tier ${plan.tier}`}</Text>
            </View>
            <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.7, lineHeight: 31, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 10 }}>{plan.name}</Text>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: 'rgba(255,255,255,0.92)', marginTop: 8 }} numberOfLines={1}>{heroWhen}</Text>
          </View>

          {/* ===== SLICE C — Hype reaction cluster (bottom-right of hero) ===== */}
          <View style={{ position: 'absolute', right: 14, bottom: 28, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {planReactionGroups.length > 0 && (
              <Pressable onPress={() => setPlanReactorOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.42)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                {planReactionGroups.slice(0, 4).map(([emoji, count]) => (
                  <View key={emoji} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Text style={{ fontSize: 13 }}>{emoji}</Text>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, fontWeight: '700', color: '#FFFFFF' }}>{count}</Text>
                  </View>
                ))}
              </Pressable>
            )}
            <Pressable onPress={() => setPlanReactorOpen(true)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: myPlanReaction ? '#FB923C' : 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' }}>
              {myPlanReaction ? <Text style={{ fontSize: 17 }}>{myPlanReaction}</Text> : <Smiley size={19} weight="fill" color="#FFFFFF" />}
            </Pressable>
          </View>
        </View>

        {/* ===== Content sheet — overlaps the hero bottom ===== */}
        <View style={{ backgroundColor: '#FFFBF5', borderTopLeftRadius: 20, borderTopRightRadius: 20, marginTop: -20, paddingHorizontal: 20, paddingTop: 18 }}>
          {/* Warm glow under the hero edge — atmosphere instead of flat cream. */}
          <LinearGradient colors={['#FFF1DE', 'rgba(255,251,245,0)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 150, borderTopLeftRadius: 20, borderTopRightRadius: 20 }} pointerEvents="none" />
          {isClosed && (
            <View style={{ marginBottom: 12 }}><Pill variant="neutral">Closed</Pill></View>
          )}

          {/* ===== SLICE B — Meta chips (When / Where→Maps) ===== */}
          <Animated.View entering={FadeInDown.duration(440).delay(60)} style={{ flexDirection: 'row', gap: 10 }}>
            <View style={CHIP}>
              <View style={CHIP_ICON}><CalendarBlank size={15} weight="fill" color="#FB923C" /></View>
              <View style={{ flex: 1 }}>
                <Text style={CHIP_LABEL}>WHEN</Text>
                <Text style={CHIP_VALUE} numberOfLines={1}>{formatPlanDate(plan.date)}{plan.time ? ` · ${plan.time}` : ''}</Text>
              </View>
            </View>
            {plan.location ? (
              <Pressable style={CHIP} onPress={() => openMaps(plan.location!)}>
                <View style={CHIP_ICON}><MapPin size={15} weight="fill" color="#FB923C" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={CHIP_LABEL}>WHERE</Text>
                  <Text style={CHIP_VALUE} numberOfLines={1}>{plan.location}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9, fontWeight: '700', color: '#FB923C' }}>Maps</Text>
                  <ArrowSquareOut size={11} weight="bold" color="#FB923C" />
                </View>
              </Pressable>
            ) : (
              <View style={CHIP}>
                <View style={CHIP_ICON}><MapPin size={15} weight="regular" color="#CCCCCC" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={CHIP_LABEL}>WHERE</Text>
                  <Text style={[CHIP_VALUE, { color: '#BBBBBB' }]} numberOfLines={1}>Location TBD</Text>
                </View>
              </View>
            )}
          </Animated.View>

          {/* Organiser line */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <EmojiAvatar emoji={plan.organiser?.emoji || '😎'} size="sm" />
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#888888' }}>
              Organised by <Text style={{ fontFamily: 'Inter_700Bold', color: '#111111' }}>{plan.organiser?.display_name || 'Someone'}</Text>
            </Text>
          </View>

          {/* ===== SLICE B — "The plan" callout (notes, all tiers) ===== */}
          {plan.notes ? (
            <View style={{ marginTop: 12, backgroundColor: '#FFF8EF', borderWidth: 1, borderColor: '#FCE4C4', borderRadius: 14, padding: 13 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 8, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: '#C2843A', marginBottom: 4 }}>✨ The plan</Text>
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: '#5a4a36', lineHeight: 19 }}>{plan.notes}</Text>
            </View>
          ) : null}

          {/* RSVP selector */}
        {!isClosed && (
          <Animated.View entering={FadeInDown.duration(440).delay(140)} style={{ marginTop: 24 }}>
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
                      paddingHorizontal: 8,
                      borderRadius: 14,
                      borderWidth: active ? 1.5 : 1,
                      borderColor: active ? opt.activeBorder : 'rgba(255,255,255,0.95)',
                      backgroundColor: active ? opt.activeBg : 'rgba(255,255,255,0.65)',
                      shadowColor: active ? opt.glow : '#000000',
                      shadowOpacity: active ? 0.18 : 0.05,
                      shadowRadius: active ? 12 : 6,
                      shadowOffset: { width: 0, height: 2 },
                    }}
                  >
                    <Text style={{ fontSize: 24, marginBottom: 4 }}>{opt.emoji}</Text>
                    <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, fontWeight: '800', color: '#111111' }}>
                      {opt.label}
                    </Text>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: '#AAAAAA', marginTop: 2 }}>
                      {opt.sub}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </Animated.View>
        )}

        {/* ===== SLICE D — Guest summary (full roster in a sheet) ===== */}
        <Animated.View entering={FadeInDown.duration(440).delay(220)} style={{ marginTop: 26 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={[SECTION_LABEL, { marginBottom: 0 }]}>Who's coming</Text>
            {isOrganiser && pendingRequests.length > 0 && (
              <View style={{ backgroundColor: '#FEF3C7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9, fontWeight: '700', color: '#92400E' }}>
                  {pendingRequests.length} request{pendingRequests.length > 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([['in', 'In', '#34D399'], ['likely', 'Likely', '#F59E0B'], ['no', 'Out', '#9CA3AF'], ['noReply', 'No reply', '#B6BDC6']] as const).map(([k, label, color]) => (
              <View key={k} style={{ flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', borderRadius: 14, paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, fontWeight: '800', color }}>{guestCounts[k]}</Text>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 9, fontWeight: '600', color: '#AAAAAA', marginTop: 1 }}>{label}</Text>
              </View>
            ))}
          </View>

          <Pressable onPress={() => setGuestSheetOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 }}>
            <FaceCluster guests={[...inGuests, ...likelyGuests]} />
            <Text style={{ flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#888888' }} numberOfLines={1}>
              {inGuests.length > 0
                ? `${inGuests[0].profiles?.display_name?.split(' ')[0] || 'Someone'}${inGuests.length > 1 ? ` + ${inGuests.length - 1}` : ''} coming`
                : sortedRsvps.length ? 'No one in yet' : 'No one invited yet'}
            </Text>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, fontWeight: '700', color: '#FB923C' }}>See all →</Text>
          </Pressable>
        </Animated.View>

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

        {/* Moments — crew-only photo + comment feed */}
        {canViewMoments && (
          <View style={{ marginTop: 28 }}>
            <Text style={SECTION_LABEL}>Moments</Text>

            {/* ===== SLICE E1 — Unified one-line composer ===== */}
            {editingPost && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, marginBottom: 6 }}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#F59E0B' }}>Editing comment…</Text>
                <Pressable onPress={cancelEditing} hitSlop={8}>
                  <X size={14} weight="bold" color="#AAAAAA" />
                </Pressable>
              </View>
            )}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                borderWidth: 1,
                borderColor: composerText.trim() || composerPhoto ? '#FB923C' : 'rgba(0,0,0,0.1)',
                borderRadius: 999,
                backgroundColor: '#FFFFFF',
                paddingLeft: 8,
                paddingRight: 6,
                paddingVertical: 6,
              }}
            >
              <EmojiAvatar emoji={profile?.emoji || '😎'} size="sm" />
              {composerPhoto && (
                <View style={{ width: 34, height: 34, borderRadius: 8, overflow: 'hidden' }}>
                  <Image source={{ uri: composerPhoto.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  <Pressable onPress={removeComposerPhoto} style={{ position: 'absolute', top: 1, right: 1, width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={8} weight="bold" color="#FFFFFF" />
                  </Pressable>
                </View>
              )}
              <TextInput
                ref={composerInputRef}
                value={composerText}
                onChangeText={setComposerText}
                placeholder={composerPhoto ? 'Add a caption…' : 'Add a moment…'}
                placeholderTextColor="#BBBBBB"
                style={{ flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14, color: '#111111', paddingVertical: 4 }}
              />
              {!editingPost && (
                <Pressable onPress={pickPhoto} hitSlop={6} style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
                  <Camera size={18} weight="regular" color="#888888" />
                </Pressable>
              )}
              <Pressable
                onPress={submitPost}
                disabled={uploading || (!composerText.trim() && !composerPhoto)}
                style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: composerText.trim() || composerPhoto ? '#111111' : '#E5E7EB' }}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <PaperPlaneTilt size={16} weight="fill" color={composerText.trim() || composerPhoto ? '#FFFFFF' : '#AAAAAA'} />
                )}
              </Pressable>
            </View>

            {/* Uploading skeleton */}
            {uploading && composerPhoto && (
              <View style={{ marginTop: 14, height: 180, borderRadius: 14, backgroundColor: '#F1F1F1', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color="#AAAAAA" />
              </View>
            )}

            {/* Empty state */}
            {posts.length === 0 && !uploading && (
              <View style={{ alignItems: 'center', paddingVertical: 28 }}>
                <Text style={{ fontSize: 30, marginBottom: 8 }}>📸</Text>
                <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, fontWeight: '800', color: '#111111', marginBottom: 4 }}>
                  No moments yet
                </Text>
                <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#AAAAAA' }}>
                  Be the first to add a photo or comment
                </Text>
              </View>
            )}

            {/* Feed */}
            <View style={{ marginTop: posts.length ? 18 : 0, gap: 18 }}>
              {posts.map((post) => {
                const isOwn = post.user_id === user?.id
                const myReaction = post.reactions?.find((r) => r.user_id === user?.id)
                const grouped = groupReactions(post.reactions)
                // Gesture reactions: long-press opens the reactor; on photos a
                // single tap opens the lightbox immediately (double-tap dropped
                // to keep the lightbox instant — see PR notes).
                const openReactor = () => setReactionPickerId(post.id)

                const reactionsBar = (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, position: 'relative' }}>
                    {grouped.map(([emoji, count]) => {
                      const mine = myReaction?.emoji === emoji
                      return (
                        <Pressable
                          key={emoji}
                          onPress={() => toggleReaction(post, emoji)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: mine ? '#FEF3C7' : 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: mine ? '#FB923C' : 'rgba(0,0,0,0.08)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}
                        >
                          <Text style={{ fontSize: 12 }}>{emoji}</Text>
                          <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#555555' }}>{count}</Text>
                        </Pressable>
                      )
                    })}
                    {reactionPickerId === post.id && (
                      <View
                        style={{ position: 'absolute', bottom: 34, left: 0, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8, zIndex: 30 }}
                      >
                        {REACTION_OPTIONS.map((e) => (
                          <Pressable key={e} onPress={() => toggleReaction(post, e)} hitSlop={2} style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 20 }}>{e}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                )

                const header = (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <EmojiAvatar emoji={post.profiles?.emoji || '😎'} size="sm" />
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#111111' }}>
                      {post.profiles?.display_name || 'Friend'}
                    </Text>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#BBBBBB' }}>
                      · {formatTimeAgo(post.created_at)}
                    </Text>
                    <View style={{ flex: 1 }} />
                    {isOwn && (
                      <Pressable onPress={() => setActionSheetPost(post)} hitSlop={8}>
                        <DotsThree size={20} weight="bold" color="#CCCCCC" />
                      </Pressable>
                    )}
                  </View>
                )

                if (post.type === 'photo' && post.image_url) {
                  const imageUrl = post.image_url
                  const photoGesture = Gesture.Exclusive(
                    Gesture.LongPress().minDuration(300).onStart(() => { runOnJS(openReactor)() }),
                    Gesture.Tap().onEnd(() => { runOnJS(setLightboxUrl)(imageUrl) }),
                  )
                  return (
                    <View key={post.id}>
                      {header}
                      <GestureDetector gesture={photoGesture}>
                        <View style={{ width: '100%', height: 200, borderRadius: 14, overflow: 'hidden', backgroundColor: '#F1F1F1' }}>
                          <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                          <View style={{ position: 'absolute', bottom: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                            <CornersOut size={10} weight="bold" color="#FFFFFF" />
                            <Text style={{ fontSize: 9, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' }}>View full</Text>
                          </View>
                        </View>
                      </GestureDetector>
                      {post.caption ? (
                        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: '#111111', lineHeight: 19, marginTop: 6 }}>
                          {post.caption}
                        </Text>
                      ) : null}
                      {reactionsBar}
                    </View>
                  )
                }

                // Comment — speech bubble (long-press to react)
                const commentGesture = Gesture.LongPress().minDuration(300).onStart(() => { runOnJS(openReactor)() })
                return (
                  <View key={post.id}>
                    {header}
                    <GestureDetector gesture={commentGesture}>
                      <View style={{ alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', borderTopLeftRadius: 2, borderTopRightRadius: 14, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, paddingHorizontal: 12, paddingVertical: 10 }}>
                        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: '#111111', lineHeight: 19 }}>
                          {post.content}
                        </Text>
                      </View>
                    </GestureDetector>
                    {reactionsBar}
                  </View>
                )
              })}
            </View>
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
        </View>
      </Animated.ScrollView>

      {/* ===== Floating controls (over the scroll, don't scroll away) ===== */}
      <FloatingBack onPress={goBack} insets={insets} />
      <View style={{ position: 'absolute', top: insets.top + 6, right: 14, flexDirection: 'row', gap: 8 }}>
        {isOrganiser && !isClosed && (
          <Pressable onPress={openEdit} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
            <PencilSimple size={16} weight="bold" color="#FFFFFF" />
          </Pressable>
        )}
        {isOrganiser && (
          <Pressable onPress={() => setCoverSheetOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 38, borderRadius: 19, paddingHorizontal: 13, backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <Camera size={14} weight="fill" color="#FFFFFF" />
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>Change</Text>
          </Pressable>
        )}
      </View>

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

      {/* ---- Post action sheet (own posts) ---- */}
      <Modal visible={!!actionSheetPost} transparent animationType="slide" onRequestClose={() => setActionSheetPost(null)}>
        <Pressable onPress={() => setActionSheetPost(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: '#FFFBF5', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: Math.max(24, insets.bottom + 12), paddingHorizontal: 12 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.1)', alignSelf: 'center', marginBottom: 12 }} />
            {actionSheetPost?.type === 'comment' && (
              <Pressable onPress={() => actionSheetPost && startEditing(actionSheetPost)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 16 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                  <PencilSimple size={16} weight="bold" color="#111111" />
                </View>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#111111' }}>Edit comment</Text>
              </Pressable>
            )}
            <Pressable onPress={() => actionSheetPost && confirmDeletePost(actionSheetPost)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 16 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}>
                <Trash size={16} weight="bold" color="#EF4444" />
              </View>
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#EF4444' }}>
                {actionSheetPost?.type === 'photo' ? 'Delete photo' : 'Delete comment'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ---- Photo lightbox ---- */}
      <Modal visible={!!lightboxUrl} transparent animationType="fade" onRequestClose={() => setLightboxUrl(null)}>
        <Pressable onPress={() => setLightboxUrl(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' }}>
          {lightboxUrl && (
            <Image source={{ uri: lightboxUrl }} style={{ width: '100%', height: '85%' }} resizeMode="contain" />
          )}
          <Pressable
            onPress={() => setLightboxUrl(null)}
            hitSlop={10}
            style={{ position: 'absolute', top: insets.top + 12, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={18} weight="bold" color="#FFFFFF" />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ---- SLICE C — Plan hype reactor ---- */}
      <Modal visible={planReactorOpen} transparent animationType="fade" onRequestClose={() => setPlanReactorOpen(false)}>
        <Pressable onPress={() => setPlanReactorOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: '#FFFBF5', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: Math.max(24, insets.bottom + 12) }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.1)', alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, fontWeight: '800', color: '#111111', marginBottom: 14 }}>Hype it up</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {REACTION_OPTIONS.map((e) => {
                const sel = myPlanReaction === e
                return (
                  <Pressable key={e} onPress={() => setPlanReaction(e)} style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? '#FEF3C7' : 'rgba(0,0,0,0.04)', borderWidth: sel ? 1.5 : 0, borderColor: '#FB923C' }}>
                    <Text style={{ fontSize: 24 }}>{e}</Text>
                  </Pressable>
                )
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ---- SLICE D — Guest roster sheet ---- */}
      <Modal visible={guestSheetOpen} transparent animationType="slide" onRequestClose={() => setGuestSheetOpen(false)}>
        <Pressable onPress={() => setGuestSheetOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: '#FFFBF5', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: Math.max(24, insets.bottom + 12), maxHeight: '85%' }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.1)', alignSelf: 'center', marginBottom: 14 }} />
            <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, fontWeight: '800', color: '#111111', marginBottom: 12 }}>The guest list</Text>
            <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
              {isOrganiser && pendingRequests.length > 0 && (
                <View style={{ marginBottom: 10 }}>
                  <Text style={SECTION_LABEL}>Requests to join · {pendingRequests.length}</Text>
                  {pendingRequests.map((req) => (
                    <View key={req.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }}>
                      <EmojiAvatar emoji={req.requester?.emoji || '😎'} size="sm" />
                      <Text style={{ flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#111111' }}>{req.requester?.display_name || 'Someone'}</Text>
                      <Pressable onPress={() => decideInviteRequest(req, 'rejected')} disabled={requestBusy} hitSlop={4} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F3F4F6', marginRight: 6 }}>
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, fontWeight: '700', color: '#6B7280' }}>Decline</Text>
                      </Pressable>
                      <Pressable onPress={() => decideInviteRequest(req, 'approved')} disabled={requestBusy} hitSlop={4} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#111111' }}>
                        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>Approve</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {([['in', 'In'], ['likely', 'Likely'], ['no', 'Out'], ['noReply', 'No reply']] as const).map(([k, label]) => {
                const group = k === 'in' ? inGuests : k === 'likely' ? likelyGuests : k === 'no' ? noGuests : noReplyGuests
                if (group.length === 0) return null
                return (
                  <View key={k} style={{ marginBottom: 6 }}>
                    <Text style={SECTION_LABEL}>{label} · {group.length}</Text>
                    {group.map((r) => (
                      <View key={r.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }}>
                        <EmojiAvatar emoji={r.profiles?.emoji || '😎'} size="sm" />
                        <Text style={{ flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#111111' }}>
                          {r.profiles?.display_name || 'Someone'}{r.user_id === plan.organiser_id ? '  ·  host' : ''}
                        </Text>
                        {k === 'noReply' && isOrganiser && !isClosed && r.user_id !== user?.id ? (
                          <Pressable onPress={() => canNudge(r.user_id) && nudgeMember(r.user_id)} disabled={!canNudge(r.user_id) || nudging === r.user_id} hitSlop={6} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: canNudge(r.user_id) ? '#FEF3C7' : '#F3F4F6' }}>
                            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, fontWeight: '700', color: canNudge(r.user_id) ? '#92400E' : '#BBBBBB' }}>
                              {nudging === r.user_id ? 'Poking…' : canNudge(r.user_id) ? '👈 Nudge' : 'Nudged'}
                            </Text>
                          </Pressable>
                        ) : r.status ? (
                          <Pill variant={RSVP_PILL[r.status] || 'neutral'}>{RSVP_LABEL[r.status] || r.status}</Pill>
                        ) : (
                          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#CCCCCC' }}>no reply</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )
              })}

              {sortedRsvps.length === 0 && pendingRequests.length === 0 && (
                <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#AAAAAA', paddingVertical: 8 }}>No one's been invited yet.</Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ---- SLICE F — Change cover sheet (organiser) ---- */}
      <Modal visible={coverSheetOpen} transparent animationType="slide" onRequestClose={() => !coverBusy && setCoverSheetOpen(false)}>
        <Pressable onPress={() => !coverBusy && setCoverSheetOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={{ backgroundColor: '#FFFBF5', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: Math.max(24, insets.bottom + 12), maxHeight: '85%' }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.1)', alignSelf: 'center', marginBottom: 14 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, fontWeight: '800', color: '#111111' }}>Change cover</Text>
              {coverBusy && <ActivityIndicator color="#FB923C" />}
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              <Text style={FIELD_LABEL}>Upload or pick a colour</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <Pressable onPress={pickCoverForUpdate} disabled={coverBusy} style={{ width: 46, height: 46, borderRadius: 12, marginRight: 8, backgroundColor: 'rgba(0,0,0,0.04)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <Camera size={18} weight="regular" color="#888888" />
                </Pressable>
                {COVER_PRESETS.map((p) => {
                  const sel = plan.cover_preset === p.id && !plan.cover_image_url
                  return (
                    <Pressable key={p.id} onPress={() => updateCover({ preset: p.id })} disabled={coverBusy} style={{ marginRight: 8, borderRadius: 12, borderWidth: sel ? 2.5 : 0, borderColor: '#111111' }}>
                      <LinearGradient colors={p.colors as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 46, height: 46, borderRadius: sel ? 10 : 12 }} />
                    </Pressable>
                  )
                })}
              </ScrollView>

              {posts.filter((p) => p.type === 'photo' && p.image_url).length > 0 && (
                <>
                  <Text style={FIELD_LABEL}>Use a Moment photo</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {posts.filter((p) => p.type === 'photo' && p.image_url).map((p) => {
                      const sel = plan.cover_image_url === p.image_url
                      return (
                        <Pressable key={p.id} onPress={() => updateCover({ url: p.image_url! })} disabled={coverBusy} style={{ width: 72, height: 72, borderRadius: 12, overflow: 'hidden', borderWidth: sel ? 2.5 : 0, borderColor: '#111111' }}>
                          <Image source={{ uri: p.image_url! }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        </Pressable>
                      )
                    })}
                  </View>
                </>
              )}

              <Pressable onPress={() => updateCover({})} disabled={coverBusy} style={{ marginTop: 18, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, fontWeight: '700', color: '#888888' }}>Reset to tier gradient</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* "I'm in" celebration — spans the whole page over everything. */}
      {burstKey > 0 && <EmojiBurst key={burstKey} emojis={partyEmojis} />}
    </View>
  )
}

function FloatingBack({ onPress, insets, dark }: { onPress: () => void; insets: { top: number }; dark?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{ position: 'absolute', top: insets.top + 6, left: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: dark ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
    >
      <CaretLeft size={18} weight="bold" color={dark ? '#111111' : '#FFFFFF'} />
    </Pressable>
  )
}

// Overlapping avatar cluster for the guest summary.
function FaceCluster({ guests, max = 5 }: { guests: Rsvp[]; max?: number }) {
  if (guests.length === 0) {
    return (
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 13 }}>🫥</Text>
      </View>
    )
  }
  const shown = guests.slice(0, max)
  const extra = guests.length - shown.length
  return (
    <View style={{ flexDirection: 'row' }}>
      {shown.map((g, i) => (
        <View key={g.user_id} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFBF5', marginLeft: i === 0 ? 0 : -10 }}>
          <Text style={{ fontSize: 15 }}>{g.profiles?.emoji || '😎'}</Text>
        </View>
      ))}
      {extra > 0 && (
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#111111', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFBF5', marginLeft: -10 }}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, fontWeight: '700', color: '#FFFFFF' }}>+{extra}</Text>
        </View>
      )}
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

const CHIP = {
  flex: 1,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 8,
  backgroundColor: '#FFFFFF',
  borderWidth: 1,
  borderColor: 'rgba(0,0,0,0.06)',
  borderRadius: 14,
  paddingHorizontal: 11,
  paddingVertical: 10,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.04,
  shadowRadius: 4,
}
const CHIP_ICON = {
  width: 28,
  height: 28,
  borderRadius: 9,
  backgroundColor: '#FFF3E6',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
}
const CHIP_LABEL = {
  fontFamily: 'Inter_700Bold' as const,
  fontSize: 8,
  fontWeight: '700' as const,
  letterSpacing: 0.6,
  color: '#BBBBBB',
  marginBottom: 1,
}
const CHIP_VALUE = {
  fontFamily: 'Inter_600SemiBold' as const,
  fontSize: 12,
  color: '#111111',
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
