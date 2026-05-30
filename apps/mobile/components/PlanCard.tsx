import { Pressable, Text, View } from 'react-native'
import { CalendarBlank } from 'phosphor-react-native'

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
  my_rsvp?: string | null
  is_organiser?: boolean
  confirmed_count: number
  likely_count: number
  rsvp_faces?: string[]
  // Plans screen variant only — organiser embed from the rsvp join.
  organiser?: { display_name?: string | null; emoji?: string | null } | null
}

const TIER_VARIANT: Record<1 | 2 | 3, 'tier1' | 'tier2' | 'tier3'> = {
  1: 'tier1',
  2: 'tier2',
  3: 'tier3',
}

const TIER_LABEL: Record<1 | 2 | 3, string> = {
  1: 'Tier 1',
  2: 'Tier 2',
  3: 'Tier 3',
}

function formatPlanDate(dateStr: string) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function PlanCard({
  plan,
  onPress,
  variant = 'home',
}: {
  plan: Plan
  onPress?: () => void
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
        marginHorizontal: 20,
        marginBottom: 10,
        padding: 14,
        borderRadius: 20,
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
      {isPendingOpen && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          {/* Plain 6px circle — Phosphor's smallest icon is overkill for this dot */}
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#FB923C' }} />
          <Text style={{
            fontFamily: 'Inter_700Bold',
            fontSize: 11,
            fontWeight: '700',
            color: '#FB923C',
          }}>
            Waiting for your reply
          </Text>
        </View>
      )}

      {/* Row 1 — name + tier */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 6,
        gap: 8,
      }}>
        <Text
          style={{
            flex: 1,
            fontFamily: 'PlusJakartaSans_800ExtraBold',
            fontSize: 16,
            fontWeight: '800',
            color: '#111111',
            lineHeight: 19,
          }}
          numberOfLines={2}
        >
          {plan.name}
        </Text>
        <Pill variant={TIER_VARIANT[plan.tier]}>{TIER_LABEL[plan.tier]}</Pill>
      </View>

      {/* Row 2 — date · time · location */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <CalendarBlank size={14} weight="regular" color="#AAAAAA" />
        <Text
          style={{
            flex: 1,
            fontFamily: 'Inter_500Medium',
            fontSize: 12,
            color: '#AAAAAA',
          }}
          numberOfLines={1}
        >
          {formatPlanDate(plan.date)}
          {plan.time ? ` · ${plan.time}` : ''}
          {plan.location ? ` · ${plan.location}` : ''}
        </Text>
      </View>

      {/* Row 3 — faces + counts. Home variant adds CTA / "You planned this"
          inline; Plans variant pushes that to its own row below. */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row' }}>
            {(plan.rsvp_faces || []).slice(0, 3).map((emoji, i) => (
              <View
                key={`${emoji}-${i}`}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: '#FFFBF5',
                  marginRight: -6,
                }}
              >
                <Text style={{ fontSize: 13 }}>{emoji}</Text>
              </View>
            ))}
          </View>
          <Text
            style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 11,
              color: '#AAAAAA',
              marginLeft: plan.rsvp_faces?.length ? 12 : 0,
            }}
          >
            {plan.confirmed_count} in
            {plan.likely_count > 0 ? ` · ${plan.likely_count} likely` : ''}
          </Text>
        </View>

        {variant === 'home' && (
          isPendingOpen ? (
            <Text style={{
              fontFamily: 'Inter_700Bold',
              fontSize: 11,
              fontWeight: '700',
              color: '#FB923C',
            }}>
              Reply now
            </Text>
          ) : plan.is_organiser ? (
            <Text style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 10,
              color: '#AAAAAA',
            }}>
              You planned this
            </Text>
          ) : null
        )}
      </View>

      {/* Row 4 — Plans variant only: organiser line + Closed/Cancelled pill */}
      {variant === 'plans' && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 8,
          }}
        >
          {plan.is_organiser ? (
            <Text
              style={{
                fontFamily: 'Inter_700Bold',
                fontSize: 10,
                fontWeight: '700',
                color: '#FB923C',
              }}
            >
              You planned this
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 13 }}>{plan.organiser?.emoji || '😎'}</Text>
              <Text
                style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 10,
                  color: '#AAAAAA',
                }}
              >
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
