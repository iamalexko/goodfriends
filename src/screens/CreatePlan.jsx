import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { NavBar, TopBar, BackButton, EmojiAvatar } from '../components/UI'

const TIERS = [
  { id: 1, emoji: '🎉', label: 'Big deal', desc: 'Special occasion · advance booking · dress up', pts: '3× points · planner bonus', bg: 'bg-[#FFFBEB]', color: 'text-[#92400E]' },
  { id: 2, emoji: '🌅', label: 'Weekend plan', desc: 'Intentional outing · some coordination needed', pts: '2× points', bg: 'bg-orange-50', color: 'text-primary' },
  { id: 3, emoji: '☕', label: 'Low-key', desc: 'Casual · spontaneous · low commitment', pts: '1× base points', bg: 'bg-gray-100', color: 'text-gray-400' },
]

export default function CreatePlan({ navigate }) {
  const { profile } = useAuth()
  const [step, setStep] = useState(1)
  const [tier, setTier] = useState(null)
  const [form, setForm] = useState({ name: '', date: '', time: '', location: '', notes: '' })
  const [members, setMembers] = useState([])
  const [invited, setInvited] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadMembers() }, [])

  async function loadMembers() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: mem } = await supabase
      .from('group_members')
      .select('user_id, profiles(id, display_name, emoji)')
      .eq('group_id', await getGroupId(user.id))
    if (mem) {
      const others = mem.filter(m => m.user_id !== user.id).map(m => m.profiles)
      setMembers(others)
      const all = {}
      others.forEach(m => { all[m.id] = true })
      setInvited(all)
    }
  }

  async function getGroupId(userId) {
    const { data } = await supabase.from('group_members').select('group_id').eq('user_id', userId).single()
    return data?.group_id
  }

  const todayStr = new Date().toISOString().split('T')[0]

  async function createPlan() {
    if (!form.name || !form.date) { setError('Add a name and date'); return }
    if (form.date < todayStr) { setError("Pick today or a future date"); return }
    setError('')
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const groupId = await getGroupId(user.id)
    if (!groupId) { setError("Couldn't find your group"); setLoading(false); return }

    const { data: plan, error: planErr } = await supabase.from('plans').insert({
      group_id: groupId,
      organiser_id: user.id,
      name: form.name,
      date: form.date,
      time: form.time,
      location: form.location,
      notes: form.notes,
      tier,
      status: 'open',
    }).select().single()

    if (planErr) { setError(planErr.message); setLoading(false); return }

    const rsvpRows = Object.entries(invited)
      .filter(([id, on]) => on && id !== user.id)
      .map(([userId]) => ({ plan_id: plan.id, user_id: userId, status: null }))
    rsvpRows.push({ plan_id: plan.id, user_id: user.id, status: 'in' })

    const { error: rsvpErr } = await supabase.from('rsvps').insert(rsvpRows)
    if (rsvpErr) {
      console.error('CreatePlan: failed to insert RSVPs', rsvpErr)
      setError(`Plan created but couldn't invite everyone: ${rsvpErr.message}`)
      setLoading(false)
      return
    }

    setLoading(false)
    navigate('home')
  }

  const slide = { initial: { x: 40, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: -40, opacity: 0 } }

  return (
    <div className="phone-shell">
      <TopBar navigate={navigate} />
      <div className="orb" style={{ width:180, height:180, background:'#FDE68A', top:-50, right:-40, opacity:0.45 }} />

      <div className="px-5 pt-4 pb-4 relative z-10">
        <div className="flex items-center gap-3 mb-5">
          <BackButton onClick={() => step > 1 ? setStep(1) : navigate('home')} />
          <div className="font-display text-[26px] font-black text-ink">New plan.</div>
        </div>
      </div>

      <div className="scroll-area relative z-10 px-0">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="t" {...slide} transition={{ duration: 0.22 }} className="px-5 flex flex-col gap-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#aaa] mb-1">Pick the vibe</p>
              {TIERS.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.07 }}
                  onClick={() => { setTier(t.id); setStep(2) }}
                  className={`${t.bg} rounded-[20px] p-4 flex items-center gap-4 cursor-pointer active:scale-[0.99] transition-transform border-2 ${tier === t.id ? 'border-ink' : 'border-transparent'}`}
                >
                  <div className="text-[32px] flex-shrink-0">{t.emoji}</div>
                  <div>
                    <div className="font-display font-black text-[16px] text-ink">{t.label}</div>
                    <div className="text-[12px] text-[#666] mt-0.5">{t.desc}</div>
                    <div className={`text-[11px] font-bold mt-1 ${t.color}`}>{t.pts}</div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="f" {...slide} transition={{ duration: 0.22 }} className="px-5">
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#aaa]">Plan name</label>
                <input className="w-full px-4 py-3.5 rounded-2xl border border-black/10 bg-white/80 text-ink text-[14px] outline-none focus:border-primary mb-3" placeholder="e.g. Rooftop dinner at Ce La Vi" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} />

                <label className="text-[10px] font-bold uppercase tracking-widest text-[#aaa]">Date</label>
                <input type="date" min={todayStr} className="w-full px-4 py-3.5 rounded-2xl border border-black/10 bg-white/80 text-ink text-[14px] outline-none focus:border-primary mb-3" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))} />

                <label className="text-[10px] font-bold uppercase tracking-widest text-[#aaa]">Time</label>
                <input type="time" className="w-full px-4 py-3.5 rounded-2xl border border-black/10 bg-white/80 text-ink text-[14px] outline-none focus:border-primary mb-3" value={form.time} onChange={e => setForm(p => ({...p, time: e.target.value}))} />

                <label className="text-[10px] font-bold uppercase tracking-widest text-[#aaa]">Location</label>
                <input className="w-full px-4 py-3.5 rounded-2xl border border-black/10 bg-white/80 text-ink text-[14px] outline-none focus:border-primary mb-3" placeholder="Venue or area" value={form.location} onChange={e => setForm(p => ({...p, location: e.target.value}))} />

                {tier === 1 && (
                  <>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#aaa]">Notes / booking ref</label>
                    <input className="w-full px-4 py-3.5 rounded-2xl border border-black/10 bg-white/80 text-ink text-[14px] outline-none focus:border-primary mb-3" placeholder="Optional" value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} />
                  </>
                )}

                <label className="text-[10px] font-bold uppercase tracking-widest text-[#aaa] mt-1 mb-2">Invite your crew</label>
                {members.map(m => (
                  <div key={m.id} className="flex items-center gap-2.5 py-2 border-b border-black/[0.05]">
                    <EmojiAvatar emoji={m.emoji} size="sm" />
                    <span className="flex-1 text-[13px] font-semibold text-ink">{m.display_name}</span>
                    <button
                      onClick={() => setInvited(p => ({...p, [m.id]: !p[m.id]}))}
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${invited[m.id] ? 'bg-mint border-mint' : 'border-[#ddd]'}`}
                    >
                      {invited[m.id] && <i className="ti ti-check text-white text-xs" />}
                    </button>
                  </div>
                ))}
              </div>

              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

              <button
                onClick={createPlan}
                disabled={loading}
                className="w-full py-4 bg-ink text-white rounded-full font-display font-black text-base mt-5 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <i className="ti ti-send text-lg" />
                {loading ? 'Creating…' : 'Send invites'}
              </button>
              <div className="h-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
