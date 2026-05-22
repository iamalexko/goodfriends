import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { NavBar, TopBar, Pill, StatCell } from '../components/UI'

export default function Profile({ navigate }) {
  const { profile } = useAuth()
  const [scores, setScores] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: mem } = await supabase.from('group_members').select('group_id').eq('user_id', user.id).single()
    if (!mem) { setLoading(false); return }

    const { data: sc } = await supabase
      .from('member_scores').select('*')
      .eq('user_id', user.id).eq('group_id', mem.group_id).single()
    if (sc) setScores(sc)

    const { data: att } = await supabase
      .from('attendances')
      .select('came, plans(name, date, tier)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
    if (att) setHistory(att)

    setLoading(false)
  }

  const TAGS = []
  if (scores?.plans_organised >= 3) TAGS.push({ label: 'Master planner', variant: 'violet' })
  if (scores?.attendance_rate >= 85) TAGS.push({ label: 'Always shows up', variant: 'pink' })
  if (scores?.plans_organised >= 1) TAGS.push({ label: 'Taste curator', variant: 'gold' })

  const TIER_PILL = { 1: 'gold', 2: 'orange', 3: 'neutral' }

  return (
    <div className="phone-shell">
      <TopBar navigate={navigate} />
      <div className="orb" style={{ width:200, height:200, background:'#FDE68A', top:-60, right:-50, opacity:0.45 }} />
      <div className="orb" style={{ width:140, height:140, background:'#BAE6FD', top:300, left:-40, opacity:0.35 }} />

      <div className="scroll-area relative z-10">
        {/* Hero */}
        <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} className="flex flex-col items-center px-5 pt-6 pb-4">
          <div className="mb-3">
            <div className="text-[72px] leading-none">{profile?.emoji || '😎'}</div>
          </div>
          <div className="font-display text-[28px] font-black text-ink mb-1">{profile?.display_name || 'You'}</div>
          <div className="text-[12px] text-[#aaa] mb-3">Dubai · Goodfriends member</div>
          {TAGS.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center">
              {TAGS.map(t => <Pill key={t.label} variant={t.variant}>{t.label}</Pill>)}
            </div>
          )}
        </motion.div>

        {/* Stats */}
        {scores && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }} className="grid grid-cols-3 gap-2 px-5 mb-4">
            <StatCell value={scores.attendance_rate ? `${scores.attendance_rate}%` : '—'} label="attendance" color="text-primary" />
            <StatCell value={scores.plans_organised || 0} label="organised" color="text-violet" />
            <StatCell value={scores.score || 0} label="points" color="text-[#BA7517]" />
          </motion.div>
        )}

        <div className="h-px bg-black/[0.06] mx-5 mb-4" />

        {/* Grace passes */}
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.15 }}
          className="mx-5 mb-4 bg-white/70 backdrop-blur border border-black/[0.06] rounded-[18px] p-4 flex items-center gap-3"
        >
          <div className="font-display text-[32px] font-black text-primary leading-none">{scores?.grace_passes_remaining ?? 2}</div>
          <div>
            <div className="font-display font-extrabold text-[14px] text-ink">Grace passes left</div>
            <div className="text-[11px] text-[#aaa] mt-1">Invisible cancellations · resets each year</div>
          </div>
        </motion.div>

        <div className="h-px bg-black/[0.06] mx-5 mb-4" />

        {/* History */}
        <div className="flex items-center justify-between px-5 mb-3">
          <span className="text-[10px] font-bold tracking-widest uppercase text-[#bbb]">Plan history</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><div className="text-2xl animate-spin">⚡</div></div>
        ) : history.length === 0 ? (
          <div className="px-5 py-6 text-center">
            <div className="text-3xl mb-2">🎯</div>
            <p className="text-[13px] text-[#aaa]">No plans yet — go make some memories</p>
          </div>
        ) : (
          history.map((h, i) => (
            <motion.div
              key={i}
              initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay: 0.1 + i*0.05 }}
              className="flex items-center gap-3 px-5 py-2.5 border-b border-black/[0.04]"
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${h.came ? 'bg-mint' : 'bg-[#e5e7eb]'}`} />
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-ink">{h.plans?.name}</div>
                <div className="text-[11px] text-[#aaa] mt-0.5">
                  {h.plans?.date && new Date(h.plans.date).toLocaleDateString('en-AE', { day:'numeric', month:'short' })}
                </div>
              </div>
              {h.plans?.tier && <Pill variant={TIER_PILL[h.plans.tier]}>Tier {h.plans.tier}</Pill>}
              <Pill variant={h.came ? 'mint' : 'neutral'}>{h.came ? 'Went' : 'Missed'}</Pill>
            </motion.div>
          ))
        )}

        {/* Sign out */}
        <div className="px-5 py-6">
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.reload() }}
            className="w-full py-3 bg-transparent text-[#aaa] border border-black/10 rounded-full text-[13px] font-semibold"
          >
            Sign out
          </button>
        </div>
      </div>

      <NavBar active="profile" navigate={navigate} />
    </div>
  )
}
