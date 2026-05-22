import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { NavBar, Pill } from '../components/UI'

const TIER_PILL_VARIANT = { 1: 'gold', 2: 'orange', 3: 'neutral' }
const TIER_LABEL = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' }

function formatDateTime(dateStr, timeStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const datePart = d.toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short' })
  if (!timeStr) return datePart
  const [hRaw, mRaw] = timeStr.split(':')
  const h = Number(hRaw)
  const m = Number(mRaw || 0)
  if (Number.isNaN(h)) return datePart
  const period = h >= 12 ? 'pm' : 'am'
  const hour12 = h % 12 || 12
  const timePart = m === 0 ? `${hour12}${period}` : `${hour12}:${String(m).padStart(2, '0')}${period}`
  return `${datePart} · ${timePart}`
}

function PlanCard({ plan, index, onPress }) {
  const isPending = plan.my_rsvp == null
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      onClick={() => onPress(plan)}
      className={`glass-card mx-5 mb-2.5 p-4 cursor-pointer active:scale-[0.99] transition-transform ${isPending && plan.status === 'open' ? 'border-[1.5px] border-primary' : ''}`}
    >
      {isPending && plan.status === 'open' && (
        <div className="flex items-center gap-1 text-primary text-[11px] font-bold mb-1.5">
          <i className="ti ti-circle-dot text-xs" />
          Waiting for your reply
        </div>
      )}

      {/* Row 1 — name + tier */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="font-display font-extrabold text-[16px] text-ink leading-tight flex-1 min-w-0">{plan.name}</div>
        <Pill variant={TIER_PILL_VARIANT[plan.tier] || 'neutral'}>{TIER_LABEL[plan.tier] || '—'}</Pill>
      </div>

      {/* Row 2 — date + location */}
      <div className="flex items-center gap-1.5 text-[12px] text-[#aaa] mt-1.5">
        <i className="ti ti-calendar text-[13px]" />
        <span className="truncate">
          {formatDateTime(plan.date, plan.time)}
          {plan.location ? ` · ${plan.location}` : ''}
        </span>
      </div>

      {/* Row 3 — faces + counts */}
      <div className="flex items-center mt-2">
        {plan.rsvp_faces.length > 0 && (
          <div className="flex mr-2">
            {plan.rsvp_faces.slice(0, 4).map((e, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-sm border-2 border-base"
                style={{ marginLeft: i === 0 ? 0 : -6 }}
              >
                {e}
              </div>
            ))}
          </div>
        )}
        <span className="text-[11px] text-[#aaa]">
          {plan.confirmed_count} in
          {plan.likely_count > 0 ? ` · ${plan.likely_count} likely` : ''}
        </span>
      </div>

      {/* Row 4 — organiser + status */}
      <div className="flex items-center justify-between mt-2">
        {plan.is_organiser ? (
          <span className="text-[10px] font-bold text-primary">You planned this</span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-[#aaa]">
            <span className="text-sm">{plan.organiser?.emoji || '😎'}</span>
            Planned by {plan.organiser?.display_name || 'a friend'}
          </span>
        )}
        {plan.status === 'closed' && <Pill variant="mint">Closed</Pill>}
        {plan.status === 'cancelled' && <Pill variant="neutral">Cancelled</Pill>}
      </div>
    </motion.div>
  )
}

function EmptyUpcoming({ onCreate }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card mx-5 mt-3 p-6 flex flex-col items-center text-center gap-2"
    >
      <div className="text-[40px] leading-none">🗓️</div>
      <div className="font-display font-black italic text-[18px] text-ink">Nothing coming up</div>
      <div className="text-[12px] text-[#aaa] mb-2">Tap + to create your first plan</div>
      <button
        onClick={onCreate}
        className="bg-ink text-white rounded-full py-3 px-6 font-display font-black italic"
      >
        Create a plan →
      </button>
    </motion.div>
  )
}

