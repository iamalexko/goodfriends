import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dateStr = tomorrow.toISOString().split('T')[0]

  const { data: plans } = await supabase
    .from('plans')
    .select('*, rsvps(user_id, status)')
    .eq('date', dateStr)
    .eq('status', 'open')

  for (const plan of plans || []) {
    for (const rsvp of plan.rsvps) {
      if (rsvp.status === 'in') {
        await supabase.rpc('create_notification', {
          p_user_id: rsvp.user_id,
          p_type: 'event_reminder',
          p_title: 'Tomorrow 🗓️',
          p_body: `${plan.name} is tomorrow${plan.time ? ` at ${plan.time}` : ''} — you said you're in 🎉`,
          p_plan_id: plan.id,
        })
      }
    }

    const noReply = plan.rsvps.filter((r: any) => !r.status)
    if (noReply.length > 0) {
      await supabase.rpc('create_notification', {
        p_user_id: plan.organiser_id,
        p_type: 'no_reply_nudge',
        p_title: 'Still waiting on replies',
        p_body: `${noReply.length} ${noReply.length === 1 ? "person hasn't" : "people haven't"} replied to ${plan.name} yet`,
        p_plan_id: plan.id,
      })
    }
  }

  return new Response('ok')
})
