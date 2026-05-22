import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { NavBar, TopBar, Pill } from '../components/UI'

const TIER_PILL = { 1: 'tier1', 2: 'tier2', 3: 'tier3' }
const TIER_LABEL = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' }
const SORT_LABELS = { urgency: 'Urgency', time: 'Time', tier: 'Tier' }

function getGreeting() {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return 'Morning'
  if (h >= 12 && h < 17) return 'Afternoon'
  if (h >= 17 && h < 21) return 'Evening'
  return 'Night'
}

function getTimeTag(dateStr) {
  const today    = new Date()
  const planDate = new Date(dateStr)
  const diff     = Math.ceil((planDate - today) / 86400000)

  if (diff <= 0)  return { label: 'Today',    bg: '#FEF3C7', color: '#92400E' }
  if (diff === 1) return { label: 'Tomorrow', bg: '#DCFCE7', color: '#166534' }
  if (diff <= 7)  return {
    label: planDate.toLocaleDateString('en-AE', { weekday: 'short' }),
    bg: '#DCFCE7', color: '#166534',
  }
  return {
    label: planDate.toLocaleDateString('en-AE', { day: 'numeric', month: 'short' }),
    bg: '#F3F4F6', color: '#aaa',
  }
}

function getTimeWeight(dateStr) {
  const today = new Date()
  const plan  = new Date(dateStr)
  const diff  = Math.ceil((plan - today) / 86400000)
  if (diff <= 0) return 4
  if (diff === 1) return 3
  if (diff <= 7)  return 2
  return 1
}

function getPriorityScore(plan) {
  const replyBoost = (!plan.my_rsvp && !plan.is_organiser) ? 1000 : 0
  const tierWeight = { 1: 3, 2: 2, 3: 1 }[plan.tier] || 1
  return replyBoost + tierWeight + getTimeWeight(plan.date)
}

function sortPlans(plans, mode) {
  const copy = [...plans]
  if (mode === 'time') {
    return copy.sort((a, b) => new Date(a.date) - new Date(b.date))
  }
  if (mode === 'tier') {
    return copy.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier
      return new Date(a.date) - new Date(b.date)
    })
  }
  // default: urgency
  return copy.sort((a, b) => getPriorityScore(b) - getPriorityScore(a))
}

