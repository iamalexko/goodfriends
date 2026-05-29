import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

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

export function PlanCard({ plan, onPress }: { plan: Plan; onPress?: () => void }) {
  const isPending = !plan.my_rsvp

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        marginHorizontal: 20,
        marginBottom: 10,
        padding: 14,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.7)',
        borderWidth: isPending ? 1.5 : 1,
        borderColor: isPending ? '#FB923C' : 'rgba(0,0,0,0.06)',
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      {isPending && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <Ionicons name="ellipse" size={6} color="#FB923C" />
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
        <Ionicons name="calendar-outline" size={13} color="#AAAAAA" />
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

      {/* Row 3 — faces + counts + CTA */}
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

        {isPending ? (
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
        ) : null}
      </View>
    </Pressable>
  )
}
