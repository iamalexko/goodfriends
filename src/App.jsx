import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { useAuth } from './context/AuthContext'
import Auth from './screens/Auth'
import Home from './screens/Home'
import Crew from './screens/Crew'
import CreatePlan from './screens/CreatePlan'
import PlanDetail from './screens/PlanDetail'
import Profile from './screens/Profile'
import Summary from './screens/Summary'
import Plans from './screens/Plans'
import JoinPage from './screens/JoinPage'

function readInviteFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('invite') || ''
  } catch {
    return ''
  }
}

function readJoinPathCode() {
  try {
    const m = window.location.pathname.match(/^\/join\/([^/?#]+)\/?$/)
    return m ? decodeURIComponent(m[1]) : ''
  } catch {
    return ''
  }
}

function clearInviteFromUrl() {
  try {
    const url = new URL(window.location.href)
    url.searchParams.delete('invite')
    window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash)
  } catch {}
}

export default function App() {
  const { user, profile, loading } = useAuth()
  const [screen, setScreen] = useState('home')
  const [screenParams, setScreenParams] = useState({})
  const [pendingInvite, setPendingInvite] = useState(readInviteFromUrl)
  const [joinPathCode] = useState(readJoinPathCode)

  // If the link is opened by an already-signed-in user, redeem the invite immediately
  useEffect(() => {
    if (!pendingInvite || !user || !profile?.display_name) return
    let cancelled = false
    ;(async () => {
      const { error } = await supabase.rpc('join_group_by_invite', { p_invite_code: pendingInvite })
      if (cancelled) return
      if (!error) {
        clearInviteFromUrl()
        setPendingInvite('')
        setScreen('crew')
      }
    })()
    return () => { cancelled = true }
  }, [pendingInvite, user, profile?.display_name])

  function handleAuthComplete() {
    clearInviteFromUrl()
    setPendingInvite('')
    setScreen('home')
  }

  function navigate(id, params = {}) {
    setScreenParams(params)
    setScreen(id)
    window.scrollTo(0, 0)
  }

  // Global background orbs — rendered once at app level so they cover the
  // whole viewport (fixed positioning) and persist across screen transitions
  // instead of being re-mounted per-screen.
  const orbs = (
    <>
      <div
        className="fixed right-0 w-[400px] h-[400px] rounded-full pointer-events-none z-0"
        style={{
          // Sits below the top bar (env safe-area + TopBar height ~100px)
          // so the yellow glow doesn't bleed up into the iOS status bar area.
          top: 'calc(env(safe-area-inset-top, 0px) + 60px)',
          background: '#FDE68A',
          filter: 'blur(60px)',
          opacity: 0.7,
          transform: 'translate(20%, 0)',
        }}
      />
      <div
        className="fixed bottom-0 left-0 w-[320px] h-[320px] rounded-full pointer-events-none z-0"
        style={{ background: '#BAE6FD', filter: 'blur(60px)', opacity: 0.55, transform: 'translate(-20%, 20%)' }}
      />
    </>
  )

  // Public /join/:code page — render before any auth gating so it works
  // without a session and is shareable as a PWA link.
  if (joinPathCode) {
    return (
      <>
        {orbs}
        <JoinPage code={joinPathCode} />
      </>
    )
  }

  if (loading) {
    return (
      <div
        style={{
          width: '100%', minHeight: '100vh',
          background: '#FFFBF5',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
        }}
      >
        <div
          style={{
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: 28, fontWeight: 800,
            color: '#111', letterSpacing: '-0.5px',
          }}
        >
          Goodfriends.
        </div>
        <div
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#FB923C',
            animation: 'pulse 1.2s ease-in-out infinite',
          }}
        />
      </div>
    )
  }

  // No session → login / sign-up screens
  if (!user) {
    return (
      <>
        {orbs}
        <Auth initialInvite={pendingInvite} onComplete={handleAuthComplete} />
      </>
    )
  }

  const props = { navigate, ...screenParams }
  const screenComponent = (() => {
    switch (screen) {
      case 'home':        return <Home {...props} />
      case 'crew':        return <Crew {...props} />
      case 'create':      return <CreatePlan {...props} />
      case 'plan-detail': return <PlanDetail {...props} />
      case 'plans':       return <Plans {...props} />
      case 'profile':     return <Profile {...props} />
      case 'summary':     return <Summary {...props} />
      default:            return <Home {...props} />
    }
  })()

  // Desktop reserves the leftmost 220px for the sidebar nav (rendered inside
  // NavBar with fixed positioning); content lives in the remaining column.
  return (
    <>
      {orbs}
      <div className="md:pl-[220px] min-h-screen relative z-10">
        {screenComponent}
      </div>
    </>
  )
}