function PlanCard({ plan, onPress, index }) {
  const isPending = !plan.my_rsvp
  const timeTag = getTimeTag(plan.date)
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      onClick={() => onPress(plan)}
      className={`glass-card mx-5 mb-2.5 p-3.5 cursor-pointer active:scale-[0.99] transition-transform ${isPending ? 'border-[1.5px] border-primary' : ''}`}
    >
      {isPending && (
        <div className="flex items-center gap-1 text-primary text-[11px] font-bold mb-1.5">
          <i className="ti ti-circle-dot text-xs" /> Waiting for your reply
        </div>
      )}
      <div className="flex items-start justify-between mb-1.5 gap-2">
        <div className="font-display font-extrabold text-base text-ink leading-tight min-w-0">{plan.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span style={{
            fontSize: 8, fontWeight: 600, padding: '2px 6px', borderRadius: 999,
            background: timeTag.bg, color: timeTag.color,
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {timeTag.label}
          </span>
          <Pill variant={TIER_PILL[plan.tier]}>{TIER_LABEL[plan.tier]}</Pill>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-[12px] text-[#aaa] mb-2">
        <i className="ti ti-calendar text-[13px]" />
        {new Date(plan.date).toLocaleDateString('en-AE', { weekday:'short', day:'numeric', month:'short' })} · {plan.time} · {plan.location}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex">
            {(plan.rsvp_faces || []).slice(0,3).map((e, i) => (
              <div key={i} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-sm border-2 border-base -mr-1.5">{e}</div>
            ))}
          </div>
          <span className="text-[11px] text-[#aaa] ml-3">
            {plan.confirmed_count} in{plan.likely_count > 0 ? ` · ${plan.likely_count} likely` : ''}
          </span>
        </div>
        {isPending
          ? <span className="text-[11px] font-bold text-primary">Reply now</span>
          : plan.is_organiser
            ? <span className="text-[10px] text-[#aaa]">You planned this</span>
            : null
        }
      </div>
    </motion.div>
  )
}

export default function Home({ navigate }) {
  const { profile } = useAuth()
  const [plans, setPlans] = useState([])
  const [pastPlans, setPastPlans] = useState([])
  const [activity, setActivity] = useState([])
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sortMode, setSortMode] = useState('urgency')
  const [showSortSheet, setShowSortSheet] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get user's group
    const { data: membership } = await supabase
      .from('group_members').select('group_id, groups(*)').eq('user_id', user.id).single()

    const groupId = membership?.group_id
    if (!groupId) { setLoading(false); return }

    // First 4 member emojis for the crew pill
    const { data: memberData } = await supabase
      .from('group_members')
      .select('profiles(emoji)')
      .eq('group_id', groupId)
      .limit(4)
    const memberEmojis = memberData?.map(m => m.profiles?.emoji).filter(Boolean) || []

    // Total member count for the +N overflow indicator
    const { count: memberCount } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)

    // Average attendance across all scored members in this group
    const { data: scoreData } = await supabase
      .from('member_scores')
      .select('attendance_rate')
      .eq('group_id', groupId)
    const rates = scoreData?.map(s => s.attendance_rate).filter(Boolean) || []
    const avg = rates.length > 0
      ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length)
      : null

    setGroup({
      ...membership.groups,
      avg_attendance: avg,
      member_emojis: memberEmojis,
      member_count: memberCount || memberEmojis.length,
    })

    // Upcoming plans
    const { data: upcomingData } = await supabase
      .from('plans')
      .select(`*, rsvps(user_id, status, profiles(emoji, display_name))`)
      .eq('group_id', groupId)
      .eq('status', 'open')
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: true })
      .limit(5)

    if (upcomingData) {
      const enriched = upcomingData.map(p => {
        const confirmed = p.rsvps.filter(r => r.status === 'in')
        const likely = p.rsvps.filter(r => r.status === 'likely')
        const mine = p.rsvps.find(r => r.user_id === user.id)
        return {
          ...p,
          confirmed_count: confirmed.length,
          likely_count: likely.length,
          my_rsvp: mine?.status,
          is_organiser: p.organiser_id === user.id,
          rsvp_faces: confirmed.map(r => r.profiles?.emoji).filter(Boolean),
        }
      })
      setPlans(enriched)
    }

    // Past plans
    const { data: past } = await supabase
      .from('plans').select('*')
      .eq('group_id', groupId).eq('status', 'closed')
      .order('date', { ascending: false }).limit(3)
    if (past) setPastPlans(past)

    setLoading(false)
  }

  const firstName = profile?.display_name?.split(' ')[0] || 'there'
  const pendingCount = plans.filter(p => !p.my_rsvp && !p.is_organiser).length
  const sortedPlans = sortPlans(plans, sortMode)

  return (
    <div className="phone-shell">
      <TopBar navigate={navigate} group={group} memberEmojis={group?.member_emojis || []} />
      <div className="orb" style={{ width:200, height:200, background:'#FDE68A', top:-50, right:-50, opacity:0.45 }} />
      <div className="orb" style={{ width:140, height:140, background:'#BAE6FD', top:200, left:-40, opacity:0.35 }} />

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ padding: '14px 20px 0', position: 'relative', zIndex: 1 }}
      >
        <div style={{
          fontSize: 9, color: '#bbb', fontWeight: 500,
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
        }}>
          {new Date().toLocaleDateString('en-AE', { weekday: 'long' })} · Dubai
        </div>
        <div style={{
          fontFamily: '"Plus Jakarta Sans", sans-serif',
          fontSize: 18, fontWeight: 700, color: '#111',
          letterSpacing: '-0.4px', lineHeight: 1, marginBottom: 3,
        }}>
          {getGreeting()}, {firstName} {profile?.emoji}
        </div>
        {pendingCount > 0 ? (
          <div style={{ fontSize: 11, color: '#FB923C', fontWeight: 600, marginBottom: 14 }}>
            {pendingCount} plan{pendingCount > 1 ? 's' : ''} need{pendingCount === 1 ? 's' : ''} your reply
          </div>
        ) : (
          <div style={{ marginBottom: 14 }} />
        )}
      </motion.div>

      <div className="scroll-area relative z-10">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-3xl animate-spin">⚡</div>
          </div>
        ) : (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 20px', marginBottom: 10, position: 'relative', zIndex: 1,
            }}>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.09em',
                textTransform: 'uppercase', color: '#bbb',
              }}>
                Coming up
              </span>

              <div
                onClick={() => setShowSortSheet(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'rgba(255,255,255,0.8)',
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 999, padding: '4px 10px',
                  cursor: 'pointer',
                }}
              >
                <i className="ti ti-arrows-sort" style={{ fontSize: 10, color: '#888' }} />
                <span style={{ fontSize: 9, fontWeight: 600, color: '#555' }}>Sort:</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#111' }}>
                  {SORT_LABELS[sortMode]}
                </span>
                <i className="ti ti-chevron-down" style={{ fontSize: 9, color: '#ccc' }} />
              </div>
            </div>

            {plans.length === 0 ? (
              <div className="glass-card mx-5 mb-3 p-5 text-center">
                <div className="text-3xl mb-2">🎉</div>
                <p className="text-[13px] font-bold text-ink mb-1">No plans yet</p>
                <p className="text-[12px] text-[#aaa]">Use the + button in the nav bar to plan something.</p>
              </div>
            ) : (
              sortedPlans.map((plan, i) => (
                <PlanCard key={plan.id} plan={plan} onPress={() => navigate('plan-detail', { planId: plan.id })} index={i} />
              ))
            )}

            {pastPlans.length > 0 && (
              <>
                <div className="h-px bg-black/[0.06] mx-5 my-4" />
                <div className="flex items-center justify-between px-5 mb-3">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-[#bbb]">Last plans</span>
                </div>
                {pastPlans.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay: 0.3 + i*0.05 }}
                    onClick={() => navigate('plan-detail', { planId: p.id })}
                    className="flex items-center justify-between px-5 py-2.5 border-b border-black/[0.04] cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-[#e5e7eb]" />
                      <div>
                        <div className="text-[13px] font-semibold text-[#555]">{p.name}</div>
                        <div className="text-[11px] text-[#aaa]">{new Date(p.date).toLocaleDateString('en-AE', { day:'numeric', month:'short' })}</div>
                      </div>
                    </div>
                    <Pill variant="mint">Closed</Pill>
                  </motion.div>
                ))}
              </>
            )}
            <div className="h-5" />
          </>
        )}
      </div>

      <NavBar active="home" navigate={navigate} />

      {showSortSheet && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowSortSheet(false)}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              maxWidth: 680, margin: '0 auto',
              background: '#FFFBF5', borderRadius: '24px 24px 0 0',
              padding: '16px 20px 40px',
            }}
          >
            <div style={{
              width: 36, height: 4, borderRadius: 999,
              background: 'rgba(0,0,0,0.1)', margin: '0 auto 16px',
            }} />
            <div style={{
              fontFamily: '"Plus Jakarta Sans",sans-serif',
              fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 16,
            }}>
              Sort plans
            </div>
            {[
              { key: 'urgency', label: 'Urgency', sub: 'Reply needed first, then tier + time' },
              { key: 'time',    label: 'Time',    sub: 'Soonest plans first' },
              { key: 'tier',    label: 'Tier',    sub: 'Most important plans first' },
            ].map(opt => (
              <div
                key={opt.key}
                onClick={() => { setSortMode(opt.key); setShowSortSheet(false) }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', borderRadius: 14, marginBottom: 6, cursor: 'pointer',
                  background: sortMode === opt.key ? '#FEF3C7' : 'rgba(255,255,255,0.8)',
                  border: sortMode === opt.key ? '1.5px solid #FB923C' : '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <div>
                  <div style={{
                    fontFamily: '"Plus Jakarta Sans",sans-serif',
                    fontSize: 14, fontWeight: 700, color: '#111',
                  }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{opt.sub}</div>
                </div>
                {sortMode === opt.key && (
                  <i className="ti ti-check" style={{ fontSize: 16, color: '#FB923C' }} />
                )}
              </div>
            ))}
          </motion.div>
        </div>
      )}
    </div>
  )
}
