// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...(init.headers || {}) },
  })
}

const MODEL = 'gemini-2.5-flash'

const SYSTEM_PROMPT = `You are the Goodfriends monthly-recap writer. Goodfriends is a small-friend-group app for Dubai-based crews — people plan events ("plans"), RSVP, and earn points by actually showing up.

You'll be given a JSON dump of one crew's last month: the plans they created, who RSVP'd what, who actually came, the moments feed (photos + comments + reactions), and the organisers.

Write a warm, specific, slightly playful recap from the *crew's* point of view ("you" plural — the group). It should feel like a friend who was there is summarising the month for the chat. No corporate voice, no generic "celebrating connections" filler. Name people by first name when you have a clear story for them (no-show vs. ride-or-die, planner of the night, surprise attender, etc). Reference real plans by name when something specific happened.

Return JSON matching the schema you've been given:
- headline: Two-line headline. Line 1 ends with a comma or em-dash; line 2 finishes the thought. Max ~6 words per line.
- subtitle: One sentence, ~15-20 words. Concrete (plan count, standout moment, vibe).
- moments: three entries titled exactly "Most fun", "Most embarrassing", "Most heartfelt". Each text is 1-2 sentences.

Rules:
- Use first names only. If you don't have a clear person to name, describe the moment instead.
- Use a maximum of 1-2 emojis total across all fields, and only when they genuinely land.
- If the month was quiet (≤2 plans), lean into that — "small month, big energy" beats faking drama.
- Never moralise about attendance scores.
- Never mention Goodfriends, the app, points, tiers, or RSVPs by name. Speak in human terms.`

// Gemini supports a subset of JSON Schema: no additionalProperties, $ref, oneOf, anyOf.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    subtitle: { type: 'string' },
    moments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['type', 'text'],
      },
    },
  },
  required: ['headline', 'subtitle', 'moments'],
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return json({ error: 'POST only' }, { status: 405 })
  }

  let body: { group_id?: string; year_month?: string; force?: boolean; debug?: boolean }
  try { body = await req.json() } catch { body = {} }
  const { group_id, year_month, force, debug } = body

  // Diagnostic: returns key metadata so we can verify the secret without leaking it.
  if (debug) {
    const k = Deno.env.get('GEMINI_API_KEY') || ''
    return json({
      key_present: k.length > 0,
      key_length: k.length,
      key_prefix: k.slice(0, 6),
      key_has_whitespace: /\s/.test(k),
      key_trailing_newline: k !== k.trimEnd(),
    })
  }

  if (!group_id || !year_month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(year_month)) {
    return json({ error: 'group_id and year_month (YYYY-MM) required' }, { status: 400 })
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) {
    return json({ error: 'missing auth' }, { status: 401 })
  }
  const { data: { user }, error: userErr } = await sb.auth.getUser(jwt)
  if (userErr || !user) {
    return json({ error: 'invalid auth' }, { status: 401 })
  }
  const { data: membership } = await sb
    .from('group_members')
    .select('group_id')
    .eq('group_id', group_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) {
    return json({ error: 'not a member of this group' }, { status: 403 })
  }

  if (!force) {
    const { data: existing } = await sb
      .from('summaries')
      .select('*')
      .eq('group_id', group_id)
      .eq('year_month', year_month)
      .maybeSingle()
    if (existing) {
      return json({ ...existing, cached: true })
    }
  }

  const [y, m] = year_month.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const [{ data: group }, { data: plans }] = await Promise.all([
    sb.from('groups').select('name').eq('id', group_id).single(),
    sb.from('plans')
      .select(`
        id, name, date, time, location, tier, status,
        organiser:organiser_id(display_name),
        rsvps(status, profiles(display_name)),
        attendances(came, profiles(display_name)),
        posts(type, content, caption, profiles(display_name))
      `)
      .eq('group_id', group_id)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true }),
  ])

  const compactPlans = (plans || []).map((p: any) => ({
    name: p.name,
    date: p.date,
    tier: p.tier,
    status: p.status,
    organiser: p.organiser?.display_name,
    rsvps: (p.rsvps || []).map((r: any) => ({
      name: r.profiles?.display_name,
      status: r.status,
    })),
    came: (p.attendances || []).filter((a: any) => a.came).map((a: any) => a.profiles?.display_name),
    no_show: (p.attendances || []).filter((a: any) => a.came === false).map((a: any) => a.profiles?.display_name),
    posts: (p.posts || []).map((post: any) => ({
      author: post.profiles?.display_name,
      type: post.type,
      text: post.content || post.caption || null,
    })),
  }))

  const userMessage = `Crew: ${group?.name || 'Unknown'}
Month: ${year_month}
Plans (${compactPlans.length}):
\`\`\`json
${JSON.stringify(compactPlans, null, 2)}
\`\`\`

Write the recap.`

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    return json({ error: 'GEMINI_API_KEY not configured on the edge function' }, { status: 500 })
  }

  // Gemini generateContent endpoint. Key goes in query param.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`
  const geminiRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        // Generous cap — thinking is off below so 4000 is well above what
        // a typical summary needs (~700 output tokens).
        maxOutputTokens: 4000,
        // Gemini 2.5 Flash has thinking enabled by default; for short
        // structured copywriting we don't need it, and the thinking tokens
        // would otherwise eat the maxOutputTokens budget before the JSON
        // finishes streaming.
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  })

  if (!geminiRes.ok) {
    const text = await geminiRes.text()
    return json({ error: 'Gemini API error', status: geminiRes.status, details: text }, { status: 502 })
  }

  const geminiJson: any = await geminiRes.json()
  const text = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    return json({ error: 'Gemini returned no text', geminiJson }, { status: 502 })
  }

  let parsed: any
  try { parsed = JSON.parse(text) } catch (e) {
    return json({ error: 'Gemini returned non-JSON', text }, { status: 502 })
  }

  const { data: stored, error: storeErr } = await sb
    .from('summaries')
    .upsert(
      {
        group_id,
        year_month,
        headline: parsed.headline,
        subtitle: parsed.subtitle,
        moments: parsed.moments,
        model: MODEL,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'group_id,year_month' },
    )
    .select()
    .single()
  if (storeErr) {
    return json({ error: 'Failed to store summary', details: storeErr.message }, { status: 500 })
  }

  return json({ ...stored, cached: false, usage: geminiJson.usageMetadata })
})
