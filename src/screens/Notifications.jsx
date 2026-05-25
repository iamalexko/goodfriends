import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { BackButton } from '../components/UI'

const TYPE_ICON = {
  event_invite:      { icon: 'ti-calendar-plus', color: '#FB923C', bg: '#FEF3C7' },
  event_rsvp:        { icon: 'ti-check',         color: '#34D399', bg: '#DCFCE7' },
  event_comment:     { icon: 'ti-message',       color: '#818CF8', bg: '#EEF2FF' },
  event_closed:      { icon: 'ti-circle-check',  color: '#34D399', bg: '#DCFCE7' },
  event_cancelled:   { icon: 'ti-circle-x',      color: '#EF4444', bg: '#FEE2E2' },
  event_reminder:    { icon: 'ti-clock',         color: '#FB923C', bg: '#FEF3C7' },
  event_filling:    { icon: 'ti-trending-up',    color: '#F472B6', bg: '#FDF2F8' },
  no_reply_nudge:    { icon: 'ti-alert-circle',  color: '#FB923C', bg: '#FEF3C7' },
  photo_posted:      { icon: 'ti-camera',        color: '#818CF8', bg: '#EEF2FF' },
  reaction_received: { icon: 'ti-mood-happy',    color: '#F472B6', bg: '#FDF2F8' },
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function Notifications({ navigate }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadNotifications()
    markAllRead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function loadNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:actor_id(display_name, emoji), plan:plan_id(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setNotifications(data)
    setLoading(false)
  }

  async function markAllRead() {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
  }

  function handleTap(notif) {
    if (notif.plan_id) navigate('plan-detail', { planId: notif.plan_id })
  }

  return (
    <div style={{
      width: '100%', maxWidth: 680, margin: '0 auto',
      minHeight: '100vh', background: '#FFFBF5',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        position: 'fixed', width: 200, height: 200, borderRadius: '50%',
        background: '#FDE68A', top: -60, right: -50, opacity: 0.45,
        filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: '#FFFBF5', borderBottom: '1px solid rgba(0,0,0,0.06)',
        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <BackButton onClick={() => navigate('home')} />
        <div style={{
          fontFamily: '"Plus Jakarta Sans", sans-serif',
          fontSize: 17, fontWeight: 800, color: '#111', letterSpacing: '-0.3px',
        }}>
          Notifications
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0 40px', position: 'relative', zIndex: 1 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div style={{ fontSize: 28 }} className="animate-spin">⚡</div>
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
            <div style={{
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: 17, fontWeight: 800, color: '#111', marginBottom: 6,
            }}>
              All caught up
            </div>
            <div style={{ fontSize: 13, color: '#aaa' }}>
              Notifications will appear here
            </div>
          </div>
        ) : (
          notifications.map((n, i) => {
            const meta = TYPE_ICON[n.type] || TYPE_ICON.event_invite
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => handleTap(n)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 20px',
                  background: n.read ? 'transparent' : 'rgba(251,146,60,0.04)',
                  borderBottom: '1px solid rgba(0,0,0,0.04)',
                  cursor: n.plan_id ? 'pointer' : 'default',
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                  background: meta.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <i className={`ti ${meta.icon}`} style={{ fontSize: 16, color: meta.color }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'baseline',
                    justifyContent: 'space-between', gap: 8, marginBottom: 2,
                  }}>
                    <div style={{
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                      fontSize: 13, fontWeight: 700, color: '#111', letterSpacing: '-0.1px',
                    }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: 10, color: '#bbb', fontWeight: 500, flexShrink: 0 }}>
                      {timeAgo(n.created_at)}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>
                    {n.body}
                  </div>
                  {n.plan?.name && (
                    <div style={{ fontSize: 10, color: '#bbb', marginTop: 3, fontWeight: 500 }}>
                      {n.plan.name}
                    </div>
                  )}
                </div>

                {!n.read && (
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: '#FB923C', flexShrink: 0, marginTop: 4,
                  }} />
                )}
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}
