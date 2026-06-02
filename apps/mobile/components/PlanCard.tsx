import { Pressable, Text, View } from 'react-native'
import { MapPin, Clock } from 'phosphor-react-native'

import { Pill } from './Pill'

// Plan data shape coming out of the Home/Plans load functions. Loose typing
// for now — Phase 5 will tighten the Supabase row types.
export type Plan = {
  id: string
  name: string
  date: string
  time?: string | null
  location?: string | null
  tier: 1 | 2 | 3
  status: string
  organiser_id?: string | null
  my_rsvp?: string | null
  is_organiser?: boolean
  confirmed_count: number
  likely_count: number
  rsvp_faces?: string[]
  // Plans screen variant only — organiser embed from the rsvp join.
  organiser?: { display_name?: string | null; emoji?: string | null } | null
  // Plans → Past memory timeline only — attendance summary + cover photo.
  attendance?: { came: number; total: number }
  photos?: { cover: string | null; count: number }
}

// Tier chip: short T1/T2/T3 label, but each tier keeps its distinct colour
// (matching the Pill tier1/2/3 variants) — dark T1, amber T2, grey T3.
const TIER_LABEL: Record<1 | 2 | 3, string> = { 1: 'T1', 2: 'T2', 3: 'T3' }
const TIER_CHIP: Record<1 | 2 | 3, { bg: string; fg: string; border?: string }> = {
  1: { bg: '#111111', fg: '#FFFFFF' },
  2: { bg: '#FEF3C7', fg: '#92400E', border: '#FCD34D' },
  3: { bg: '#F3F4F6', fg: '#AAAAAA' },
}

function formatPlanDate(dateStr: string) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function PlanCard({
  plan,
  onPress,
  onRsvp,
  variant = 'home',
}: {
  plan: Plan
  onPress?: () => void
  onRsvp?: (status: 'in' | 'no') => void
  variant?: 'home' | 'plans'
}) {
  // Pending border only for OPEN plans you haven't replied to — past or
  // cancelled cards never get the orange glow.
  const isPendingOpen = !plan.my_rsvp && plan.status === 'open'

  return (
    <Pressable
      onPress={onPress}
      // Static style object — passing a function caused iOS RN to drop our
      // backgroundColor/border somehow. Static works.
      style={{
        position: 'relative',
        marginHorizontal: 20,
        marginBottom: 10,
        padding: 14,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: isPendingOpen ? 1.5 : 1,
        borderColor: isPendingOpen ? '#FB923C' : 'rgba(0,0,0,0.06)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      {/* Tier corner chip — top-right, colour-coded per tier (T1 dark / T2 amber / T3 grey). */}
      <View
        style={{
          position: 'absolute',
          top: 13,
          right: 14,
          backgroundColor: TIER_CHIP[plan.tier].bg,
          borderWidth: TIER_CHIP[plan.tier].border ? 1 : 0,
          borderColor: TIER_CHIP[plan.tier].border,
          paddingHorizontal: 7,
          paddingVertical: 2,
          borderRadius: 6,
        }}
      >
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 8, fontWeight: '700', letterSpacing: 0.4, color: TIER_CHIP[plan.tier].fg }}>
          {TIER_LABEL[plan.tier]}
        </Text>
      </View>

      {/* Pending label (OPEN + no rsvp) above the name. */}
      {isPendingOpen && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#FB923C' }} />
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 11, fontWeight: '700', color: '#FB923C' }}>
            Waiting for your reply
          </Text>
        </View>
      )}

      {/* 1 — NAME (big). Pad right so it clears the corner tier chip. */}
      <Text
        numberOfLines={2}
        style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, fontWeight: '800', color: '#111111', letterSpacing: -0.3, lineHeight: 19, paddingRight: 34 }}
      >
        {plan.name}
      </Text>

      {/* 2 — LOCATION (own line, darker + semibold). "TBD" when empty. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 }}>
        <MapPin size={13} weight="fill" color={plan.location ? '#555555' : '#CCCCCC'} />
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: plan.location ? '#555555' : '#BBBBBB' }}>
          {plan.location || 'TBD'}
        </Text>
      </View>

      {/* 3 — TIME (muted line under location). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
        <Clock size={12} weight="regular" color="#AAAAAA" />
        <Text numberOfLines={1} style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#AAAAAA' }}>
          {formatPlanDate(plan.date)}{plan.time ? ` · ${plan.time}` : ''}
        </Text>
      </View>

      {/* 4 — inline RSVP (reply-needed + handler) OR faces + count + status. */}
      {isPendingOpen && onRsvp ? (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
          <Pressable onPress={() => onRsvp('in')} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 11, backgroundColor: '#111111' }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, fontWeight: '700', color: '#FFFFFF' }}>I'm in ✓</Text>
          </Pressable>
          <Pressable onPress={() => onRsvp('no')} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 11, backgroundColor: '#F3F4F6' }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, fontWeight: '700', color: '#888888' }}>Can't make it</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row' }}>
              {(plan.rsvp_faces || []).slice(0, 3).map((emoji, i) => (
                <View
                  key={`${emoji}-${i}`}
                  style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFBF5', marginRight: -6 }}
                >
                  <Text style={{ fontSize: 13 }}>{emoji}</Text>
                </View>
              ))}
            </View>
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#AAAAAA', marginLeft: plan.rsvp_faces?.length ? 12 : 0 }}>
              {plan.confirmed_count} in
              {plan.likely_count > 0 ? ` · ${plan.likely_count} likely` : ''}
            </Text>
          </View>

          {variant === 'home' && plan.is_organiser ? (
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: '#AAAAAA' }}>You planned this</Text>
          ) : null}
        </View>
      )}

      {/* 5 — Plans variant only: organiser line + Closed/Cancelled pill. */}
      {variant === 'plans' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          {plan.is_organiser ? (
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, fontWeight: '700', color: '#FB923C' }}>You planned this</Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 13 }}>{plan.organiser?.emoji || '😎'}</Text>
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: '#AAAAAA' }}>
                Planned by {plan.organiser?.display_name || 'a friend'}
              </Text>
            </View>
          )}

          {plan.status === 'closed' && <Pill variant="mint">Closed</Pill>}
          {plan.status === 'cancelled' && <Pill variant="neutral">Cancelled</Pill>}
        </View>
      )}
    </Pressable>
  )
}
