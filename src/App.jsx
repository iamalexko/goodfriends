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
        className="fixed top-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none z-0"
        style={{ background: '#FDE68A', filter: 'blur(60px)', opacity: 0.7, transform: 'translate(20%, -20%)' }}
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
      <>
        {orbs}
        <div className="phone-shell flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="font-display text-[28px] font-black text-ink">Goodfriends</div>
            <div className="text-4xl animate-spin">⚡</div>
          </div>
        </div>
      </>
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
