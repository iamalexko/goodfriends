import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { NavBar, TopBar, BackButton, Pill, EmojiAvatar, Divider, SectionHeader } from '../components/UI'

const REACTION_OPTIONS = ['😂', '😍', '🔥', '👏', '😭', '🫶', '❓']

function formatTimeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  if (isNaN(diff)) return ''
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatPlanDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-AE', { weekday:'short', day:'numeric', month:'short' })
}

const TIER_LABEL = { 1: 'Tier 1 · Big deal', 2: 'Tier 2 · Weekend plan', 3: 'Tier 3 · Low-key' }
const TIER_PILL  = { 1: 'tier1', 2: 'tier2', 3: 'tier3' }

const RSVP_OPTIONS = [
  {
    key: 'in', emoji: '✅', label: "I'm in", sub: '100% there',
    active: {
      background: '#DCFCE7',
      border: '1.5px solid #16A34A',
      boxShadow: '0 2px 12px rgba(22,163,74,0.15)',
    },
  },
  {
    key: 'likely', emoji: '🤔', label: 'Likely', sub: 'pretty sure',
    active: {
      background: '#FEF3C7',
      border: '1.5px solid #F59E0B',
      boxShadow: '0 2px 12px rgba(245,158,11,0.15)',
    },
  },
  {
    key: 'no', emoji: '😬', label: 'No', sub: "can't make it",
    active: {
      background: '#F3F4F6',
      border: '1.5px solid #9CA3AF',
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    },
  },
]

// Tile style applied when the option is NOT selected — frosted glass.
const RSVP_DEFAULT_STYLE = {
  background: 'rgba(255,255,255,0.65)',
  backdropFilter: 'blur(32px)',
  WebkitBackdropFilter: 'blur(32px)',
  border: '1px solid rgba(255,255,255,0.95)',
  boxShadow: '0 2px 12px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.04)',
}

// Geometry shared by all states (active + default).
const RSVP_BASE_STYLE = {
  borderRadius: 14,
  padding: '14px 8px',
  textAlign: 'center',
  cursor: 'pointer',
}

const RSVP_PILL = { in: 'mint', likely: 'yellow', no: 'neutral', null: 'neutral' }
const RSVP_LABEL = { in: "I'm in", likely: 'Likely', no: 'No' }

