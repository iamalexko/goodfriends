// Time tag for plan cards: Today / Tomorrow / Wed / 12 Jun.
export function getTimeTag(dateStr) {
  const today    = new Date()
  const planDate = new Date(dateStr)
  const diff     = Math.ceil((planDate - today) / 86400000)

  if (diff <= 0)  return { label: 'Today',    bg: '#FEF3C7', color: '#92400E' }
  if (diff === 1) return { label: 'Tomorrow', bg: '#DCFCE7', color: '#166534' }
  if (diff <= 7)  return {
    label: planDate.toLocaleDateString('en-AE', { weekday: 'short' }),
    bg: '#DCFCE7', color: '#166534',
  }
  return {
    label: planDate.toLocaleDateString('en-AE', { day: 'numeric', month: 'short' }),
    bg: '#F3F4F6', color: '#aaa',
  }
}

// Relative timestamp for moments / activity rows.
export function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// Plan sort priority for the Home "urgency" mode:
//   - Reply needed (+1000) jumps to the top
//   - Tier weight (3/2/1) breaks ties
//   - Time weight (Today=4, Tomorrow=3, week=2, later=1) breaks the rest
export function getPriorityScore(plan) {
  const replyBoost = (!plan.my_rsvp && !plan.is_organiser) ? 1000 : 0
  const tierWeight = { 1: 3, 2: 2, 3: 1 }[plan.tier] || 1

  const today = new Date()
  const diff  = Math.ceil((new Date(plan.date) - today) / 86400000)
  let timeWeight = 1
  if (diff <= 7)  timeWeight = 2
  if (diff === 1) timeWeight = 3
  if (diff <= 0)  timeWeight = 4

  return replyBoost + tierWeight + timeWeight
}