function EmptyPast() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card mx-5 mt-3 p-6 flex flex-col items-center text-center gap-2"
    >
      <div className="text-[40px] leading-none">📸</div>
      <div className="font-display font-black italic text-[18px] text-ink">No past plans yet</div>
      <div className="text-[12px] text-[#aaa]">Your history will show up here</div>
    </motion.div>
  )
}

export default function Plans({ navigate }) {
  const [upcoming, setUpcoming] = useState([])
  const [past, setPast] = useState([])
  const [tab, setTab] = useState('upcoming')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadPlans() }, [])

  async function loadPlans() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const selectShape = '*, organiser:profiles!organiser_id(display_name, emoji), rsvps(user_id, status, profiles(emoji))'

    const [rsvpRes, organiserRes] = await Promise.all([
      supabase.from('rsvps').select(`plans!inner(${selectShape})`).eq('user_id', user.id),
      supabase.from('plans').select(selectShape).eq('organiser_id', user.id),
    ])

    if (rsvpRes.error) console.error('Plans: failed to load via rsvps', rsvpRes.error)
    if (organiserRes.error) console.error('Plans: failed to load organising', organiserRes.error)

    const byId = new Map()
    ;(rsvpRes.data || []).forEach(row => { if (row.plans) byId.set(row.plans.id, row.plans) })
    ;(organiserRes.data || []).forEach(p => { byId.set(p.id, p) })

    const enriched = [...byId.values()].map(p => {
      const allRsvps = p.rsvps || []
      const confirmed = allRsvps.filter(r => r.status === 'in')
      const likely = allRsvps.filter(r => r.status === 'likely')
      const mine = allRsvps.find(r => r.user_id === user.id)
      return {
        ...p,
        confirmed_count: confirmed.length,
        likely_count: likely.length,
        my_rsvp: mine?.status ?? null,
        is_organiser: p.organiser_id === user.id,
        rsvp_faces: confirmed.map(r => r.profiles?.emoji).filter(Boolean),
      }
    })

    const today = new Date().toISOString().split('T')[0]
    const up = enriched
      .filter(p => p.status === 'open' && (!p.date || p.date >= today))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    const pa = enriched
      .filter(p =>
        p.status === 'closed' ||
        p.status === 'cancelled' ||
        (p.status === 'open' && p.date && p.date < today)
      )
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

    setUpcoming(up)
    setPast(pa)
    setLoading(false)
  }

  const list = tab === 'upcoming' ? upcoming : past

  return (
    <div className="phone-shell">
      <div className="orb" style={{ width: 180, height: 180, background: '#FDE68A', top: -50, right: -40, opacity: 0.45 }} />
      <div className="orb" style={{ width: 140, height: 140, background: '#BAE6FD', top: 280, left: -40, opacity: 0.35 }} />

      {/* Header */}
      <div className="px-5 pt-5 pb-3 relative z-10">
        <div className="font-display text-[32px] font-black italic text-ink leading-none">Plans.</div>
        <p className="text-[12px] text-[#aaa] mt-1">everything you've said yes to</p>
      </div>

      {/* Tab bar */}
      <div className="px-5 relative z-10">
        <div className="flex border-b border-black/[0.06]">
          {[
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'past', label: 'Past' },
          ].map(t => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative px-4 py-2.5 text-[13px] font-bold transition-colors ${active ? 'text-ink' : 'text-[#bbb]'}`}
              >
                {t.label}
                {active && (
                  <motion.div
                    layoutId="plans-tab-underline"
                    className="absolute -bottom-px left-0 right-0 h-[2px] bg-primary"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="scroll-area relative z-10 pt-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-3xl animate-spin">⚡</div>
          </div>
        ) : list.length === 0 ? (
          tab === 'upcoming'
            ? <EmptyUpcoming onCreate={() => navigate('create')} />
            : <EmptyPast />
        ) : (
          list.map((plan, i) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              index={i}
              onPress={p => navigate('plan-detail', { planId: p.id })}
            />
          ))
        )}
        <div className="h-6" />
      </div>

      <NavBar active="plans" navigate={navigate} />
    </div>
  )
}
