import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const EMOJIS = ['😎','🤩','😄','😜','🫶','🥳','😇','🤗','😏','🥸','🤠','😍','🥹','🫡','😤','🤓','👻','🦁','🐯','🦊','🐼','🐸','🦋','🌊','⚡','🔥','🌈','💫','🎯','🎸','🏄','🌴']

function extractInviteCode(s) {
  const trimmed = (s || '').trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    const code = url.searchParams.get('invite')
    if (code) return code.trim()
  } catch {}
  return trimmed
}

function Shell({ children }) {
  return (
    <div className="phone-shell">
      <div className="orb" style={{ width:200, height:200, background:'#FDE68A', top:-60, right:-50, opacity:0.5 }} />
      <div className="orb" style={{ width:150, height:150, background:'#BAE6FD', bottom:100, left:-40, opacity:0.4 }} />
      <div className="px-7 pt-6 relative z-10">
        <div
          style={{
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: 14, fontWeight: 800,
            color: '#111', letterSpacing: '-0.3px',
          }}
        >
          Goodfriends.
        </div>
      </div>
      <div className="flex-1 flex flex-col px-7 pt-4 pb-8 relative z-10 overflow-hidden">
        {children}
      </div>
    </div>
  )
}

export default function Auth({ initialInvite = '', onComplete }) {
  const [mode, setMode] = useState('login')
  return mode === 'login'
    ? <Login initialInvite={initialInvite} onSwitch={() => setMode('signup')} onComplete={onComplete} />
    : <SignUp initialInvite={initialInvite} onSwitch={() => setMode('login')} onComplete={onComplete} />
}

function Login({ initialInvite, onSwitch, onComplete }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Enter your email'); return }
    if (!password) { setError('Enter your password'); return }
    setLoading(true)
    const trimmed = email.trim().toLowerCase()
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: trimmed, password })
    if (signInErr) { setError(signInErr.message); setLoading(false); return }
    const code = extractInviteCode(initialInvite)
    if (code) {
      // Best effort — ignore errors so an invalid invite doesn't block login.
      await supabase.rpc('join_group_by_invite', { p_invite_code: code })
    }
    setLoading(false)
    onComplete?.()
  }

  return (
    <Shell>
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between min-h-0">
        <div className="overflow-y-auto">
          <div className="font-display text-[36px] font-black leading-none text-ink mb-2">Welcome back.</div>
          <p className="text-[#888] text-sm mb-8">Sign in to keep the streak going.</p>
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#aaa] mb-1.5 block">Email</label>
          <input
            className="w-full px-4 py-4 rounded-2xl border border-black/10 bg-white/80 text-ink text-[15px] outline-none focus:border-primary mb-3"
            type="email" autoComplete="email"
            placeholder="you@example.com"
            value={email} onChange={e => setEmail(e.target.value)}
          />
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#aaa] mb-1.5 block">Password</label>
          <input
            className="w-full px-4 py-4 rounded-2xl border border-black/10 bg-white/80 text-ink text-[15px] outline-none focus:border-primary mb-2"
            type="password" autoComplete="current-password"
            placeholder="Your password"
            value={password} onChange={e => setPassword(e.target.value)}
          />
          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
        </div>
        <div className="flex-shrink-0 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-ink text-white rounded-full font-display font-black text-base disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>
          <button
            type="button"
            onClick={onSwitch}
            className="w-full mt-3 py-2 text-center text-[13px] text-ink/60"
          >
            Don't have an account? <span className="font-bold text-ink">Sign up</span>
          </button>
        </div>
      </form>
    </Shell>
  )
}

function SignUp({ initialInvite, onSwitch, onComplete }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { fetchProfile } = useAuth()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Enter an email'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (!name.trim()) { setError('Enter a display name'); return }
    if (!emoji) { setError('Pick an emoji'); return }
    setLoading(true)
    const trimmed = email.trim().toLowerCase()
    const signUp = await supabase.auth.signUp({ email: trimmed, password })
    if (signUp.error) {
      const msg = signUp.error.message || ''
      setError(/registered|exists/i.test(msg)
        ? 'That email is already registered. Try logging in.'
        : msg)
      setLoading(false); return
    }
    // If email confirmation is on, signUp returns no session — try to sign in.
    let userId = signUp.data.user?.id
    if (!signUp.data.session) {
      const signIn = await supabase.auth.signInWithPassword({ email: trimmed, password })
      if (signIn.error) { setError(signIn.error.message); setLoading(false); return }
      userId = signIn.data.user?.id || userId
    }
    if (!userId) { setError('Could not create account'); setLoading(false); return }
    const { error: profErr } = await supabase
      .from('profiles')
      .upsert({ id: userId, display_name: name.trim(), emoji })
    if (profErr) { setError(profErr.message); setLoading(false); return }
    await fetchProfile?.(userId)
    const code = extractInviteCode(initialInvite)
    if (code) {
      await supabase.rpc('join_group_by_invite', { p_invite_code: code })
    }
    setLoading(false)
    onComplete?.()
  }

  return (
    <Shell>
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between min-h-0">
        <div className="overflow-y-auto pr-1">
          <div className="font-display text-[32px] font-black leading-none text-ink mb-2">Show up.<br />Be remembered.</div>
          <p className="text-[#888] text-sm mb-5">Create your account and pick your vibe.</p>

          <label className="text-[10px] font-bold uppercase tracking-widest text-[#aaa] mb-1.5 block">Email</label>
          <input
            className="w-full px-4 py-3.5 rounded-2xl border border-black/10 bg-white/80 text-ink text-[15px] outline-none focus:border-primary mb-3"
            type="email" autoComplete="email"
            placeholder="you@example.com"
            value={email} onChange={e => setEmail(e.target.value)}
          />

          <label className="text-[10px] font-bold uppercase tracking-widest text-[#aaa] mb-1.5 block">Password</label>
          <input
            className="w-full px-4 py-3.5 rounded-2xl border border-black/10 bg-white/80 text-ink text-[15px] outline-none focus:border-primary mb-3"
            type="password" autoComplete="new-password"
            placeholder="At least 6 characters"
            value={password} onChange={e => setPassword(e.target.value)}
          />

          <label className="text-[10px] font-bold uppercase tracking-widest text-[#aaa] mb-1.5 block">Display name</label>
          <input
            className="w-full px-4 py-3.5 rounded-2xl border border-black/10 bg-white/80 text-ink text-[15px] outline-none focus:border-primary mb-3"
            type="text"
            placeholder="Alex Ko"
            value={name} onChange={e => setName(e.target.value)}
          />

          <label className="text-[10px] font-bold uppercase tracking-widest text-[#aaa] mb-2 block">Pick your vibe</label>
          <div className="grid grid-cols-8 gap-2 mb-2">
            {EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xl transition-all ${emoji === e ? 'bg-[#FEF3C7] border-2 border-primary scale-110' : 'bg-gray-100'}`}
              >
                {e}
              </button>
            ))}
          </div>
          {emoji && <div className="text-center text-[40px] my-1">{emoji}</div>}
          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
        </div>
        <div className="flex-shrink-0 pt-3">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-ink text-white rounded-full font-display font-black text-base disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Create account →'}
          </button>
          <button
            type="button"
            onClick={onSwitch}
            className="w-full mt-3 py-2 text-center text-[13px] text-ink/60"
          >
            Already have an account? <span className="font-bold text-ink">Log in</span>
          </button>
        </div>
      </form>
    </Shell>
  )
}
