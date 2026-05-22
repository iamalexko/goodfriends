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

  // Public /join/:code page — render before any auth gating so it works
  // without a session and is shareable as a PWA link.
  if (joinPathCode) {
    return <JoinPage code={joinPathCode} />
  }

  if (loading) {
    return (
      <div className="phone-shell flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="font-display text-[28px] font-black text-ink">Goodfriends</div>
          <div className="text-4xl animate-spin">⚡</div>
        </div>
      </div>
    )
  }

  // No session → login / sign-up screens
  if (!user) {
    return <Auth initialInvite={pendingInvite} onComplete={handleAuthComplete} />
  }

  const props = { navigate, ...screenParams }

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
}
