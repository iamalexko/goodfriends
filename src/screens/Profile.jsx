import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { NavBar, TopBar, Pill, StatCell } from '../components/UI'

const EMOJI_CHOICES = [
  '😎','🤩','😄','😜','🫶','🥳','😇','🤗','😏','🥸','🤠','😍','🥹','🫡','😤','🤓',
  '👻','🦁','🐯','🦊','🐼','🐸','🦋','🌊','⚡','🔥','🌈','💫','🎯','🎸','🏄','🌴',
]

export default function Profile({ navigate }) {
  const { profile, updateProfile } = useAuth()
  const [scores, setScores] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmoji, setEditEmoji] = useState('')
  const [saving, setSaving] = useState(false)

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
          <div className="relative mb-3">
            <div className="text-[72px] leading-none">{profile?.emoji || '😎'}</div>
            <div className="absolute inset-[-4px] rounded-full border-[3px] border-primary pointer-events-none" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <div style={{
              fontFamily: '"Plus Jakarta Sans",sans-serif',
              fontSize: 26, fontWeight: 800, color: '#111', letterSpacing: '-0.5px',
            }}>
              {profile?.display_name || 'You'}
            </div>
            <button
              onClick={() => {
                setEditName(profile?.display_name || '')
                setEditEmoji(profile?.emoji || '😎')
                setEditing(true)
              }}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(0,0,0,0.05)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
              aria-label="Edit profile"
            >
              <i className="ti ti-pencil" style={{ fontSize: 13, color: '#888' }} />
            </button>
          </div>
          <div className="text-[12px] text-[#aaa] mb-3 mt-1">Dubai · Goodfriends member</div>
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

      {editing && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end',
          }}
          onClick={() => setEditing(false)}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 680, margin: '0 auto',
              background: '#FFFBF5', borderRadius: '28px 28px 0 0',
              padding: '20px 24px 40px',
            }}
          >
            {/* Drag handle */}
            <div style={{
              width: 36, height: 4, borderRadius: 999,
              background: 'rgba(0,0,0,0.1)', margin: '0 auto 20px',
            }} />

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 24,
            }}>
              <div style={{
                fontFamily: '"Plus Jakarta Sans",sans-serif',
                fontSize: 20, fontWeight: 800, color: '#111',
              }}>
                Edit profile
              </div>
              <button
                onClick={() => setEditing(false)}
                style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.06)', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
                aria-label="Close"
              >
                <i className="ti ti-x" style={{ fontSize: 14, color: '#888' }} />
              </button>
            </div>

            {/* Emoji preview */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 64, marginBottom: 8, lineHeight: 1 }}>{editEmoji}</div>
              <div style={{ fontSize: 11, color: '#aaa', fontWeight: 500 }}>
                Tap an emoji below to change
              </div>
            </div>

            {/* Emoji grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)',
              gap: 8, marginBottom: 24,
            }}>
              {EMOJI_CHOICES.map(e => (
                <button
                  key={e}
                  onClick={() => setEditEmoji(e)}
                  style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: editEmoji === e ? '#FEF3C7' : '#f5f5f5',
                    border: editEmoji === e ? '2px solid #FB923C' : '2px solid transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, cursor: 'pointer',
                    transform: editEmoji === e ? 'scale(1.1)' : 'scale(1)',
                    transition: 'all 0.15s',
                  }}
                >
                  {e}
                </button>
              ))}
            </div>

            {/* Name input */}
            <label style={{
              fontSize: 10, fontWeight: 700, color: '#aaa',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              display: 'block', marginBottom: 6,
            }}>
              Your name
            </label>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onFocus={e => (e.target.style.borderColor = '#FB923C')}
              onBlur={e => (e.target.style.borderColor = 'rgba(0,0,0,0.1)')}
              placeholder="Your name"
              style={{
                width: '100%', padding: '14px 16px',
                border: '1.5px solid rgba(0,0,0,0.1)',
                borderRadius: 14, fontSize: 15,
                fontFamily: 'Inter, sans-serif',
                color: '#111', background: 'rgba(255,255,255,0.8)',
                outline: 'none', marginBottom: 20,
              }}
            />

            {/* Save button */}
            <button
              onClick={async () => {
                if (!editName.trim()) return
                setSaving(true)
                await updateProfile({ display_name: editName.trim(), emoji: editEmoji })
                setSaving(false)
                setEditing(false)
              }}
              disabled={saving || !editName.trim()}
              style={{
                width: '100%', padding: 16,
                background: saving || !editName.trim() ? '#e5e7eb' : '#111',
                color: saving || !editName.trim() ? '#aaa' : '#fff',
                border: 'none', borderRadius: 12,
                fontFamily: '"Plus Jakarta Sans",sans-serif',
                fontSize: 15, fontWeight: 700,
                cursor: saving || !editName.trim() ? 'default' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </motion.div>
        </div>
      )}
    </div>
  )
}
