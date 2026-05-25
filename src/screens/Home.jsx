import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { NavBar, TopBar, EmojiAvatar, Pill, SectionHeader } from '../components/UI'

const TIER_PILL = { 1: 'tier1', 2: 'tier2', 3: 'tier3' }
const TIER_LABEL = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' }

// Urgency score: pending RSVPs float to top, then tier (lower = more important),
// then sooner date wins.
function getPriorityScore(plan) {
  let score = 0
  if (!plan.my_rsvp) score += 1000
  score += (4 - (plan.tier || 3)) * 100
  const days = (new Date(plan.date).getTime() - Date.now()) / 86400000
  score -= days
  return score
}

function PlanCard({ plan, onPress, index }) {
  const isPending = !plan.my_rsvp
  // A nudge only counts as "active" while the user hasn't replied. Once they
  // RSVP, the card goes back to default styling — the nudge did its job and
  // dragging extra pink attention to a replied event is just noise.
  const activeNudge = isPending && !!plan.nudge

  const cardBorder = activeNudge
    ? '1.5px solid #FF6EB4'
    : isPending
      ? '1.5px solid #FB923C'
      : '1px solid rgba(0,0,0,0.06)'
  const ctaColor = activeNudge ? '#FF6EB4' : '#FB923C'

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, x: 0 }}
      // Standard fade-up for everyone. Active-nudge cards also get a gentle
      // one-shot horizontal shake (no loop) to draw the eye, slightly after
      // the fade settles so it isn't lost in the motion.
      animate={{
        opacity: 1,
        y: 0,
        x: activeNudge ? [0, -4, 4, -3, 3, 0] : 0,
      }}
      transition={{
        opacity: { delay: index * 0.06, duration: 0.3 },
        y: { delay: index * 0.06, duration: 0.3 },
        x: activeNudge
          ? { delay: 0.3 + index * 0.06, duration: 0.4, ease: 'easeInOut' }
          : { duration: 0 },
      }}
      onClick={() => onPress(plan)}
      style={{ border: cardBorder }}
      className="glass-card mx-5 mb-2.5 p-3.5 cursor-pointer active:scale-[0.99] transition-transform"
    >
      {/* Bubblegum nudge strip — only while the nudge is still active.
          Radius matches .glass-card's 20px so the strip's top corners sit
          flush with the card's; otherwise the pink border peeks above. */}
      {activeNudge && (
        <div style={{
          background: '#FFF0F8',
          borderRadius: '20px 20px 0 0',
          padding: '6px 14px',
          margin: '-14px -14px 10px',
          display: 'flex', alignItems: 'center', gap: 5,
          borderBottom: '1px solid rgba(255,110,180,0.15)',
        }}>
          <span style={{ fontSize: 13 }}>👈</span>
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: '#C2185B', fontFamily: 'Inter, sans-serif',
          }}>
            {plan.nudge.nudger?.display_name} poked you — are you in or not? 👀
          </span>
        </div>
      )}

      {isPending && !activeNudge && (
        <div className="flex items-center gap-1 text-primary text-[11px] font-bold mb-1.5">
          <i className="ti ti-circle-dot text-xs" /> Waiting for your reply
        </div>
      )}
      <div className="flex items-start justify-between mb-1.5">
        <div className="font-display font-extrabold text-base text-ink leading-tight">{plan.name}</div>
        <Pill variant={TIER_PILL[plan.tier]}>{TIER_LABEL[plan.tier]}</Pill>
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
          ? <span style={{ fontSize: 11, fontWeight: 700, color: ctaColor }}>Reply now</span>
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

  const displayPlans = useMemo(() => {
    const copy = [...plans]
    if (sortMode === 'time') {
      return copy.sort((a, b) => new Date(a.date) - new Date(b.date))
    }
    if (sortMode === 'tier') {
      return copy.sort((a, b) =>
        a.tier !== b.tier ? a.tier - b.tier : new Date(a.date) - new Date(b.date)
      )
    }
    return copy.sort((a, b) => getPriorityScore(b) - getPriorityScore(a))
  }, [plans, sortMode])

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

    if (upcomingData) {
      // Look up any nudges *targeting* the current user across the upcoming plans
      // so we can highlight the pending cards organisers have poked us about.
      let incomingNudges = []
      if (upcomingData.length > 0) {
        const { data } = await supabase
          .from('nudges')
          .select('*, nudger:nudger_id(display_name, emoji)')
          .eq('nudgee_id', user.id)
          .in('plan_id', upcomingData.map(p => p.id))
        incomingNudges = data || []
      }

      const enriched = upcomingData.map(p => {
        const confirmed = p.rsvps.filter(r => r.status === 'in')
        const likely = p.rsvps.filter(r => r.status === 'likely')
        const mine = p.rsvps.find(r => r.user_id === user.id)
        const nudge = incomingNudges.find(n => n.plan_id === p.id) || null
        return {
          ...p,
          confirmed_count: confirmed.length,
          likely_count: likely.length,
          my_rsvp: mine?.status,
          is_organiser: p.organiser_id === user.id,
          rsvp_faces: confirmed.map(r => r.profiles?.emoji).filter(Boolean),
          nudge,
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

  const day = new Date().toLocaleDateString('en-AE', { weekday: 'long' })
  const firstName = profile?.display_name?.split(' ')[0] || 'there'

  return (
    <div className="phone-shell">
      <TopBar navigate={navigate} />
      <div className="orb" style={{ width:200, height:200, background:'#FDE68A', top:-50, right:-50, opacity:0.45 }} />
      <div className="orb" style={{ width:140, height:140, background:'#BAE6FD', top:200, left:-40, opacity:0.35 }} />

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="px-5 pt-4 pb-3 relative z-10"
      >
        <div className="text-[9px] text-[#bbb] font-medium uppercase tracking-wider mb-1">{day} · Dubai</div>
        <div className="flex items-center justify-between gap-3">
          <div
            className="min-w-0 truncate"
            style={{
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: 22,
              fontWeight: 700,
              fontStyle: 'normal',
              letterSpacing: '-0.4px',
              color: '#111',
              lineHeight: 1.15,
            }}
          >
            Hey {firstName} {profile?.emoji || '👋'}
          </div>
          {group && (
            <motion.div
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('crew')}
              className="flex-shrink-0"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(255,255,255,0.72)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: 999,
                padding: '5px 10px 5px 6px',
                cursor: 'pointer',
              }}
              aria-label={`${group.name} crew · ${group.avg_attendance ?? '—'}% attendance`}
            >
              {/* Overlapping emoji faces — first 4 members */}
              <div style={{ display: 'flex' }}>
                {(group.member_emojis || []).slice(0, 4).map((e, i) => (
                  <div
                    key={i}
                    style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: '#f0f0f0', border: '1.5px solid #FFFBF5',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, marginRight: -5, zIndex: 4 - i,
                    }}
                  >
                    {e}
                  </div>
                ))}
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#555', marginLeft: 7 }}>
                {group.name}
              </span>
              <div style={{ width: 1, height: 12, background: 'rgba(0,0,0,0.1)', margin: '0 2px' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#34D399' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#34D399' }}>
                  {group.avg_attendance ? `${group.avg_attendance}%` : '—'}
                </span>
              </div>
              <i className="ti ti-chevron-right" style={{ fontSize: 10, color: '#ddd' }} />
            </motion.div>
          )}
        </div>
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
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  cursor: 'pointer', padding: '3px 0',
                }}
              >
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.09em',
                  textTransform: 'uppercase', color: '#bbb',
                }}>
                  Sort by: {sortMode === 'time' ? 'date' : sortMode === 'tier' ? 'tier' : 'urgency'}
                </span>
                <i className="ti ti-chevron-down" style={{ fontSize: 9, color: '#bbb' }} />
              </div>
            </div>

            {displayPlans.length === 0 ? (
              <div className="glass-card mx-5 mb-3 p-5 text-center">
                <div className="text-3xl mb-2">🎉</div>
                <p className="text-[13px] font-bold text-ink mb-1">No plans yet</p>
                <p className="text-[12px] text-[#aaa]">Use the + button in the nav bar to plan something.</p>
              </div>
            ) : (
              displayPlans.map((plan, i) => (
                <PlanCard key={plan.id} plan={plan} onPress={() => navigate('plan-detail', { planId: plan.id })} index={i} />
              ))
            )}

            {pastPlans.length > 0 && (
              <>
                <div className="h-px bg-black/[0.06] mx-5 my-4" />
                <SectionHeader>Last plans</SectionHeader>
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
          onClick={() => setShowSortSheet(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            // Anchor the sheet's bottom above the mobile nav (calc matches the
            // composer offset used elsewhere). On desktop the nav is a left
            // sidebar, so bottom: 0.
            className="absolute left-0 right-0 bottom-[calc(68px+max(8px,env(safe-area-inset-bottom)))] md:bottom-0"
            style={{
              maxWidth: 680, margin: '0 auto',
              background: '#FFFBF5', borderRadius: '24px 24px 0 0',
              padding: '16px 20px 48px',
            }}
          >
            <div style={{
              width: 36, height: 4, borderRadius: 999,
              background: 'rgba(0,0,0,0.1)', margin: '0 auto 16px',
            }} />

            <div style={{
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 12,
            }}>
              Sort plans
            </div>

            {[
              { key: 'urgency', label: 'Urgency', sub: 'Reply needed first, then tier + time', emoji: '⚡' },
              { key: 'time',    label: 'Date',    sub: 'Soonest plans first',                  emoji: '🗓️' },
              { key: 'tier',    label: 'Tier',    sub: 'Most important plans first',           emoji: '🏆' },
            ].map(opt => (
              <div
                key={opt.key}
                onClick={() => { setSortMode(opt.key); setShowSortSheet(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 14px', borderRadius: 14, marginBottom: 6,
                  cursor: 'pointer',
                  background: sortMode === opt.key
                    ? 'rgba(251,146,60,0.08)'
                    : 'rgba(255,255,255,0.8)',
                  border: sortMode === opt.key
                    ? '1.5px solid rgba(251,146,60,0.3)'
                    : '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ fontSize: 20, flexShrink: 0 }}>{opt.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 2,
                  }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: '#aaa' }}>{opt.sub}</div>
                </div>
                {sortMode === opt.key && (
                  <i className="ti ti-check" style={{ fontSize: 16, color: '#FB923C' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