export default function PlanDetail({ navigate, planId, fromShareLink = false }) {
  const { profile } = useAuth()
  const [plan, setPlan] = useState(null)
  const [rsvps, setRsvps] = useState([])
  const [myRsvp, setMyRsvp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [attendance, setAttendance] = useState({})

  // Edit sheet state
  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', date: '', time: '', location: '', notes: '' })
  const [editMembers, setEditMembers] = useState([])
  const [originalInvited, setOriginalInvited] = useState(new Set())
  const [invited, setInvited] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const [noticeMessage, setNoticeMessage] = useState('')
  const [shareOpen, setShareOpen] = useState(false)
  const [requestBusy, setRequestBusy] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [inviteRequests, setInviteRequests] = useState([])
  const [myInviteRequest, setMyInviteRequest] = useState(null)

  // Delete sheet state
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deletedToastVisible, setDeletedToastVisible] = useState(false)

  // Nudge state — records of nudges I (the organiser) have sent for this plan
  const [nudges, setNudges] = useState([])
  const [nudging, setNudging] = useState(null) // userId currently being nudged

  // Moments feed state
  const [posts, setPosts] = useState([])
  const [uploading, setUploading] = useState(false)
  const [editingPost, setEditingPost] = useState(null) // { id, content }
  const [actionSheetPost, setActionSheetPost] = useState(null) // post being acted on
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
  const [reactionPickerPostId, setReactionPickerPostId] = useState(null)
  const [lightbox, setLightbox] = useState(null) // { photos: string[], index: number }
  const [currentUserId, setCurrentUserId] = useState(null)
  // Unified composer state — handles both text-only comments and photo+caption posts
  const [composerText, setComposerText] = useState('')
  const [composerPhoto, setComposerPhoto] = useState(null) // { file, previewUrl }
  const [composerExpanded, setComposerExpanded] = useState(false)
  const fileInputRef = useRef(null)
  const composerRef = useRef(null)
  const composerTextRef = useRef(null)

  const isOrganiser = !!currentUserId && plan?.organiser_id === currentUserId
  const isInvited = !!currentUserId && rsvps.some(r => r.user_id === currentUserId)
  const canViewFullPlan = !!plan && (isOrganiser || isInvited)

  useEffect(() => { loadPlan() }, [planId])

  useEffect(() => {
    if (!planId || !canViewFullPlan) { setPosts([]); return }
    loadPosts()
    const channel = supabase
      .channel('posts-' + planId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `plan_id=eq.${planId}` }, loadPosts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, loadPosts)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, canViewFullPlan])

  // Collapse the composer when the user clicks outside it, but only if there's
  // nothing in flight (no typed text, no attached photo, not editing).
  useEffect(() => {
    function handleClickOutside(e) {
      if (composerText || composerPhoto || editingPost) return
      if (composerRef.current && !composerRef.current.contains(e.target)) {
        setComposerExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [composerText, composerPhoto, editingPost])

  // Clean up the preview blob URL on unmount to avoid leaking memory.
  useEffect(() => {
    return () => { if (composerPhoto?.previewUrl) URL.revokeObjectURL(composerPhoto.previewUrl) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadPosts() {
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles(display_name, emoji), reactions(id, emoji, user_id)')
      .eq('plan_id', planId)
      .order('created_at', { ascending: true })
    if (error) { console.error('PlanDetail: failed to load posts', error); return }
    setPosts(data || [])
  }

  function handlePhotoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    // Clear any previous preview blob URL before swapping in the new one.
    if (composerPhoto?.previewUrl) URL.revokeObjectURL(composerPhoto.previewUrl)
    const previewUrl = URL.createObjectURL(file)
    setComposerPhoto({ file, previewUrl })
    setComposerExpanded(true)
  }

  function removePhoto() {
    if (composerPhoto?.previewUrl) URL.revokeObjectURL(composerPhoto.previewUrl)
    setComposerPhoto(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Unified submit — handles 3 cases:
  //   1. Editing an existing comment (text-only update via posts.update)
  //   2. New text-only comment (type='comment', content=text)
  //   3. New photo post with optional caption (type='photo', image_url=url, caption=text|null)
  async function submitPost() {
    const text = composerText.trim()
    if (!text && !composerPhoto) return

    // Edit path: only existing comment posts can be edited (text field).
    if (editingPost) {
      if (!text) return
      const { error } = await supabase.from('posts').update({ content: text }).eq('id', editingPost.id)
      if (error) { console.error('PlanDetail: edit comment failed', error); return }
      setEditingPost(null)
      setComposerText('')
      setComposerExpanded(false)
      loadPosts()
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUploading(true)

    let imageUrl = null
    if (composerPhoto) {
      const ext = (composerPhoto.file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${user.id}/${planId}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('plan-photos').upload(path, composerPhoto.file, {
        cacheControl: '3600',
        upsert: false,
        contentType: composerPhoto.file.type || undefined,
      })
      if (upErr) {
        console.error('PlanDetail: photo upload failed', upErr)
        setUploading(false)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('plan-photos').getPublicUrl(path)
      imageUrl = publicUrl
    }

    const isPhoto = !!composerPhoto
    const { error: insErr } = await supabase.from('posts').insert({
      plan_id: planId,
      user_id: user.id,
      type: isPhoto ? 'photo' : 'comment',
      image_url: imageUrl,
      caption: isPhoto && text ? text : null,
      content: !isPhoto && text ? text : null,
    })
    if (insErr) console.error('PlanDetail: insert post failed', insErr)
    else {
      const uniqueUsers = [...new Set(rsvps.map(r => r.user_id))].filter(id => id !== user.id)
      for (const userId of uniqueUsers) {
        await supabase.rpc('create_notification', {
          p_user_id: userId,
          p_type: isPhoto ? 'photo_posted' : 'event_comment',
          p_title: isPhoto ? 'New photo 📸' : 'New comment',
          p_body: isPhoto
            ? `${profile?.display_name || 'Someone'} added a photo to ${plan.name}`
            : `${profile?.display_name || 'Someone'}: ${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`,
          p_plan_id: planId,
          p_actor_id: user.id,
        })
      }
    }

    // Reset composer
    if (composerPhoto?.previewUrl) URL.revokeObjectURL(composerPhoto.previewUrl)
    setComposerText('')
    setComposerPhoto(null)
    setComposerExpanded(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setUploading(false)
    loadPosts()
  }

  function startEditing(post) {
    setActionSheetPost(null)
    setEditingPost({ id: post.id, content: post.content || '' })
    setComposerText(post.content || '')
    setComposerExpanded(true)
    setTimeout(() => composerTextRef.current?.focus(), 50)
  }

  function cancelEditing() {
    setEditingPost(null)
    setComposerText('')
    setComposerExpanded(false)
  }

  async function toggleReaction(postId, emoji) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const post = posts.find(p => p.id === postId)
    const existing = post?.reactions?.find(r => r.user_id === user.id)
    if (existing) {
      // If clicking the SAME emoji, remove. Otherwise swap (delete + insert).
      const { error } = await supabase.from('reactions').delete().eq('id', existing.id)
      if (error) { console.error('toggleReaction delete', error); return }
      if (existing.emoji === emoji) { setReactionPickerPostId(null); loadPosts(); return }
    }
    const { error: insErr } = await supabase.from('reactions').insert({
      post_id: postId, user_id: user.id, emoji,
    })
    if (insErr) console.error('toggleReaction insert', insErr)
    else if (post?.user_id) {
      await supabase.rpc('create_notification', {
        p_user_id: post.user_id,
        p_type: 'reaction_received',
        p_title: 'Someone reacted',
        p_body: `${profile?.display_name || 'Someone'} reacted ${emoji} to your post in ${plan?.name || 'a plan'}`,
        p_plan_id: planId,
        p_actor_id: user.id,
      })
    }
    setReactionPickerPostId(null)
    loadPosts()
  }

  async function performDeletePost(post) {
    if (post.type === 'photo' && post.image_url) {
      const path = post.image_url.split('/plan-photos/')[1]
      if (path) await supabase.storage.from('plan-photos').remove([path])
    }
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (error) { console.error('PlanDetail: delete post failed', error); return }
    setConfirmingDeleteId(null)
    if (editingPost?.id === post.id) cancelEditing()
    loadPosts()
  }

  function groupReactionsByEmoji(reactions) {
    const map = new Map()
    ;(reactions || []).forEach(r => {
      map.set(r.emoji, (map.get(r.emoji) || 0) + 1)
    })
    return [...map.entries()]
  }

  function openLightbox(post, index) {
    // Today each post has a single image_url; spec allows for multi-photo
    // posts in future (image_url2 etc). Build the photos array from whatever
    // url-shaped fields exist so this scales without further changes.
    const photos = [post.image_url, post.image_url2, post.image_url3, post.image_url4]
      .filter(Boolean)
    if (photos.length === 0) return
    setLightbox({ photos, index: Math.min(index, photos.length - 1) })
  }

  async function loadInviteRequests(nextPlan = plan, userId = currentUserId) {
    if (!nextPlan || !userId) { setInviteRequests([]); setMyInviteRequest(null); return }

    let query = supabase
      .from('event_invite_requests')
      .select('*, requester:requester_id(id, display_name, emoji)')
      .eq('plan_id', nextPlan.id)

    if (nextPlan.organiser_id !== userId) query = query.eq('requester_id', userId)

    const { data, error } = await query.order('created_at', { ascending: true })
    if (error) {
      console.error('PlanDetail: failed to load invite requests', error)
      setRequestError(error.message)
      setInviteRequests([])
      setMyInviteRequest(null)
      return
    }

    setRequestError('')
    setInviteRequests(data || [])
    setMyInviteRequest((data || []).find(r => r.requester_id === userId) || null)
  }

  async function loadPlan() {
    if (!planId) { setLoading(false); return }
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id || null)

    const { data: planData } = await supabase
      .from('plans').select('*, profiles!organiser_id(display_name, emoji)').eq('id', planId).maybeSingle()
    if (planData) setPlan(planData)
    else { setPlan(null); setLoading(false); return }

    const { data: rsvpData } = await supabase
      .from('rsvps').select('*, profiles(display_name, emoji, id)')
      .eq('plan_id', planId)
    if (rsvpData) {
      setRsvps(rsvpData)
      const mine = rsvpData.find(r => r.user_id === user?.id)
      setMyRsvp(mine?.status || null)
      const att = {}
      rsvpData.forEach(r => { att[r.user_id] = r.status === 'in' })
      setAttendance(att)
    }

    await loadInviteRequests(planData, user?.id)

    // Load nudges this user has sent for this plan. RLS scopes select to
    // rows where I'm nudger or nudgee; the explicit nudger_id filter narrows
    // to the ones I sent, used for the per-row "Nudged Xm ago" hint.
    if (user) {
      const { data: nudgeData } = await supabase
        .from('nudges')
        .select('*')
        .eq('plan_id', planId)
        .eq('nudger_id', user.id)
      if (nudgeData) setNudges(nudgeData)
    }

    setLoading(false)
  }

  // 24h cooldown between nudges to the same person on the same plan.
  function canNudge(userId) {
    const existing = nudges.find(n => n.nudgee_id === userId)
    if (!existing) return true
    const hoursSince = (Date.now() - new Date(existing.created_at).getTime()) / 3600000
    return hoursSince >= 24
  }

  function nudgedAgo(userId) {
    const existing = nudges.find(n => n.nudgee_id === userId)
    if (!existing) return null
    const mins = Math.floor((Date.now() - new Date(existing.created_at).getTime()) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins / 60)}h ago`
  }

  async function nudgeMember(targetUserId) {
    setNudging(targetUserId)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setNudging(null); return }

    // Delete + reinsert so the unique(plan_id, nudger_id, nudgee_id) constraint
    // doesn't block a re-nudge once the 24h cooldown has elapsed.
    await supabase.from('nudges')
      .delete()
      .eq('plan_id', planId)
      .eq('nudger_id', user.id)
      .eq('nudgee_id', targetUserId)

    const { error: insErr } = await supabase.from('nudges').insert({
      plan_id: planId,
      nudger_id: user.id,
      nudgee_id: targetUserId,
    })
    if (insErr) {
      console.error('PlanDetail: nudge insert failed', insErr)
      setNudging(null)
      return
    }

    // In-app notification - reuses event_invite so the bell icon/label fits.
    await supabase.rpc('create_notification', {
      p_user_id: targetUserId,
      p_type: 'event_invite',
      p_title: `${profile?.display_name || 'Someone'} poked you 🫷`,
      p_body: `Are you in for ${plan?.name || 'this plan'} or not? 👀`,
      p_plan_id: planId,
      p_actor_id: user.id,
    })

    const { data } = await supabase
      .from('nudges')
      .select('*')
      .eq('plan_id', planId)
      .eq('nudger_id', user.id)
    if (data) setNudges(data)
    setNudging(null)
  }

  function showNotice(message) {
    setNoticeMessage(message)
    setTimeout(() => setNoticeMessage(''), 2000)
  }

  function getEventShareUrl() {
    const base = window.location.origin || 'https://goodfriends.app'
    return `${base}/event/${planId}`
  }

  function getEventShareText() {
    const when = [plan?.date ? formatPlanDate(plan.date) : '', plan?.time].filter(Boolean).join(' · ')
    const where = plan?.location ? ' at ' + plan.location : ''
    const name = plan?.name || 'Plan'
    const eventLine = name + (when ? ' is on ' + when : '') + where
    return [eventLine, 'Open it in Goodfriends:', getEventShareUrl()].join('\n')
  }

  async function shareNative() {
    if (navigator.share) {
      try {
        await navigator.share({ title: plan?.name || 'Goodfriends plan', text: getEventShareText(), url: getEventShareUrl() })
        setShareOpen(false)
      } catch {}
      return
    }
    await copyEventLink()
  }

  async function copyEventLink() {
    try { await navigator.clipboard?.writeText(getEventShareUrl()) } catch {}
    showNotice('Event link copied')
  }

  function shareToWhatsApp() {
    window.location.href = 'https://wa.me/?text=' + encodeURIComponent(getEventShareText())
  }

  async function requestInvite() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !plan || requestBusy || myInviteRequest?.status === 'pending') return
    setRequestBusy(true)
    setRequestError('')

    const { data, error } = await supabase
      .from('event_invite_requests')
      .upsert(
        { plan_id: planId, requester_id: user.id, status: 'pending', decided_by: null, decided_at: null },
        { onConflict: 'plan_id,requester_id' }
      )
      .select('*, requester:requester_id(id, display_name, emoji)')
      .single()

    if (error) {
      setRequestError(error.message)
      setRequestBusy(false)
      return
    }

    setMyInviteRequest(data)
    setInviteRequests(prev => [data, ...prev.filter(r => r.id !== data.id)])
    showNotice('Request sent')

    await supabase.rpc('create_notification', {
      p_user_id: plan.organiser_id,
      p_type: 'event_invite_request',
      p_title: 'Invite request',
      p_body: `${profile?.display_name || 'Someone'} asked to join ${plan.name}`,
      p_plan_id: planId,
      p_actor_id: user.id,
    })

    setRequestBusy(false)
  }

  async function decideInviteRequest(request, status) {
    if (!isOrganiser || requestBusy) return
    setRequestBusy(true)
    setRequestError('')

    if (status === 'approved') {
      const { error: inviteErr } = await supabase
        .from('rsvps')
        .upsert(
          { plan_id: planId, user_id: request.requester_id, status: null },
          { onConflict: 'plan_id,user_id', ignoreDuplicates: true }
        )
      if (inviteErr) { setRequestError(inviteErr.message); setRequestBusy(false); return }
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('event_invite_requests')
      .update({ status, decided_by: user?.id || null, decided_at: new Date().toISOString() })
      .eq('id', request.id)
      .select('*, requester:requester_id(id, display_name, emoji)')
      .single()

    if (error) { setRequestError(error.message); setRequestBusy(false); return }

    setInviteRequests(prev => prev.map(r => r.id === data.id ? data : r))
    showNotice(status === 'approved' ? 'Invite sent' : 'Request rejected')

    await supabase.rpc('create_notification', {
      p_user_id: request.requester_id,
      p_type: status === 'approved' ? 'event_request_approved' : 'event_request_rejected',
      p_title: status === 'approved' ? 'You were invited' : 'Request declined',
      p_body: status === 'approved'
        ? `${profile?.display_name || 'The planner'} added you to ${plan.name}`
        : `${profile?.display_name || 'The planner'} declined your request for ${plan.name}`,
      p_plan_id: status === 'approved' ? planId : null,
      p_actor_id: user?.id || null,
    })

    await loadPlan()
    setRequestBusy(false)
  }

  async function setRsvpStatus(status) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Snapshot for rollback if the write fails
    const previousMy = myRsvp
    const previousRsvps = rsvps

    // Optimistic update — both the top selector AND the crew list below.
    // The crew list reads from `rsvps`, so it would otherwise stay stale
    // until next page load.
    setMyRsvp(status)
    setRsvps(prev => {
      const existing = prev.find(r => r.user_id === user.id)
      if (existing) {
        return prev.map(r => r.user_id === user.id ? { ...r, status } : r)
      }
      // Defensive: user wasn't pre-invited (e.g. they joined the group after
      // the plan was created and the organiser hasn't reopened invites).
      return [
        ...prev,
        {
          plan_id: planId,
          user_id: user.id,
          status,
          profiles: {
            id: user.id,
            display_name: profile?.display_name,
            emoji: profile?.emoji,
          },
        },
      ]
    })

    // Explicit onConflict so PostgREST UPDATEs the existing (plan_id,user_id)
    // row instead of trying to INSERT a duplicate that would hit the unique
    // constraint and silently fail.
    const { error } = await supabase
      .from('rsvps')
      .upsert(
        { plan_id: planId, user_id: user.id, status },
        { onConflict: 'plan_id,user_id' }
      )
    if (error) {
      console.error('PlanDetail: failed to save RSVP', error)
      setMyRsvp(previousMy)
      setRsvps(previousRsvps)
      return
    }

    // Notify organiser
    const statusBody = status === 'in' ? 'in' : status === 'likely' ? 'likely in' : 'out'
    await supabase.rpc('create_notification', {
      p_user_id: plan.organiser_id,
      p_type: 'event_rsvp',
      p_title: 'New RSVP',
      p_body: `${profile?.display_name || 'Someone'} is ${statusBody} for ${plan.name}`,
      p_plan_id: planId,
      p_actor_id: user.id,
    })

    // If 5+ confirmed after this change, nudge anyone who still hasn't replied
    const nextRsvps = previousRsvps.map(r => r.user_id === user.id ? { ...r, status } : r)
    const hasMe = nextRsvps.some(r => r.user_id === user.id)
    const fullList = hasMe ? nextRsvps : [...nextRsvps, { user_id: user.id, status }]
    const confirmedCount = fullList.filter(r => r.status === 'in').length
    if (confirmedCount >= 5) {
      const noReply = fullList.filter(r => !r.status && r.user_id !== user.id)
      for (const r of noReply) {
        await supabase.rpc('create_notification', {
          p_user_id: r.user_id,
          p_type: 'event_filling',
          p_title: 'Event filling up 👀',
          p_body: `${confirmedCount} people are in for ${plan.name} — still need your reply`,
          p_plan_id: planId,
          p_actor_id: user.id,
        })
      }
    }
  }

  async function openEditSheet() {
    setSaveError('')
    setEditForm({
      name: plan?.name || '',
      date: plan?.date || '',
      time: plan?.time || '',
      location: plan?.location || '',
      notes: plan?.notes || '',
    })
    setEditOpen(true)
    setEditLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: mem, error } = await supabase
      .from('group_members')
      .select('user_id, profiles(id, display_name, emoji), joined_at')
      .eq('group_id', plan.group_id)
      .order('joined_at', { ascending: true })
    if (error) { console.error('PlanDetail: failed to load members for edit', error) }
    const members = (mem || []).map(m => ({
      id: m.user_id,
      name: m.profiles?.display_name || 'Friend',
      emoji: m.profiles?.emoji || '😎',
      isMe: m.user_id === user.id,
    }))
    setEditMembers(members)
    const invitedIds = new Set(rsvps.map(r => r.user_id))
    setOriginalInvited(invitedIds)
    setInvited(new Set(invitedIds))
    setEditLoading(false)
  }

  function toggleInvite(userId, isMe) {
    if (isMe) return
    setInvited(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  async function deletePlan() {
    setDeleteError('')
    setDeleting(true)

    // Only notify on cancellation of an OPEN (future) plan. Deleting a closed
    // plan is record-cleanup, not a cancellation.
    if (plan?.status === 'open') {
      const { data: { user: cancelUser } } = await supabase.auth.getUser()
      // plan_id is intentionally null because the row is about to be deleted
      // and the notifications FK cascades. Body carries the plan name so the
      // notification still makes sense after the plan is gone.
      for (const r of rsvps) {
        await supabase.rpc('create_notification', {
          p_user_id: r.user_id,
          p_type: 'event_cancelled',
          p_title: 'Plan cancelled ❌',
          p_body: `${profile?.display_name || 'The organiser'} cancelled ${plan.name}`,
          p_plan_id: null,
          p_actor_id: cancelUser?.id,
        })
      }
    }

    // Order matters: child rows first (rsvps + attendances), then the plan itself.
    // Even with ON DELETE CASCADE on the FKs we issue these explicitly so RLS
    // failures on child tables surface as a clear error instead of cascading silently.
    const { error: rsvpErr } = await supabase.from('rsvps').delete().eq('plan_id', planId)
    if (rsvpErr) { setDeleteError(rsvpErr.message); setDeleting(false); return }

    const { error: attErr } = await supabase.from('attendances').delete().eq('plan_id', planId)
    if (attErr) { setDeleteError(attErr.message); setDeleting(false); return }

    const { error: planErr } = await supabase.from('plans').delete().eq('id', planId)
    if (planErr) { setDeleteError(planErr.message); setDeleting(false); return }

    setDeleting(false)
    setDeleteOpen(false)
    setDeletedToastVisible(true)
    setTimeout(() => {
      setDeletedToastVisible(false)
      navigate('plans')
    }, 2000)
  }

  async function saveEdits() {
    if (!editForm.name.trim()) { setSaveError('Plan name is required'); return }
    if (!editForm.date) { setSaveError('Pick a date'); return }
    setSaving(true)
    setSaveError('')

    const { error: planErr } = await supabase
      .from('plans')
      .update({
        name: editForm.name.trim(),
        date: editForm.date,
        time: editForm.time,
        location: editForm.location,
        notes: editForm.notes,
      })
      .eq('id', planId)
    if (planErr) { setSaveError(planErr.message); setSaving(false); return }

    const toAdd = [...invited].filter(id => !originalInvited.has(id))
    const toRemove = [...originalInvited].filter(id => !invited.has(id))

    if (toAdd.length > 0) {
      const rows = toAdd.map(userId => ({ plan_id: planId, user_id: userId, status: null }))
      const { error: addErr } = await supabase.from('rsvps').insert(rows)
      if (addErr) { setSaveError(addErr.message); setSaving(false); return }
    }
    if (toRemove.length > 0) {
      const { error: rmErr } = await supabase
        .from('rsvps').delete().eq('plan_id', planId).in('user_id', toRemove)
      if (rmErr) { setSaveError(rmErr.message); setSaving(false); return }
    }

    setSaving(false)
    setEditOpen(false)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2000)
    await loadPlan()
  }

  async function closeEvent() {
    setClosing(true)

    const rows = Object.entries(attendance).map(([userId, came]) => ({
      plan_id: planId, user_id: userId, came,
    }))
    await supabase.from('attendances').upsert(rows)

    await supabase.from('plans').update({ status: 'closed' }).eq('id', planId)

    const multiplier = plan?.tier || 1
    const attended = Object.entries(attendance).filter(([_, came]) => came)
    for (const [userId] of attended) {
      await supabase.rpc('add_points', { p_user_id: userId, p_group_id: plan.group_id, p_points: multiplier * 10 })
    }

    // Recalculate attendance_rate / plans_organised / streak for every member
    // whose attendance was recorded (attended OR didn't), so the Crew leaderboard
    // reflects the close.
    const everyone = Object.keys(attendance)
    await Promise.all(everyone.map(userId =>
      supabase.rpc('recalculate_member_score', { p_user_id: userId, p_group_id: plan.group_id })
    ))

    const { data: { user: closeUser } } = await supabase.auth.getUser()
    for (const rsvp of rsvps) {
      await supabase.rpc('create_notification', {
        p_user_id: rsvp.user_id,
        p_type: 'event_closed',
        p_title: 'Event closed ✓',
        p_body: `${plan.name} has been closed — scores updated`,
        p_plan_id: planId,
        p_actor_id: closeUser?.id,
      })
    }

    setClosing(false)
    navigate('home')
  }

  if (loading) return (
    <div className="phone-shell flex items-center justify-center">
      <div className="text-4xl animate-spin">⚡</div>
    </div>
  )

  if (!plan) return (
    <div className="phone-shell flex flex-col">
      {fromShareLink && <TopBar navigate={navigate} />}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
        <div className="text-5xl">{fromShareLink ? '🔒' : '📭'}</div>
        <div className="font-display font-black text-[22px] text-ink">
          {fromShareLink ? 'Private event' : 'No plan selected'}
        </div>
        <p className="text-[13px] text-[#aaa] leading-relaxed">
          {fromShareLink
            ? 'This event is only visible to members of its crew.'
            : 'Go back to your home feed to pick a plan.'}
        </p>
        <button onClick={() => navigate('home')} className="px-6 py-3 bg-ink text-white rounded-full font-semibold text-sm">Back home</button>
      </div>
    </div>
  )

  if (!canViewFullPlan) {
    const requestStatus = myInviteRequest?.status
    const isPending = requestStatus === 'pending'
    const isRejected = requestStatus === 'rejected'
    const requestDisabled = requestBusy || isPending || isRejected || plan.status !== 'open'

    return (
      <div className="phone-shell">
        <TopBar navigate={navigate} />
        <div className="orb" style={{ width:180, height:180, background:'#FDE68A', top:-50, right:-40, opacity:0.45 }} />
        <div className="orb" style={{ width:120, height:120, background:'#BAE6FD', top:200, left:-30, opacity:0.35 }} />
        <div className="min-h-[calc(100vh-64px)] flex flex-col justify-center px-7 pb-16 relative z-10 text-center">
          <div className="w-16 h-16 rounded-[24px] bg-[#FEF3C7] flex items-center justify-center text-[30px] mx-auto mb-5">🔒</div>
          <div className="font-display font-black text-[26px] leading-tight text-ink mb-2">You're not invited yet</div>
          <p className="text-[13px] text-[#888] leading-relaxed mb-5">
            You're in the crew, but this event is only open to people the planner invited.
          </p>
          <div className="glass-card text-left p-4 mb-5">
            <div className="flex items-center gap-2 mb-2"><Pill variant={TIER_PILL[plan.tier]}>{TIER_LABEL[plan.tier]}</Pill></div>
            <div className="font-display font-black text-[18px] text-ink leading-tight mb-2">{plan.name}</div>
            <div className="flex items-center gap-1.5 text-[12px] text-[#aaa] mb-1">
              <i className="ti ti-calendar text-[13px]" />
              {[formatPlanDate(plan.date), plan.time].filter(Boolean).join(' · ')}
            </div>
            {plan.profiles && (
              <div className="flex items-center gap-1.5 text-[12px] text-[#aaa]">
                <i className="ti ti-user text-[13px]" />
                Planned by <span className="text-primary font-bold ml-0.5">{plan.profiles.display_name}</span>
              </div>
            )}
          </div>
          <button
            onClick={requestInvite}
            disabled={requestDisabled}
            className="w-full py-4 bg-ink text-white rounded-full font-display font-black text-base disabled:opacity-50"
          >
            {requestBusy ? 'Sending…' : isPending ? 'Request sent' : isRejected ? 'Request declined' : plan.status !== 'open' ? 'Event closed' : 'Request invite'}
          </button>
          {requestError && <p className="text-red-500 text-xs mt-3">{requestError}</p>}
          {isPending && <p className="text-[12px] text-[#aaa] leading-relaxed mt-3">The planner will get an in-app notification and can add you from the event page.</p>}
          <button onClick={() => navigate('home')} className="mt-4 text-[13px] font-semibold text-[#aaa]">Back home</button>
        </div>
        <NavBar active="plans" navigate={navigate} />
      </div>
    )
  }

  return (
    <div className="phone-shell">
      <TopBar navigate={navigate} />
      <div className="orb" style={{ width:180, height:180, background:'#FDE68A', top:-50, right:-40, opacity:0.45 }} />
      <div className="orb" style={{ width:120, height:120, background:'#BAE6FD', top:200, left:-30, opacity:0.35 }} />

      <div className="px-5 pt-4 pb-3 relative z-10">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <BackButton onClick={() => navigate('home')} />
            <Pill variant={TIER_PILL[plan.tier]}>{TIER_LABEL[plan.tier]}</Pill>
          </div>
          <button
            onClick={() => setShareOpen(true)}
            aria-label="Share event"
            className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
          >
            <Upload size={16} strokeWidth={2.4} className="text-ink" />
          </button>
        </div>
        <div className="flex items-start gap-2 mb-2">
          <div className="font-display text-[28px] font-black text-ink leading-tight flex-1 min-w-0">{plan.name}</div>
          {isOrganiser && plan.status === 'open' && (
            <button
              onClick={openEditSheet}
              aria-label="Edit plan"
              className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center flex-shrink-0 mt-1 active:scale-95 transition-transform"
            >
              <i className="ti ti-pencil text-ink text-base" />
            </button>
          )}
          {isOrganiser && (plan.status === 'open' || plan.status === 'closed') && (
            <button
              onClick={() => { setDeleteError(''); setDeleteOpen(true) }}
              aria-label="Delete plan"
              className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-1 active:scale-95 transition-transform"
            >
              <i className="ti ti-trash text-red-400 text-base" />
            </button>
          )}
        </div>
        {plan.date && (
          <div className="flex items-center gap-1.5 text-[12px] text-[#aaa] mb-1">
            <i className="ti ti-calendar text-[13px]" />
            {new Date(plan.date).toLocaleDateString('en-AE', { weekday:'short', day:'numeric', month:'short' })}
            {plan.time && ` · ${plan.time}`}
            {plan.location && ` · ${plan.location}`}
          </div>
        )}
        {plan.profiles && (
          <div className="flex items-center gap-1.5 text-[12px] text-[#aaa]">
            <i className="ti ti-user text-[13px]" />
            Planned by <span className="text-primary font-bold ml-0.5">{plan.profiles.display_name}</span>
          </div>
        )}
      </div>

      <div className="scroll-area relative z-10">
        {/* RSVP */}
        <SectionHeader>Your RSVP</SectionHeader>
        <div className="grid grid-cols-3 gap-2 px-5 mb-4">
          {RSVP_OPTIONS.map(opt => {
            const isActive = myRsvp === opt.key
            return (
              <motion.button
                key={opt.key}
                type="button"
                onClick={() => setRsvpStatus(opt.key)}
                whileHover={{
                  y: -1,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                  transition: { duration: 0.15 },
                }}
                whileTap={{
                  scale: 0.94,
                  y: 2,
                  boxShadow: '0 0px 4px rgba(0,0,0,0.06)',
                  transition: { duration: 0.1, ease: 'easeIn' },
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                style={{
                  ...RSVP_BASE_STYLE,
                  ...(isActive ? opt.active : RSVP_DEFAULT_STYLE),
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 4 }}>{opt.emoji}</div>
                <div className="font-display font-extrabold text-[12px] text-ink">{opt.label}</div>
                <div className="text-[10px] text-[#aaa] mt-0.5">{opt.sub}</div>
              </motion.button>
            )
          })}
        </div>

        <Divider />

        {/* Attendees */}
        <SectionHeader>The crew</SectionHeader>
        {rsvps.map((r, i) => {
          const noReply = !r.status
          const showNudge = isOrganiser && noReply
          const ago = nudgedAgo(r.user_id)
          const cooldownOk = canNudge(r.user_id)
          const isCurrentlyNudging = nudging === r.user_id
          return (
            <motion.div
              key={r.user_id}
              initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay: i*0.04 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 20px',
                borderBottom: '1px solid rgba(0,0,0,0.04)',
              }}
            >
              <EmojiAvatar emoji={r.profiles?.emoji} size="sm" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
                  {r.profiles?.display_name}
                </div>
                {ago && (
                  <div style={{ fontSize: 10, color: '#aaa', marginTop: 1 }}>
                    Nudged {ago}
                  </div>
                )}
              </div>
              {r.status
                ? <Pill variant={RSVP_PILL[r.status]}>{RSVP_LABEL[r.status]}</Pill>
                : <Pill variant="neutral">No reply</Pill>
              }
              {showNudge && (
                <button
                  onClick={() => cooldownOk && nudgeMember(r.user_id)}
                  disabled={!cooldownOk || isCurrentlyNudging}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    background: cooldownOk ? '#FFF0F8' : '#f5f5f5',
                    border: 'none', borderRadius: 999,
                    padding: '5px 10px',
                    cursor: cooldownOk ? 'pointer' : 'default',
                    opacity: isCurrentlyNudging ? 0.6 : 1,
                  }}
                  aria-label={`Nudge ${r.profiles?.display_name}`}
                >
                  <span style={{ fontSize: 12 }}>🫷</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: cooldownOk ? '#C2185B' : '#aaa',
                    fontFamily: 'Inter, sans-serif',
                  }}>
                    {isCurrentlyNudging ? 'Nudging…' : cooldownOk ? 'Nudge' : 'Nudged'}
                  </span>
                </button>
              )}
            </motion.div>
          )
        })}

        {isOrganiser && (
          <>
            <Divider />
            <SectionHeader>Invite requests</SectionHeader>
            {inviteRequests.length === 0 ? (
              <div className="mx-5 mb-4 rounded-[16px] bg-white/70 border border-black/[0.06] px-4 py-3">
                <div className="font-semibold text-[13px] text-ink">No pending requests</div>
                <div className="text-[11px] text-[#aaa] mt-1">Requests from shared event links will appear here.</div>
              </div>
            ) : inviteRequests.map(req => {
              const status = req.status || 'pending'
              return (
                <div key={req.id} className="mx-5 mb-2 rounded-[16px] bg-white/75 border border-black/[0.06] px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <EmojiAvatar emoji={req.requester?.emoji} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-ink">{req.requester?.display_name || 'Friend'}</div>
                      <div className="text-[11px] text-[#aaa] mt-0.5">Wants to be invited to this event</div>
                    </div>
                    <Pill variant={status === 'approved' ? 'mint' : status === 'rejected' ? 'red' : 'yellow'}>
                      {status === 'approved' ? 'Invited' : status === 'rejected' ? 'Rejected' : 'Pending'}
                    </Pill>
                  </div>
                  {status === 'pending' && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button
                        onClick={() => decideInviteRequest(req, 'approved')}
                        disabled={requestBusy}
                        className="py-2.5 rounded-full bg-[#DCFCE7] text-[#166534] text-[12px] font-bold disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => decideInviteRequest(req, 'rejected')}
                        disabled={requestBusy}
                        className="py-2.5 rounded-full bg-red-50 text-red-600 text-[12px] font-bold disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
            {requestError && <p className="text-red-500 text-xs mx-5 mb-3">{requestError}</p>}
          </>
        )}

        {/* Moments */}
        <Divider />
        <div className="flex items-center px-5 mt-3 mb-3">
          <span className="text-[10px] font-bold tracking-widest uppercase text-[#bbb]">Moments</span>
        </div>

        {posts.length === 0 && !uploading && (
          <div style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
            <div style={{
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontWeight: 800, fontSize: 15,
              color: '#111', marginBottom: 4,
            }}>
              No moments yet
            </div>
            <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>
              Be the first to add a photo or comment
            </p>
          </div>
        )}

        {uploading && (
          <div className="mx-5 mb-3 rounded-[14px] bg-gray-100 aspect-square flex items-center justify-center">
            <i className="ti ti-loader-2 animate-spin text-[#aaa] text-2xl" />
          </div>
        )}

        {posts.map(post => {
          const isOwn = currentUserId && post.user_id === currentUserId
          const isConfirmingDelete = confirmingDeleteId === post.id
          const grouped = groupReactionsByEmoji(post.reactions)
          const myReaction = post.reactions?.find(r => r.user_id === currentUserId)
          const photos = [post.image_url, post.image_url2, post.image_url3, post.image_url4].filter(Boolean)

          if (isConfirmingDelete) {
            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="mx-5 mb-2 rounded-[14px] bg-red-50 border border-red-100 px-4 py-3 flex items-center justify-between gap-3"
              >
                <span className="text-[13px] font-semibold text-red-600 flex-1">
                  Delete this {post.type === 'photo' ? 'photo' : 'comment'}?
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => performDeletePost(post)}
                    className="text-[12px] font-bold text-red-600 px-3 py-1.5 rounded-full bg-white"
                  >
                    Yes, delete
                  </button>
                  <button
                    onClick={() => setConfirmingDeleteId(null)}
                    className="text-[12px] font-semibold text-[#aaa] px-3 py-1.5"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )
          }

          // Shared header for both photo + comment posts
          const header = (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', background: '#f0f0f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, flexShrink: 0,
              }}>
                {post.profiles?.emoji || '😎'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
                  {post.profiles?.display_name || 'Friend'}
                </span>
                <span style={{ fontSize: 11, color: '#bbb', marginLeft: 6 }}>
                  · {formatTimeAgo(post.created_at)}
                </span>
              </div>
              {isOwn && (
                <i
                  className="ti ti-dots"
                  style={{ fontSize: 16, color: '#ccc', cursor: 'pointer' }}
                  onClick={() => setActionSheetPost(post)}
                />
              )}
            </div>
          )

          // Reactions bar (used after photo grid OR speech bubble)
          const reactionsBar = (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, position: 'relative' }}>
              {grouped.map(([emoji, count]) => {
                const isMine = myReaction?.emoji === emoji
                return (
                  <div
                    key={emoji}
                    onClick={() => toggleReaction(post.id, emoji)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      background: isMine ? '#FEF3C7' : 'rgba(255,255,255,0.8)',
                      border: `1px solid ${isMine ? '#FB923C' : 'rgba(0,0,0,0.08)'}`,
                      borderRadius: 999, padding: '3px 8px', cursor: 'pointer', fontSize: 12,
                    }}
                  >
                    {emoji}
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>{count}</span>
                  </div>
                )
              })}
              <div
                onClick={() => setReactionPickerPostId(reactionPickerPostId === post.id ? null : post.id)}
                style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, cursor: 'pointer', color: '#888',
                }}
              >
                +
              </div>
              <AnimatePresence>
                {reactionPickerPostId === post.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    style={{
                      position: 'absolute', bottom: '100%', left: 0, marginBottom: 6,
                      background: '#fff', borderRadius: 999, padding: '6px 10px',
                      border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      display: 'flex', alignItems: 'center', gap: 4, zIndex: 20,
                    }}
                  >
                    {REACTION_OPTIONS.map(e => (
                      <button
                        key={e}
                        onClick={() => toggleReaction(post.id, e)}
                        style={{
                          fontSize: 20, lineHeight: 1, width: 28, height: 28,
                          border: 'none', background: 'transparent', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: '50%',
                        }}
                      >
                        {e}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )

          if (post.type === 'photo') {
            return (
              <div key={post.id} style={{ padding: '0 20px', marginBottom: 20 }}>
                {header}
                {photos.length === 1 && (
                  <div
                    onClick={() => openLightbox(post, 0)}
                    style={{
                      width: '100%', height: 180, borderRadius: 14,
                      overflow: 'hidden', cursor: 'pointer', position: 'relative',
                    }}
                  >
                    <img src={photos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{
                      position: 'absolute', bottom: 8, right: 8,
                      background: 'rgba(0,0,0,0.4)', borderRadius: 6,
                      padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <i className="ti ti-arrows-maximize" style={{ fontSize: 9, color: '#fff' }} />
                      <span style={{ fontSize: 9, fontWeight: 600, color: '#fff' }}>View full</span>
                    </div>
                  </div>
                )}
                {photos.length === 2 && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {photos.map((url, i) => (
                      <div
                        key={i}
                        onClick={() => openLightbox(post, i)}
                        style={{ flex: 1, height: 130, borderRadius: 14, overflow: 'hidden', cursor: 'pointer' }}
                      >
                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
                {photos.length >= 3 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto', gap: 6 }}>
                    <div
                      onClick={() => openLightbox(post, 0)}
                      style={{ gridColumn: '1/2', gridRow: '1/3', aspectRatio: '1', borderRadius: 14, overflow: 'hidden', cursor: 'pointer' }}
                    >
                      <img src={photos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div
                      onClick={() => openLightbox(post, 1)}
                      style={{ aspectRatio: '1', borderRadius: 14, overflow: 'hidden', cursor: 'pointer' }}
                    >
                      <img src={photos[1]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div
                      onClick={() => openLightbox(post, 2)}
                      style={{ aspectRatio: '1', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', position: 'relative', background: '#111' }}
                    >
                      {photos[2] && (
                        <img
                          src={photos[2]}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: photos.length > 3 ? 0.4 : 1 }}
                        />
                      )}
                      {photos.length > 3 && (
                        <div style={{
                          position: 'absolute', inset: 0, display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          fontSize: 16, fontWeight: 700, color: '#fff',
                          fontFamily: '"Plus Jakarta Sans", sans-serif',
                        }}>
                          +{photos.length - 2}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {post.caption && (
                  <p style={{ fontSize: 13, color: '#111', lineHeight: 1.5, margin: '6px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {post.caption}
                  </p>
                )}
                {reactionsBar}
              </div>
            )
          }

          // Comment — speech bubble
          return (
            <div key={post.id} style={{ padding: '0 20px', marginBottom: 16 }}>
              {header}
              <div style={{
                background: 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: '0 14px 14px 14px',
                padding: '10px 12px',
                display: 'inline-block',
                maxWidth: '100%',
              }}>
                <p style={{
                  fontSize: 13, color: '#111', lineHeight: 1.5, margin: 0,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {post.content}
                </p>
              </div>
              {reactionsBar}
            </div>
          )
        })}

        {/* Close event (organiser only) */}
        {plan.status === 'open' && isOrganiser && (
          <>
            <Divider />
            <div className="px-5 py-4">
              <p className="text-[11px] text-[#aaa] mb-3">Mark who actually came — scores update automatically.</p>
              {rsvps.map(r => (
                <div key={r.user_id} className="flex items-center gap-2.5 py-2 border-b border-black/[0.04]">
                  <EmojiAvatar emoji={r.profiles?.emoji} size="sm" />
                  <span className="flex-1 text-[13px] font-semibold text-ink">{r.profiles?.display_name}</span>
                  <button
                    onClick={() => setAttendance(p => ({...p, [r.user_id]: !p[r.user_id]}))}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${attendance[r.user_id] ? 'bg-mint border-mint' : 'border-[#ddd]'}`}
                  >
                    {attendance[r.user_id] && <i className="ti ti-check text-white text-xs" />}
                  </button>
                </div>
              ))}
              <button
                onClick={closeEvent}
                disabled={closing}
                className="w-full py-4 bg-ink text-white rounded-full font-display font-black text-base mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <i className="ti ti-check text-lg" />
                {closing ? 'Closing…' : 'Close event & record attendance'}
              </button>
            </div>
          </>
        )}

        {plan.status === 'closed' && (
          <div className="mx-5 mt-4 bg-[#DCFCE7] rounded-[18px] p-4 flex items-center gap-3">
            <div className="text-2xl">✅</div>
            <div>
              <div className="font-display font-extrabold text-[14px] text-[#166534]">Plan closed</div>
              <div className="text-[11px] text-[#166534]/70 mt-0.5">Attendance recorded · scores updated</div>
            </div>
          </div>
        )}

        {/* Extra clearance so the last post isn't hidden behind the fixed
            comment input row (~80px) + mobile nav (~88px). On desktop the
            sidebar nav means only the comment row eats space (~80px). */}
        <div className="h-[160px] md:h-[80px]" />
      </div>

      {/* Unified composer — text + optional photo. Pinned to viewport bottom,
          above the mobile nav bar (or flush to bottom on desktop where the
          nav is a left sidebar). One file input shared between collapsed and
          expanded camera buttons via fileInputRef. */}
      <div
        ref={composerRef}
        className="fixed bottom-[calc(68px_+_max(8px,_env(safe-area-inset-bottom)))] md:bottom-0 left-0 right-0 md:left-[220px] z-40 px-4 py-3 bg-[rgba(255,251,245,0.95)] backdrop-blur"
      >
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handlePhotoSelect}
          style={{ display: 'none' }}
        />
        <div className="max-w-[680px] mx-auto">
          {editingPost && (
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] text-primary font-semibold">Editing…</span>
              <button onClick={cancelEditing} className="text-[#aaa] -mr-1 p-1" aria-label="Cancel editing">
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          )}

          {!composerExpanded && !composerPhoto && !editingPost ? (
            // Collapsed state
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 20, background: '#fff',
                cursor: 'text',
              }}
              onClick={() => {
                setComposerExpanded(true)
                setTimeout(() => composerTextRef.current?.focus(), 50)
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: '50%', background: '#f0f0f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, flexShrink: 0,
              }}>
                {profile?.emoji || '😎'}
              </div>
              <span style={{ flex: 1, fontSize: 13, color: '#ccc', fontFamily: 'Inter, sans-serif' }}>
                Add a moment…
              </span>
              <div
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
                style={{
                  width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
                aria-label="Attach photo"
              >
                <i className="ti ti-camera" style={{ fontSize: 14, color: '#888' }} />
              </div>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: '#e5e7eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className="ti ti-arrow-up" style={{ fontSize: 13, color: '#aaa' }} />
              </div>
            </div>
          ) : (
            // Expanded state
            <div style={{
              border: `1px solid ${composerPhoto || composerText ? '#FB923C' : 'rgba(0,0,0,0.1)'}`,
              borderRadius: 20, background: '#fff', overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px 8px' }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', background: '#f0f0f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 17, flexShrink: 0, marginTop: 2,
                }}>
                  {profile?.emoji || '😎'}
                </div>

                {composerPhoto && (
                  <div style={{
                    position: 'relative', width: 72, height: 72, borderRadius: 10,
                    overflow: 'hidden', flexShrink: 0,
                  }}>
                    <img src={composerPhoto.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      onClick={removePhoto}
                      aria-label="Remove photo"
                      style={{
                        position: 'absolute', top: 3, right: 3, width: 16, height: 16,
                        borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <i className="ti ti-x" style={{ fontSize: 9, color: '#fff' }} />
                    </button>
                  </div>
                )}

                <textarea
                  ref={composerTextRef}
                  autoFocus={composerExpanded && !composerPhoto && !editingPost}
                  value={composerText}
                  onChange={e => setComposerText(e.target.value)}
                  placeholder={composerPhoto ? 'Add a caption… (optional)' : 'Add a moment…'}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitPost() } }}
                  rows={composerPhoto ? 3 : 2}
                  style={{
                    flex: 1, border: 'none', outline: 'none', fontSize: 13,
                    fontFamily: 'Inter, sans-serif', color: '#111', resize: 'none',
                    background: 'transparent', lineHeight: 1.5, minHeight: 40, paddingTop: 2,
                  }}
                />
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 12px 10px', borderTop: '1px solid rgba(0,0,0,0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.04)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    }}
                    aria-label="Attach photo"
                  >
                    <i className="ti ti-camera" style={{ fontSize: 14, color: '#888' }} />
                  </div>
                  {composerPhoto && (
                    <span style={{ fontSize: 10, color: '#aaa' }}>1 photo</span>
                  )}
                </div>
                <button
                  onClick={submitPost}
                  disabled={uploading || (!composerText.trim() && !composerPhoto)}
                  aria-label={editingPost ? 'Save edit' : 'Send post'}
                  style={{
                    width: 30, height: 30, borderRadius: '50%', border: 'none',
                    background: (composerText.trim() || composerPhoto) ? '#111' : '#e5e7eb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: (composerText.trim() || composerPhoto) ? 'pointer' : 'default',
                    padding: 0,
                  }}
                >
                  <i
                    className={`ti ${uploading ? 'ti-loader-2 animate-spin' : 'ti-arrow-up'}`}
                    style={{ fontSize: 14, color: (composerText.trim() || composerPhoto) ? '#fff' : '#aaa' }}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {shareOpen && (
          <motion.div
            key="share-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShareOpen(false)}
            className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end"
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#FFFBF5] w-full rounded-t-[32px] px-5 pb-6"
            >
              <div className="flex justify-center pt-3 pb-1"><div className="w-8 h-1 rounded-full bg-black/10" /></div>
              <div className="font-display font-black text-[24px] text-ink pt-3">Share event</div>
              <p className="text-[13px] text-[#888] leading-relaxed mt-2 mb-4">
                Send a member-only link. It won't add anyone or RSVP for them.
              </p>
              <div className="bg-white/80 border border-black/[0.06] rounded-[18px] p-4 mb-4">
                <div className="font-display font-extrabold text-[15px] text-ink mb-2">{plan.name}</div>
                <p className="text-[12px] text-[#888] whitespace-pre-line leading-relaxed m-0">{getEventShareText()}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={shareToWhatsApp} className="py-3.5 rounded-full bg-ink text-white text-[13px] font-display font-black">WhatsApp</button>
                <button onClick={shareNative} className="py-3.5 rounded-full bg-white border border-black/10 text-ink text-[13px] font-semibold">Native share</button>
                <button onClick={copyEventLink} className="py-3.5 rounded-full bg-white border border-black/10 text-ink text-[13px] font-semibold col-span-2">Copy link</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <NavBar active="plans" navigate={navigate} />

      {/* Success toast (edit) */}
      <AnimatePresence>
        {toastVisible && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: [1, 1, 0], y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, times: [0, 0.7, 1] }}
            className="absolute bottom-[88px] left-1/2 -translate-x-1/2 bg-ink text-white px-4 py-2 rounded-full text-[12px] font-semibold z-40 shadow-lg whitespace-nowrap"
          >
            Changes saved ✓
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {noticeMessage && (
          <motion.div
            key="notice-toast"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute bottom-[88px] left-1/2 -translate-x-1/2 bg-ink text-white px-4 py-2 rounded-full text-[12px] font-semibold z-40 shadow-lg whitespace-nowrap"
          >
            {noticeMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deleted toast */}
      <AnimatePresence>
        {deletedToastVisible && (
          <motion.div
            key="deleted-toast"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: [1, 1, 0], y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, times: [0, 0.7, 1] }}
            className="absolute bottom-[88px] left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-full text-[12px] font-semibold z-40 shadow-lg whitespace-nowrap"
          >
            Plan deleted
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photo lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)',
              zIndex: 1000, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setLightbox(null) }}
              aria-label="Close lightbox"
              style={{
                position: 'absolute', top: 20, right: 20,
                background: 'rgba(255,255,255,0.1)', border: 'none',
                borderRadius: '50%', width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <i className="ti ti-x" style={{ fontSize: 18, color: '#fff' }} />
            </button>
            <img
              src={lightbox.photos[lightbox.index]}
              alt=""
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '100%', maxHeight: '85vh',
                objectFit: 'contain', borderRadius: 12,
              }}
            />
            {lightbox.photos.length > 1 && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ display: 'flex', gap: 6, marginTop: 16 }}
              >
                {lightbox.photos.map((_, i) => (
                  <div
                    key={i}
                    onClick={() => setLightbox(p => p ? { ...p, index: i } : p)}
                    style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: i === lightbox.index ? '#fff' : 'rgba(255,255,255,0.3)',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post action sheet — Edit/Delete for own comments, Delete-only for own photos */}
      <AnimatePresence>
        {actionSheetPost && (
          <motion.div
            key="post-action-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setActionSheetPost(null)}
            className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end"
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#FFFBF5] w-full rounded-t-[32px] pb-6"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-8 h-1 rounded-full bg-black/10" />
              </div>
              <div className="px-2 pt-2">
                {actionSheetPost.type === 'comment' && (
                  <button
                    onClick={() => startEditing(actionSheetPost)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl active:bg-black/[0.04]"
                  >
                    <div className="w-9 h-9 rounded-full bg-black/5 flex items-center justify-center">
                      <i className="ti ti-pencil text-ink text-base" />
                    </div>
                    <span className="text-[14px] font-semibold text-ink">Edit comment</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setConfirmingDeleteId(actionSheetPost.id)
                    setActionSheetPost(null)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl active:bg-red-50"
                >
                  <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center">
                    <i className="ti ti-trash text-red-400 text-base" />
                  </div>
                  <span className="text-[14px] font-semibold text-red-500">
                    {actionSheetPost.type === 'photo' ? 'Delete photo' : 'Delete'}
                  </span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation sheet */}
      <AnimatePresence>
        {deleteOpen && (
          <motion.div
            key="delete-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => !deleting && setDeleteOpen(false)}
            className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end"
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#FFFBF5] w-full rounded-t-[32px] flex flex-col px-5 pb-6"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-8 h-1 rounded-full bg-black/10" />
              </div>

              <div className="flex flex-col items-center text-center pt-4">
                <div className="text-[48px] leading-none mb-3">🗑️</div>
                <div className="font-display font-black text-[24px] text-ink mb-2">Delete this plan?</div>
                <p className="text-[13px] text-[#aaa] leading-[1.6] mb-6">
                  This removes the plan for everyone in the group. This cannot be undone.
                </p>
                <span className="bg-gray-100 text-ink font-bold text-[13px] px-4 py-2 rounded-full mb-6 max-w-full truncate">
                  {plan.name}
                </span>
                {deleteError && (
                  <p className="text-red-500 text-xs mb-3">{deleteError}</p>
                )}
                <button
                  onClick={deletePlan}
                  disabled={deleting}
                  className="bg-red-500 text-white rounded-full py-4 w-full font-display font-black text-base disabled:opacity-50 mb-2.5"
                >
                  {deleting ? 'Deleting…' : 'Yes, delete it'}
                </button>
                <button
                  onClick={() => setDeleteOpen(false)}
                  disabled={deleting}
                  className="bg-transparent text-[#aaa] border border-black/10 rounded-full py-3.5 w-full text-[13px] font-semibold disabled:opacity-50"
                >
                  Keep it
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit sheet */}
      <AnimatePresence>
        {editOpen && (
          <motion.div
            key="edit-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => !saving && setEditOpen(false)}
            className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end"
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#FFFBF5] w-full rounded-t-[32px] max-h-[88%] flex flex-col"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-8 h-1 rounded-full bg-black/10" />
              </div>

              {/* Header */}
              <div className="px-5 pt-2 pb-3 flex items-center justify-between flex-shrink-0">
                <div className="font-display font-black text-[24px] text-ink">Edit plan.</div>
                <button
                  onClick={() => !saving && setEditOpen(false)}
                  disabled={saving}
                  aria-label="Close"
                  className="w-9 h-9 rounded-full bg-black/5 flex items-center justify-center disabled:opacity-50"
                >
                  <X size={16} strokeWidth={2.5} className="text-ink" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-5 pb-3">
                {editLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="text-3xl animate-spin">⚡</div>
                  </div>
                ) : (
                  <>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#aaa] mb-1.5 block">Plan name</label>
                    <input
                      className="w-full px-4 py-3.5 rounded-2xl border border-black/10 bg-white/80 text-ink text-[14px] outline-none focus:border-primary mb-3"
                      type="text"
                      value={editForm.name}
                      onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                    />

                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#aaa] mb-1.5 block">Date</label>
                    <input
                      className="w-full px-4 py-3.5 rounded-2xl border border-black/10 bg-white/80 text-ink text-[14px] outline-none focus:border-primary mb-3"
                      type="date"
                      value={editForm.date || ''}
                      onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))}
                    />

                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#aaa] mb-1.5 block">Time</label>
                    <input
                      className="w-full px-4 py-3.5 rounded-2xl border border-black/10 bg-white/80 text-ink text-[14px] outline-none focus:border-primary mb-3"
                      type="time"
                      value={editForm.time || ''}
                      onChange={e => setEditForm(p => ({ ...p, time: e.target.value }))}
                    />

                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#aaa] mb-1.5 block">Location</label>
                    <input
                      className="w-full px-4 py-3.5 rounded-2xl border border-black/10 bg-white/80 text-ink text-[14px] outline-none focus:border-primary mb-3"
                      type="text"
                      placeholder="Venue or area"
                      value={editForm.location || ''}
                      onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))}
                    />

                    {plan.tier === 1 && (
                      <>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#aaa] mb-1.5 block">Notes / booking ref</label>
                        <input
                          className="w-full px-4 py-3.5 rounded-2xl border border-black/10 bg-white/80 text-ink text-[14px] outline-none focus:border-primary mb-3"
                          type="text"
                          placeholder="Optional"
                          value={editForm.notes || ''}
                          onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                        />
                      </>
                    )}

                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#aaa] mt-2 mb-2 block">Crew</label>
                    <div className="mb-2">
                      {editMembers.map(m => {
                        const isInvited = invited.has(m.id)
                        return (
                          <div key={m.id} className="flex items-center gap-2.5 py-2 border-b border-black/[0.04]">
                            <EmojiAvatar emoji={m.emoji} size="sm" />
                            <span className="flex-1 text-[13px] font-semibold text-ink flex items-center gap-1.5">
                              {m.name}
                              {m.isMe && <span className="text-[10px] font-normal text-[#aaa]">(you)</span>}
                            </span>
                            {m.isMe ? (
                              <div
                                aria-label="You can't remove yourself"
                                className="w-7 h-7 rounded-full bg-black/[0.05] border-2 border-[#ddd] flex items-center justify-center"
                              >
                                <i className="ti ti-lock text-[#aaa] text-xs" />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleInvite(m.id, m.isMe)}
                                aria-label={isInvited ? `Remove ${m.name}` : `Invite ${m.name}`}
                                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${isInvited ? 'bg-mint border-mint' : 'border-[#ddd]'}`}
                              >
                                {isInvited && <i className="ti ti-check text-white text-xs" />}
                              </button>
                            )}
                          </div>
                        )
                      })}
                      {editMembers.length === 0 && (
                        <p className="text-[12px] text-[#aaa] text-center py-3">No crew members found.</p>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Save footer */}
              <div className="px-5 pt-3 pb-5 border-t border-black/[0.04] flex-shrink-0">
                {saveError && <p className="text-red-500 text-xs mb-2 text-center">{saveError}</p>}
                <button
                  onClick={saveEdits}
                  disabled={saving || editLoading}
                  className="w-full py-4 bg-ink text-white rounded-full font-display font-black text-base disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
