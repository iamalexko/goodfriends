import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Pill, Loader } from '../components/UI'

const TAG_VARIANTS = ['mint', 'gold', 'neutral']
const TAGS = ['always shows up', 'big planners', 'rooftop lovers']

function formatPlanDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function JoinPage({ code }) {
  const { user, profile, loading: authLoading } = useAuth()
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!code) { setNotFound(true); setPreviewLoading(false); return }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.rpc('get_invite_preview', { p_invite_code: code })
      if (cancelled) return
      if (error || !data) { setNotFound(true); setPreviewLoading(false); return }
      setPreview(data)
      setPreviewLoading(false)
    })()
    return () => { cancelled = true }
  }, [code])

  async function handleJoin() {
    setError('')
    if (user && profile?.display_name) {
      setJoining(true)
      const { error } = await supabase.rpc('join_group_by_invite', { p_invite_code: code })
      if (error) {
        setError(error.message === 'invalid_invite_code' || /invalid_invite_code/.test(error.message)
          ? 'That invite link is invalid or expired.'
          : error.message)
        setJoining(false)
        return
      }
      window.location.replace('/')
      return
    }
    window.location.replace(`/?invite=${encodeURIComponent(code)}`)
  }

  if (previewLoading || authLoading) {
    return <Loader fullScreen size="lg" />
  }

  if (notFound) {
    return (
      <div className="phone-shell flex flex-col items-center justify-center px-8 text-center gap-4">
        <div className="text-5xl">🔗</div>
        <div className="font-display font-black text-[22px] text-ink">Invite not found</div>
        <p className="text-[13px] text-[#aaa]">This link looks expired or invalid. Ask your friend for a fresh one.</p>
        <a href="/" className="px-6 py-3 bg-ink text-white rounded-full font-semibold text-sm no-underline">Open Goodfriends</a>
      </div>
    )
  }

  const next = preview.next_plan
  const emojis = Array.isArray(preview.member_emojis) ? preview.member_emojis : []
  const memberCount = preview.member_count || 0
  const alreadyMember = user && profile?.display_name &&
    /* the preview can't tell us directly; we rely on the RPC's idempotent insert. */ false

  return (
    <div className="phone-shell">
      <div className="orb" style={{ width:220, height:220, background:'#FDE68A', top:-70, right:-60, opacity:0.5 }} />
      <div className="orb" style={{ width:160, height:160, background:'#BAE6FD', bottom:120, left:-50, opacity:0.4 }} />

      <div className="flex-1 flex flex-col px-6 pt-7 pb-7 relative z-10 overflow-y-auto">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#aaa] mb-2">You're invited to join</div>
        <div className="font-display text-[34px] font-black leading-none text-ink mb-1">{preview.name}</div>
        <p className="text-[#888] text-sm mb-5">on Goodfriends — where plans actually happen.</p>

        <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} className="glass-card p-4 mb-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-[16px] bg-ink flex items-center justify-center text-2xl">
              {preview.organiser_emoji || '🎉'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-[18px] font-black text-ink leading-tight">{preview.name}</div>
              <div className="text-[12px] text-[#aaa]">
                {memberCount} {memberCount === 1 ? 'member' : 'members'}
              </div>
            </div>
          </div>

          {emojis.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {emojis.slice(0, 12).map((e, i) => (
                <div key={i} className="w-7 h-7 rounded-full bg-white/70 border border-black/[0.06] flex items-center justify-center text-base">
                  {e}
                </div>
              ))}
              {emojis.length > 12 && (
                <div className="w-7 h-7 rounded-full bg-black/[0.06] flex items-center justify-center text-[10px] font-bold text-ink/60">
                  +{emojis.length - 12}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-1.5 flex-wrap mb-3">
            {TAGS.map((t, i) => <Pill key={t} variant={TAG_VARIANTS[i]}>{t}</Pill>)}
          </div>

          <div className="bg-white/60 rounded-2xl p-3 flex items-center gap-3 border border-black/[0.04]">
            <div className="w-10 h-10 rounded-[12px] bg-[#DCFCE7] flex items-center justify-center font-display font-black text-mint text-[13px]">
              {preview.avg_attendance ?? 0}%
            </div>
            <div className="flex-1">
              <div className="font-display font-extrabold text-[13px] text-ink">Group show-up rate</div>
              <div className="text-[10px] text-[#aaa]">average across all members</div>
            </div>
          </div>
        </motion.div>

        {next ? (
          <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay: 0.08 }} className="glass-card p-4 mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#aaa] mb-2">Next up</p>
            <div className="font-display font-black text-[18px] text-ink mb-1 leading-tight">{next.name}</div>
            <div className="text-[12px] text-[#666]">
              {[formatPlanDate(next.date), next.time, next.location].filter(Boolean).join(' · ')}
            </div>
          </motion.div>
        ) : (
          <div className="text-[12px] text-[#aaa] text-center mb-3">No plans yet — be the one who starts something.</div>
        )}

        {error && <p className="text-red-500 text-xs mb-3 text-center">{error}</p>}

        <div className="mt-auto pt-2">
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full py-4 bg-ink text-white rounded-full font-display font-black text-base disabled:opacity-50"
          >
            {joining ? 'Joining…' : 'Join the crew →'}
          </button>
          <p className="text-center text-[11px] text-[#aaa] mt-3">No app to install. Open the link, you're in.</p>
        </div>
      </div>
    </div>
  )
}
