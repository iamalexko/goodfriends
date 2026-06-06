// send-push — fired by an AFTER INSERT trigger on `notifications` (see the
// notifications_push trigger). Looks up the recipient's Expo push tokens and
// sends a push via Expo's API. In-app notifications stay the source of truth;
// this is purely additive, so web + mobile both get push and never drift.
//
// Guarded by design: with no rows in push_tokens (the case until the APNs
// credential + aps-environment entitlement land), this finds nothing to send
// and returns cleanly. It NEVER throws back to the caller (the trigger uses
// async pg_net anyway, but we stay defensive).
//
// verify_jwt:false — invoked internally by the DB trigger. It uses the
// service-role key (from the function env) to read tokens, bypassing RLS.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

Deno.serve(async (req: Request) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  try {
    const payload = await req.json().catch(() => ({}))
    // Accept either a flat payload or a Supabase-webhook { record } shape.
    const row = (payload && typeof payload === 'object' && 'record' in payload ? (payload as any).record : payload) ?? {}
    const userId = row.user_id
    const title = row.title ?? 'Goodfriends'
    const body = row.body ?? ''
    const planId = row.plan_id ?? null
    const type = row.type ?? null

    if (!userId) return json({ ok: false, reason: 'no user_id' })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId)

    if (!tokens || tokens.length === 0) {
      // Normal case right now — nobody has registered a token yet. No-op.
      return json({ ok: true, sent: 0 })
    }

    const messages = tokens.map((t) => ({
      to: t.token,
      title,
      body,
      sound: 'default',
      data: { plan_id: planId, type },
    }))

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    })
    const result = await res.json().catch(() => null)

    // Prune tokens Expo reports as DeviceNotRegistered (stale/uninstalled).
    const tickets: any[] = result?.data ?? []
    const stale = tickets
      .map((ticket, i) => (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered' ? messages[i].to : null))
      .filter((t): t is string => !!t)
    if (stale.length) {
      await supabase.from('push_tokens').delete().in('token', stale)
    }

    return json({ ok: true, sent: messages.length, pruned: stale.length })
  } catch (e) {
    // Never propagate failures — push is best-effort and additive.
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})
