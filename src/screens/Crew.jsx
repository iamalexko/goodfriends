import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { NavBar, TopBar, BackButton, Pill, Divider, StatCell } from '../components/UI'

// Position-based palette: rank in race determines colour, not name.
const MEMBER_GRADIENTS = [
  'linear-gradient(90deg,#FB923C,#FCD34D)',
  'linear-gradient(90deg,#818CF8,#A78BFA)',
  'linear-gradient(90deg,#34D399,#6EE7B7)',
  'linear-gradient(90deg,#F472B6,#FB7185)',
  'linear-gradient(90deg,#60A5FA,#93C5FD)',
]
const MEMBER_COLORS = ['#FB923C', '#818CF8', '#34D399', '#F472B6', '#60A5FA']

const GROUP_EMOJIS = ['🎉','🔥','⚡','🌈','💫','🎯','🎸','🏄','🌴','🍕','☕','🍻','🌊','🎲','🎨','🏔️','🚀','🦊','🐼','🦋','🍣','🎬','📚','🎮','🏀','🏖️','🌮','🍜','🥂','🪩','🎭','🌻']

export default function Crew({ navigate }) {
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [stats, setStats] = useState({ plans: 0, avgAttendance: 0, thisMonth: 0 })
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [savingEmoji, setSavingEmoji] = useState(false)

  function getMemberTags(score) {
    const tags = []
    const rate = score?.attendance_rate || 0
    const organised = score?.plans_organised || 0
    const streak = score?.streak || []
    const attended = score?.total_attended || 0
    const tier1 = score?.tier1_organised || 0

    // Prestige tags — shown first
    if (organised >= 5)
      tags.push({ label: 'master planner', bg: '#EEF2FF', color: '#3730A3' })
    if (rate >= 85 && attended >= 5)
      tags.push({ label: 'always shows up', bg: '#DCFCE7', color: '#166534' })

    // Behavioural tags
    const currentStreak = streak.slice(-3).every(Boolean)
    if (currentStreak && attended >= 3)
      tags.push({ label: 'on a streak 🔥', bg: '#F0FDF4', color: '#166534' })
    const longestStreak = streak.reduce((max, val, i) =>
      val ? Math.max(max, streak.slice(0, i+1).reverse().findIndex(v => !v) + 1) : max, 0)
    if (longestStreak >= 5)
      tags.push({ label: 'ride or die', bg: '#FDF2F8', color: '#9D174D' })
    if (tier1 >= 2)
      tags.push({ label: 'big deal energy', bg: '#FFFBEB', color: '#78350F' })

    // Personality tags
    if (rate >= 40 && rate < 70)
      tags.push({ label: 'wildcard', bg: '#FDF4FF', color: '#7E22CE' })
    if (score?.last_minute_saves >= 3)
      tags.push({ label: 'last-min legend', bg: '#FEF3C7', color: '#92400E' })

    // New here — shown alone
    if (attended < 3)
      return [{ label: 'new here', bg: '#E6F1FB', color: '#185FA5' }]

    return tags.slice(0, 2)
  }

  async function pickGroupEmoji(nextEmoji) {
    if (!group?.id || savingEmoji) return
    if (nextEmoji === group.emoji) { setEmojiPickerOpen(false); return }
    const previous = group.emoji
    setSavingEmoji(true)
    setGroup(g => g ? { ...g, emoji: nextEmoji } : g)
    const { error } = await supabase.rpc('set_group_emoji', {
      p_group_id: group.id,
      p_emoji: nextEmoji,
    })
    setSavingEmoji(false)
    if (error) {
      console.error('Crew: failed to set group emoji', error)
      setGroup(g => g ? { ...g, emoji: previous } : g)
      return
    }
    setEmojiPickerOpen(false)
  }

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user.id)

    const { data: memberships, error: memErr } = await supabase
      .from('group_members')
      .select('group_id, groups(*)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(1)
    if (memErr) { console.error('Crew: failed to load membership', memErr); setLoading(false); return }
    const mem = memberships?.[0]
    if (!mem || !mem.groups) { setLoading(false); return }

    setGroup(mem.groups)
    const groupId = mem.group_id

    // PostgREST can't auto-join group_members → member_scores (no direct FK),
    // so fetch members, scores, and plans separately and merge by user_id.
    const [allMemRes, scoresRes, plansRes] = await Promise.all([
      supabase
        .from('group_members')
        .select('user_id, profiles(id, display_name, emoji)')
        .eq('group_id', groupId),
      supabase
        .from('member_scores')
        .select('user_id, score, plans_organised, attendance_rate, streak')
        .eq('group_id', groupId),
      supabase.from('plans').select('id, date, status').eq('group_id', groupId),
    ])

    if (allMemRes.error) console.error('Crew: failed to load members', allMemRes.error)
    if (scoresRes.error) console.error('Crew: failed to load scores', scoresRes.error)
    if (plansRes.error) console.error('Crew: failed to load plans', plansRes.error)

    const allMem = allMemRes.data || []
    const scoresByUser = new Map((scoresRes.data || []).map(s => [s.user_id, s]))
    const plans = plansRes.data || []

    const closed = plans.filter(p => p.status === 'closed')
    const thisMonth = plans.filter(p => {
      if (!p.date) return false
      const d = new Date(p.date)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })

    let totalRate = 0
    let rateCount = 0
    scoresByUser.forEach(s => {
      if (s.attendance_rate) { totalRate += s.attendance_rate; rateCount++ }
    })

    setStats({
      plans: closed.length,
      avgAttendance: rateCount > 0 ? Math.round(totalRate / rateCount) : 0,
      thisMonth: thisMonth.length,
    })

    const enriched = allMem.map(m => {
      const raw = scoresByUser.get(m.user_id)
      const score = raw || { score: 0, plans_organised: 0, attendance_rate: 0, streak: [] }
      return {
        id: m.user_id,
        name: m.profiles?.display_name || 'Friend',
        emoji: m.profiles?.emoji || '😊',
        hasScore: !!raw,
        score,
        tags: getMemberTags(score),
        isYou: m.user_id === user.id,
      }
    }).sort((a, b) => {
      // Members with no recorded data sink to the bottom; otherwise sort by attendance desc, then points desc
      if (a.hasScore !== b.hasScore) return a.hasScore ? -1 : 1
      const rateDiff = (b.score.attendance_rate || 0) - (a.score.attendance_rate || 0)
      if (rateDiff !== 0) return rateDiff
      return (b.score.score || 0) - (a.score.score || 0)
    })
    setMembers(enriched)

    setLoading(false)
  }

  const scoredMembers = members.filter(m => m.hasScore && (m.score.attendance_rate || 0) > 0)
  const noRealData = scoredMembers.length === 0

  return (
    <div className="phone-shell">
      <TopBar navigate={navigate} />
      <div className="orb" style={{ width:200, height:200, background:'#FDE68A', top:-50, right:-50, opacity:0.5 }} />
      <div className="orb" style={{ width:140, height:140, background:'#BAE6FD', bottom:100, left:-40, opacity:0.4 }} />

      <div className="px-5 pt-4 relative z-10">
        <div className="flex items-center justify-between mb-4">
          <BackButton onClick={() => navigate('home')} />
          <button onClick={() => navigate('summary')} className="w-[34px] h-[34px] rounded-full bg-black/5 flex items-center justify-center">
            <i className="ti ti-sparkles text-ink text-base" />
          </button>
        </div>
      </div>

      <div className="scroll-area relative z-10">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="text-4xl animate-spin">⚡</div></div>
        ) : (
          <>
            {/* Group hero */}
            <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} className="glass-card mx-5 mb-4 p-4">
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => group?.id && setEmojiPickerOpen(true)}
                  disabled={!group?.id}
                  aria-label="Change group emoji"
                  className="w-12 h-12 rounded-[16px] bg-ink flex items-center justify-center text-2xl active:scale-95 transition-transform disabled:opacity-100"
                >
                  {group?.emoji || '🎉'}
                </button>
                <div>
                  <div className="font-display text-[22px] font-black text-ink leading-tight">{group?.name || 'Your crew'}</div>
                  <div className="text-[12px] text-[#aaa]">{members.length} members · Dubai</div>
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap mb-3">
                <Pill variant="mint">always shows up</Pill>
                <Pill variant="gold">big planners</Pill>
                <Pill variant="neutral">rooftop lovers</Pill>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <StatCell value={stats.plans} label="plans done" />
                <StatCell value={stats.avgAttendance ? `${stats.avgAttendance}%` : '—'} label="avg show-up" color="text-mint" />
                <StatCell value={stats.thisMonth} label="this month" color="text-primary" />
              </div>
            </motion.div>

            <Divider />

            {noRealData ? (
              /* Empty state replaces both podium AND race when nobody has any score yet */
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="glass-card mx-5 mt-2 mb-4 p-6 flex flex-col items-center text-center gap-2"
              >
                <div className="text-[44px] leading-none">🏆</div>
                <div className="font-display font-black text-[20px] text-ink">Podium loading…</div>
                <div className="text-[12px] text-[#aaa]">Close your first plan to start the race</div>
              </motion.div>
            ) : (
              <>
                {/* Hall of Fame podium — show whatever ranks we have data for.
                    Layout left-to-right: 2nd (if present), 1st, 3rd (if present).
                    The flex parent (justify-center) handles centring automatically:
                      1 column  → 1st centred
                      2 columns → 2nd | 1st centred as a pair
                      3 columns → 2nd | 1st | 3rd centred as a trio */}
                {scoredMembers.length >= 1 && (() => {
                  const cols = []
                  if (scoredMembers.length >= 2) {
                    cols.push({ rank: 2, member: scoredMembers[1], height: 56, bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.2)', color: '#818CF8', label: '2nd', delay: 0.1 })
                  }
                  cols.push({ rank: 1, member: scoredMembers[0], height: 80, bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.25)', color: '#FB923C', label: '1st', delay: 0.2 })
                  if (scoredMembers.length >= 3) {
                    cols.push({ rank: 3, member: scoredMembers[2], height: 40, bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)', color: '#34D399', label: '3rd', delay: 0 })
                  }
                  return (
                  <>
                    <div className="flex items-center justify-between px-5 mt-2 mb-3">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-[#bbb]">hall of fame</span>
                      <span className="text-[10px] text-[#aaa]">all time</span>
                    </div>
                    <div className="glass-card mx-5 p-4 mb-4">
                      <div className="flex items-end justify-center gap-3">
                        {cols.map((col) => (
                          <div key={col.rank} className="flex flex-col items-center gap-1.5">
                            <div className="relative">
                              {col.rank === 1 && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 pointer-events-none">
                                  <motion.div
                                    initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.5, type: 'spring', bounce: 0.5 }}
                                    className="text-base leading-none"
                                  >
                                    👑
                                  </motion.div>
                                </div>
                              )}
                              <motion.div
                                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: col.delay + 0.4 }}
                                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xl"
                              >
                                {col.member.emoji}
                              </motion.div>
                            </div>
                            <div className="font-display font-extrabold text-[11px] text-center text-ink max-w-[80px] truncate">
                              {col.member.name.split(' ')[0]}
                            </div>
                            <motion.div
                              initial={{ height: 0 }} animate={{ height: col.height }}
                              transition={{ delay: col.delay, type: 'spring', stiffness: 280, damping: 22 }}
                              className="w-20 rounded-t-xl flex items-center justify-center overflow-hidden"
                              style={{ background: col.bg, border: `1px solid ${col.border}`, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
                            >
                              <span className="font-display font-black text-[13px]" style={{ color: col.color }}>
                                {col.label}
                              </span>
                            </motion.div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                  )
                })()}

                {/* Race */}
                <div className="flex items-center justify-between px-5 mt-2 mb-3">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-[#bbb]">show-up race</span>
                  <span className="text-[10px] font-bold text-primary">last 30 days</span>
                </div>

                {members.map((m, i) => (
                  <div
                    key={m.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', marginBottom: 14 }}
                  >
                    {/* Rank */}
                    <span
                      style={{
                        fontFamily: '"Plus Jakarta Sans", sans-serif',
                        fontSize: 14, fontWeight: 900, width: 16,
                        textAlign: 'center', flexShrink: 0,
                        color: i < 3 ? '#FB923C' : '#ccc',
                      }}
                    >
                      {i + 1}
                    </span>

                    {/* Avatar */}
                    <div
                      style={{
                        width: 44, height: 44, borderRadius: '50%',
                        background: '#f0f0f0', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: 26, flexShrink: 0,
                        border: m.isYou ? '2.5px solid #111' : '2px solid #e5e7eb',
                      }}
                    >
                      {m.emoji}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Name + tags row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 5 }}>
                        <span
                          style={{
                            fontFamily: '"Plus Jakarta Sans", sans-serif',
                            fontSize: 14, fontWeight: 800, color: '#111', letterSpacing: '-0.2px',
                          }}
                        >
                          {m.name}
                        </span>

                        {m.isYou && (
                          <span
                            style={{
                              fontSize: 9, fontWeight: 700, padding: '2px 7px',
                              borderRadius: 999, background: '#FEF3C7', color: '#92400E',
                              lineHeight: 1.4, flexShrink: 0,
                            }}
                          >
                            You
                          </span>
                        )}

                        {getMemberTags(m.score).map(tag => (
                          <span
                            key={tag.label}
                            style={{
                              fontSize: 9, fontWeight: 700, padding: '2px 7px',
                              borderRadius: 999, background: tag.bg, color: tag.color,
                              lineHeight: 1.4, flexShrink: 0,
                            }}
                          >
                            {tag.label}
                          </span>
                        ))}
                      </div>

                      {/* Bar */}
                      <div style={{ height: 7, background: 'rgba(0,0,0,0.06)', borderRadius: 999, overflow: 'hidden', marginBottom: 4 }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${m.score?.attendance_rate || 0}%` }}
                          transition={{ type: 'spring', bounce: 0.3, delay: i * 0.08 }}
                          style={{
                            height: '100%', borderRadius: 999,
                            background: MEMBER_GRADIENTS[i] || 'linear-gradient(90deg,#94A3B8,#CBD5E1)',
                          }}
                        />
                      </div>

                      {/* Streak dots */}
                      <div style={{ display: 'flex', gap: 3 }}>
                        {(m.score?.streak || Array(7).fill(false)).slice(0, 7).map((hit, j) => (
                          <div
                            key={j}
                            style={{
                              width: 5, height: 5, borderRadius: '50%',
                              background: hit ? '#34D399' : '#e5e7eb',
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Percentage */}
                    <span
                      style={{
                        fontFamily: '"Plus Jakarta Sans", sans-serif',
                        fontSize: 16, fontWeight: 900, flexShrink: 0, minWidth: 44, textAlign: 'right',
                        color: MEMBER_COLORS[i] || '#aaa',
                      }}
                    >
                      {m.score?.attendance_rate ? `${m.score.attendance_rate}%` : '—'}
                    </span>
                  </div>
                ))}
              </>
            )}

            <Divider />

            {/* Reset */}
            <div className="mx-5 mt-4 mb-6 bg-white/60 backdrop-blur border border-black/[0.06] rounded-[18px] p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-[12px] bg-[#F5F0E8] flex items-center justify-center flex-shrink-0">
                <i className="ti ti-refresh text-[#bbb] text-lg" />
              </div>
              <div className="flex-1">
                <div className="font-display font-extrabold text-[13px] text-ink">Fresh start</div>
                <div className="text-[10px] text-[#aaa] mt-0.5">Wipe scores · your story stays forever</div>
              </div>
              <button className="text-[10px] font-bold text-[#aaa] bg-[#F5F0E8] border-none px-3 py-1.5 rounded-full">Propose</button>
            </div>
          </>
        )}
      </div>

      <NavBar active="crew" navigate={navigate} />

      <AnimatePresence>
        {emojiPickerOpen && (
          <motion.div
            key="emoji-overlay"
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
              <div className="font-display font-black text-[18px] text-ink mb-1">Pick a group emoji</div>
              <p className="text-[12px] text-[#aaa] mb-3">Everyone in the crew will see this.</p>
              <div className="grid grid-cols-8 gap-2 mb-3">
                {GROUP_EMOJIS.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => pickGroupEmoji(e)}
                    disabled={savingEmoji}
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xl transition-all disabled:opacity-50 ${group?.emoji === e ? 'bg-[#FEF3C7] border-2 border-primary scale-110' : 'bg-gray-100'}`}
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
