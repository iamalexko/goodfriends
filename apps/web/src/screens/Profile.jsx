import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { NavBar, TopBar, Pill, StatCell } from '../components/UI'

const PROFILE_EMOJIS = [
  '😎','🤩','😄','😜','🫶','🥳','😇','🤗',
  '😏','🥸','🤠','😍','🥹','🫡','😤','🤓',
  '👻','🦁','🐯','🦊','🐼','🐸','🦋','🌊',
  '⚡','🔥','🌈','💫','🎯','🎸','🏄','🌴',
]

export default function Profile({ navigate }) {
  const { profile, updateProfile } = useAuth()
  const [scores, setScores] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [savingEmoji, setSavingEmoji] = useState(false)

  async function pickProfileEmoji(nextEmoji) {
    if (savingEmoji) return
    if (nextEmoji === profile?.emoji) { setEmojiPickerOpen(false); return }
    setSavingEmoji(true)
    const { error } = await updateProfile({ emoji: nextEmoji })
    setSavingEmoji(false)
    if (error) {
      console.error('Profile: failed to update emoji', error)
      return
    }
    setEmojiPickerOpen(false)
  }

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
          <button
            type="button"
            onClick={() => setEmojiPickerOpen(true)}
            className="relative mb-3 cursor-pointer active:scale-[0.97] transition-transform"
            aria-label="Change profile emoji"
          >
            <div className="text-[72px] leading-none">{profile?.emoji || '😎'}</div>
            <div
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-ink border-[3px] border-base flex items-center justify-center pointer-events-none"
              style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.12)' }}
            >
              <i className="ti ti-pencil text-white" style={{ fontSize: 11 }} />
            </div>
          </button>
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

      <AnimatePresence>
        {emojiPickerOpen && (
          <motion.div
            key="profile-emoji-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => !savingEmoji && setEmojiPickerOpen(false)}
            className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="bg-base w-[88%] max-w-[320px] rounded-3xl p-5 mx-5 mb-5 shadow-2xl border border-black/[0.06]"
            >
              <div className="font-display font-black text-[18px] text-ink mb-1">Pick your emoji</div>
              <p className="text-[12px] text-[#aaa] mb-3">This is how your crew will recognise you.</p>
              <div className="grid grid-cols-8 gap-2 mb-3">
                {PROFILE_EMOJIS.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => pickProfileEmoji(e)}
                    disabled={savingEmoji}
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xl transition-all disabled:opacity-50 ${profile?.emoji === e ? 'bg-[#FEF3C7] border-2 border-primary scale-110' : 'bg-gray-100'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setEmojiPickerOpen(false)}
                disabled={savingEmoji}
                className="w-full py-2.5 rounded-full text-ink/60 text-[13px] font-semibold disabled:opacity-50"
              >
                {savingEmoji ? 'Saving…' : 'Cancel'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
