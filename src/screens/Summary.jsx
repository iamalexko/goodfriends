import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { NavBar, TopBar, BackButton, Pill } from '../components/UI'

export default function Summary({ navigate }) {
  const [group, setGroup] = useState(null)
  const [topPlanner, setTopPlanner] = useState(null)
  const [topAttendee, setTopAttendee] = useState(null)
  const [planCount, setPlanCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: mem } = await supabase.from('group_members').select('group_id, groups(name)').eq('user_id', user.id).single()
    if (!mem) { setLoading(false); return }
    setGroup(mem.groups)

    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const { data: plans } = await supabase
      .from('plans').select('*').eq('group_id', mem.group_id)
      .gte('date', firstDay.split('T')[0]).eq('status', 'closed')
    setPlanCount(plans?.length || 0)

    // Top planner (most plans organised this month)
    const { data: members } = await supabase
      .from('member_scores')
      .select('*, profiles(display_name, emoji)')
      .eq('group_id', mem.group_id)
      .order('plans_organised', { ascending: false })
      .limit(1)
    if (members?.[0]) setTopPlanner(members[0])

    // Top attendee (highest attendance rate)
    const { data: topAtt } = await supabase
      .from('member_scores')
      .select('*, profiles(display_name, emoji)')
      .eq('group_id', mem.group_id)
      .order('attendance_rate', { ascending: false })
      .limit(1)
    if (topAtt?.[0]) setTopAttendee(topAtt[0])

    setLoading(false)
  }

  const month = new Date().toLocaleString('default', { month: 'long' })

  return (
    <div className="phone-shell">
      <TopBar navigate={navigate} group={null} />
      <div className="orb" style={{ width:220, height:220, background:'#FDE68A', top:-70, right:-60, opacity:0.5 }} />
      <div className="orb" style={{ width:160, height:160, background:'#BAE6FD', bottom:120, left:-50, opacity:0.4 }} />

      <div className="scroll-area relative z-10">
        <div className="px-5 pt-4 pb-0">
          <div className="flex items-center gap-3 mb-4">
            <BackButton onClick={() => navigate('crew')} />
            <span className="text-[10px] font-bold tracking-widest uppercase text-[#bbb]">
              {group?.name} · {month} {new Date().getFullYear()}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="text-4xl animate-spin">⚡</div></div>
        ) : (
          <>
            <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} className="px-5 mb-4">
              <div className="font-display text-[36px] font-black text-ink leading-none mb-2">
                {month} was<br />pretty good.
              </div>
              <p className="text-[13px] text-[#666] italic leading-relaxed">
                {planCount} plans closed, memories made, and a crew that actually shows up. 🙌
              </p>
            </motion.div>

            {/* Moment cards */}
            {[
              { type: 'Most fun', icon: 'ti-confetti', color: '#FB923C', text: 'The crew came through — highest turnout yet. Someone organised a Tier 1 and everyone actually showed. Hero behaviour. 🏆' },
              { type: 'Most embarrassing', icon: 'ti-mood-crazy-happy', color: '#F472B6', text: 'You know who you are. Showed up late, blamed traffic, and still had the best time. Classic wildcard energy. 😜' },
              { type: 'Most heartfelt', icon: 'ti-heart', color: '#818CF8', text: "Quietly, someone kept showing up for the group even when life was busy. That's what Goodfriends is about. 🥹" },
            ].map((m, i) => (
              <motion.div
                key={m.type}
                initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay: 0.1 + i*0.08 }}
                className="glass-card mx-5 mb-2.5 p-4"
              >
                <div className="flex items-center gap-1.5 mb-2" style={{ color: m.color }}>
                  <i className={`ti ${m.icon} text-[13px]`} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{m.type}</span>
                </div>
                <p className="text-[13px] text-ink font-medium leading-relaxed">{m.text}</p>
              </motion.div>
            ))}

            <div className="h-px bg-black/[0.06] mx-5 my-4" />

            {/* MVPs */}
            <div className="flex items-center justify-between px-5 mb-3">
              <span className="text-[10px] font-bold tracking-widest uppercase text-[#bbb]">This month's MVPs</span>
            </div>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.35 }} className="flex gap-2.5 px-5 mb-4">
              {[
                { label: 'Top planner', crown: '👑', member: topPlanner, note: `${topPlanner?.plans_organised || 0} plans organised` },
                { label: 'Most reliable', crown: '⚡', member: topAttendee, note: `${topAttendee?.attendance_rate || 0}% attendance` },
              ].map(w => (
                <div key={w.label} className="flex-1 glass-card p-3.5 text-center">
                  <div className="text-[10px] mb-1">{w.crown}</div>
                  <div className="text-[30px] mb-1.5">{w.member?.profiles?.emoji || '🎉'}</div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#aaa] mb-1">{w.label}</div>
                  <div className="font-display font-extrabold text-[13px] text-ink">{w.member?.profiles?.display_name?.split(' ')[0] || '—'}</div>
                  <div className="text-[10px] text-[#aaa] mt-0.5">{w.note}</div>
                </div>
              ))}
            </motion.div>

            {planCount > 0 && (
              <div className="mx-5 mb-4 bg-[#FFFBEB] border border-[rgba(251,146,60,0.2)] rounded-[18px] p-4 flex items-center gap-3">
                <div className="text-[28px]">🔥</div>
                <div>
                  <div className="font-display font-extrabold text-[13px] text-ink">{planCount} plans in {month}</div>
                  <div className="text-[11px] text-[#aaa] mt-0.5">Keep going — your best month could be next</div>
                </div>
              </div>
            )}

            <div className="px-5">
              <button className="w-full py-4 bg-ink text-white rounded-full font-display font-black text-base flex items-center justify-center gap-2 mb-2.5">
                <i className="ti ti-share text-lg" />Share {month} recap
              </button>
              <button className="w-full py-3.5 bg-transparent text-[#aaa] border border-[#e5e7eb] rounded-full text-[13px] font-semibold">
                Propose score reset for next month →
              </button>
            </div>
            <div className="h-6" />
          </>
        )}
      </div>

      <NavBar active="crew" navigate={navigate} />
    </div>
  )
}
