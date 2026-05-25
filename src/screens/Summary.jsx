import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { NavBar, TopBar, BackButton } from '../components/UI'

// Icon/colour by moment "type" string. The model is told to emit
// "Most fun" / "Most embarrassing" / "Most heartfelt"; if it sends
// something else we fall back to the first entry.
const MOMENT_META = {
  'Most fun':          { icon: 'ti-confetti',         color: '#FB923C' },
  'Most embarrassing': { icon: 'ti-mood-crazy-happy', color: '#F472B6' },
  'Most heartfelt':    { icon: 'ti-heart',            color: '#818CF8' },
}

function momentMeta(type) {
  return MOMENT_META[type] || { icon: 'ti-sparkles', color: '#FB923C' }
}

export default function Summary({ navigate }) {
  const [group, setGroup] = useState(null)
  const [topPlanner, setTopPlanner] = useState(null)
  const [topAttendee, setTopAttendee] = useState(null)
  const [planCount, setPlanCount] = useState(0)
  const [summary, setSummary] = useState(null) // {headline, subtitle, moments[], generated_at}
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')

  const now = new Date()
  const month = now.toLocaleString('default', { month: 'long' })
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: mem } = await supabase
      .from('group_members').select('group_id, groups(id, name)').eq('user_id', user.id).single()
    if (!mem) { setLoading(false); return }
    setGroup(mem.groups)

    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const { data: plans } = await supabase
      .from('plans').select('id').eq('group_id', mem.group_id)
      .gte('date', firstDay.split('T')[0]).eq('status', 'closed')
    setPlanCount(plans?.length || 0)

    const { data: planners } = await supabase
      .from('member_scores')
      .select('*, profiles(display_name, emoji)')
      .eq('group_id', mem.group_id)
      .order('plans_organised', { ascending: false })
      .limit(1)
    if (planners?.[0]) setTopPlanner(planners[0])

    const { data: topAtt } = await supabase
      .from('member_scores')
      .select('*, profiles(display_name, emoji)')
      .eq('group_id', mem.group_id)
      .order('attendance_rate', { ascending: false })
      .limit(1)
    if (topAtt?.[0]) setTopAttendee(topAtt[0])

    // Load any cached AI summary for this month
    const { data: cached } = await supabase
      .from('summaries')
      .select('*')
      .eq('group_id', mem.group_id)
      .eq('year_month', yearMonth)
      .maybeSingle()
    if (cached) setSummary(cached)

    setLoading(false)
  }

  async function generate(force = false) {
    if (!group?.id) return
    setGenerating(true)
    setGenError('')
    const { data, error } = await supabase.functions.invoke('generate-summary', {
      body: { group_id: group.id, year_month: yearMonth, force },
    })
    if (error) {
      // supabase-js wraps non-2xx as FunctionsHttpError; the body comes back in error.context
      let msg = error.message || 'Failed to generate'
      try {
        const ctx = await error.context?.json?.()
        if (ctx?.error) {
          msg = ctx.error
          // The function returns { error, details } for upstream API failures.
          // Surface details so we can debug Anthropic-side errors from the UI.
          if (ctx.details) {
            const detail = typeof ctx.details === 'string' ? ctx.details : JSON.stringify(ctx.details)
            msg += ` — ${detail.slice(0, 500)}`
          }
        }
      } catch {}
      console.error('generate-summary failed', error, msg)
      setGenError(msg)
    } else if (data) {
      setSummary(data)
    }
    setGenerating(false)
  }

  const hasSummary = !!summary
  const moments = summary?.moments || []

  return (
    <div className="phone-shell">
      <TopBar navigate={navigate} />
      <div className="orb" style={{ width:220, height:220, background:'#FDE68A', top:-70, right:-60, opacity:0.5 }} />
      <div className="orb" style={{ width:160, height:160, background:'#BAE6FD', bottom:120, left:-50, opacity:0.4 }} />

      <div className="scroll-area relative z-10">
        <div className="px-5 pt-4 pb-0">
          <div className="flex items-center gap-3 mb-4">
            <BackButton onClick={() => navigate('crew')} />
            <span className="text-[10px] font-bold tracking-widest uppercase text-[#bbb]">
              {group?.name} · {month} {now.getFullYear()}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="text-4xl animate-spin">⚡</div></div>
        ) : (
          <>
            {/* Headline + subtitle. AI-generated when available; otherwise a
                neutral default + Generate CTA below the MVPs. */}
            <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} className="px-5 mb-4">
              <div className="font-display text-[28px] font-black text-ink leading-[1.1] mb-2">
                {hasSummary ? summary.headline : `${month} so far.`}
              </div>
              <p className="text-[13px] text-[#666] italic leading-relaxed">
                {hasSummary
                  ? summary.subtitle
                  : `${planCount} ${planCount === 1 ? 'plan' : 'plans'} closed${planCount > 0 ? ' — generate your recap to see the highlights.' : '.'}`}
              </p>
            </motion.div>

            {/* Moment cards: AI moments when present, otherwise a single
                empty-state card prompting generation. */}
            {hasSummary ? (
              moments.map((m, i) => {
                const meta = momentMeta(m.type)
                return (
                  <motion.div
                    key={`${m.type}-${i}`}
                    initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay: 0.1 + i*0.08 }}
                    className="glass-card mx-5 mb-2.5 p-4"
                  >
                    <div className="flex items-center gap-1.5 mb-2" style={{ color: meta.color }}>
                      <i className={`ti ${meta.icon} text-[13px]`} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{m.type}</span>
                    </div>
                    <p className="text-[13px] text-ink font-medium leading-relaxed">{m.text}</p>
                  </motion.div>
                )
              })
            ) : (
              <motion.div
                initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
                className="glass-card mx-5 mb-2.5 p-5 text-center"
              >
                <div className="text-[28px] mb-2">🪄</div>
                <p className="text-[13px] font-bold text-ink mb-1">No recap yet</p>
                <p className="text-[12px] text-[#aaa] mb-3">
                  Tap "Generate recap" below and we'll write up your month's standout moments.
                </p>
              </motion.div>
            )}

            <div className="h-px bg-black/[0.06] mx-5 my-4" />

            {/* MVPs */}
            <div className="flex items-center justify-between px-5 mb-3">
              <span className="text-[10px] font-bold tracking-widest uppercase text-[#bbb]">This month's MVPs</span>
            </div>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.35 }} className="flex gap-2.5 px-5 mb-4">
              {[
                { label: 'Top planner',   crown: '👑', member: topPlanner,  note: `${topPlanner?.plans_organised || 0} plans organised` },
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
              {genError && (
                <p className="text-red-500 text-[11px] mb-2 text-center">{genError}</p>
              )}
              <button
                onClick={() => generate(hasSummary)}
                disabled={generating || planCount === 0}
                className="w-full py-4 bg-ink text-white rounded-full font-display font-black text-base flex items-center justify-center gap-2 mb-2.5 disabled:opacity-50"
              >
                <i className={`ti ${generating ? 'ti-loader-2 animate-spin' : (hasSummary ? 'ti-refresh' : 'ti-sparkles')} text-lg`} />
                {generating
                  ? 'Writing…'
                  : hasSummary
                    ? 'Regenerate recap'
                    : `Generate ${month} recap`}
              </button>
              <button className="w-full py-3.5 bg-transparent text-[#aaa] border border-[#e5e7eb] rounded-full text-[13px] font-semibold">
                <i className="ti ti-share text-base mr-1.5" />Share recap
              </button>
              {hasSummary && summary.generated_at && (
                <p className="text-[10px] text-[#bbb] text-center mt-3">
                  Written {new Date(summary.generated_at).toLocaleDateString('en-AE', { day:'numeric', month:'short' })} · {summary.model || 'claude-haiku-4-5'}
                </p>
              )}
            </div>
            <div className="h-6" />
          </>
        )}
      </div>

      <NavBar active="crew" navigate={navigate} />
    </div>
  )
}
