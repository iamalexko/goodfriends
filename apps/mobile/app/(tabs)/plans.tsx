import { useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'

import { supabase } from '../../lib/supabase'
import { TopBar } from '../../components/TopBar'
import { PlanCard, Plan } from '../../components/PlanCard'
import { Loader } from '../../components/Loader'

type Tab = 'upcoming' | 'past'

export default function Plans() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [tab, setTab] = useState<Tab>('upcoming')
  const [upcoming, setUpcoming] = useState<Plan[]>([])
  const [past, setPast] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadPlans()
  }, [])

  async function loadPlans() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const selectShape =
      '*, organiser:profiles!organiser_id(display_name, emoji), rsvps(user_id, status, profiles(emoji))'

    const [rsvpRes, organiserRes] = await Promise.all([
      supabase.from('rsvps').select(`plans!inner(${selectShape})`).eq('user_id', user.id),
      supabase.from('plans').select(selectShape).eq('organiser_id', user.id),
    ])

    if (rsvpRes.error) console.error('Plans: failed to load via rsvps', rsvpRes.error)
    if (organiserRes.error) console.error('Plans: failed to load organising', organiserRes.error)

    // De-dupe across the two queries — a plan can show up in both when the
    // user is the organiser AND has an RSVP row of their own.
    const byId = new Map<string, any>()
    ;(rsvpRes.data || []).forEach((row: any) => {
      if (row.plans) byId.set(row.plans.id, row.plans)
    })
    ;(organiserRes.data || []).forEach((p: any) => {
      byId.set(p.id, p)
    })

    const enriched: Plan[] = [...byId.values()].map((p: any) => {
      const allRsvps = p.rsvps || []
      const confirmed = allRsvps.filter((r: any) => r.status === 'in')
      const likely = allRsvps.filter((r: any) => r.status === 'likely')
      const mine = allRsvps.find((r: any) => r.user_id === user.id)
      return {
        ...p,
        confirmed_count: confirmed.length,
        likely_count: likely.length,
        my_rsvp: mine?.status ?? null,
        is_organiser: p.organiser_id === user.id,
        rsvp_faces: confirmed.map((r: any) => r.profiles?.emoji).filter(Boolean),
      }
    })

    const today = new Date().toISOString().split('T')[0]
    const up = enriched
      .filter((p) => p.status === 'open' && (!p.date || p.date >= today))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    const pa = enriched
      .filter(
        (p) =>
          p.status === 'closed' ||
          p.status === 'cancelled' ||
          (p.status === 'open' && p.date && p.date < today),
      )
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

    setUpcoming(up)
    setPast(pa)
    setLoading(false)
  }

  async function onRefresh() {
    setRefreshing(true)
    await loadPlans()
    setRefreshing(false)
  }

  const list = tab === 'upcoming' ? upcoming : past

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFBF5' }}>
      <TopBar />

      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
        <Text
          style={{
            fontFamily: 'PlusJakartaSans_800ExtraBold',
            fontSize: 32,
            fontWeight: '800',
            color: '#111111',
            letterSpacing: -1,
            lineHeight: 32,
          }}
        >
          Plans.
        </Text>
        <Text
          style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 12,
            color: '#AAAAAA',
            marginTop: 4,
          }}
        >
          everything you've said yes to
        </Text>
      </View>

      {/* Tab bar */}
      <View
        style={{
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(0,0,0,0.06)',
          flexDirection: 'row',
        }}
      >
        {([
          { id: 'upcoming' as const, label: 'Upcoming' },
          { id: 'past' as const, label: 'Past' },
        ]).map((t) => {
          const active = tab === t.id
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={{ paddingHorizontal: 16, paddingVertical: 10, position: 'relative' }}
            >
              <Text
                style={{
                  fontFamily: 'Inter_700Bold',
                  fontSize: 13,
                  fontWeight: '700',
                  color: active ? '#111111' : '#BBBBBB',
                }}
              >
                {t.label}
              </Text>
              {active && (
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: -1,
                    height: 2,
                    backgroundColor: '#FB923C',
                  }}
                />
              )}
            </Pressable>
          )
        })}
      </View>

      {loading ? (
        <Loader />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingTop: 12,
            // Clears the floating LiquidGlassTabBar (was insets.bottom + 12).
            paddingBottom: 100,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FB923C" />
          }
        >
          {list.length === 0 ? (
            tab === 'upcoming' ? (
              <EmptyUpcoming onCreate={() => router.push('/(tabs)/create' as any)} />
            ) : (
              <EmptyPast />
            )
          ) : (
            list.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                variant="plans"
                // TODO: route to /plan/[id] in Phase 3
                onPress={undefined}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  )
}

function EmptyUpcoming({ onCreate }: { onCreate: () => void }) {
  return (
    <View
      style={{
        marginHorizontal: 20,
        marginTop: 12,
        padding: 24,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      <Text style={{ fontSize: 40, marginBottom: 6 }}>🗓️</Text>
      <Text
        style={{
          fontFamily: 'PlusJakartaSans_800ExtraBold',
          fontSize: 18,
          fontWeight: '800',
          color: '#111111',
          marginBottom: 4,
        }}
      >
        Nothing coming up
      </Text>
      <Text
        style={{
          fontFamily: 'Inter_500Medium',
          fontSize: 12,
          color: '#AAAAAA',
          marginBottom: 12,
        }}
      >
        Tap + to create your first plan
      </Text>
      <Pressable
        onPress={onCreate}
        style={{
          backgroundColor: '#111111',
          borderRadius: 999,
          paddingVertical: 12,
          paddingHorizontal: 24,
        }}
      >
        <Text
          style={{
            fontFamily: 'PlusJakartaSans_800ExtraBold',
            fontSize: 14,
            fontWeight: '800',
            color: '#FFFFFF',
          }}
        >
          Create a plan →
        </Text>
      </Pressable>
    </View>
  )
}

function EmptyPast() {
  return (
    <View
      style={{
        marginHorizontal: 20,
        marginTop: 12,
        padding: 24,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      <Text style={{ fontSize: 40, marginBottom: 6 }}>📸</Text>
      <Text
        style={{
          fontFamily: 'PlusJakartaSans_800ExtraBold',
          fontSize: 18,
          fontWeight: '800',
          color: '#111111',
          marginBottom: 4,
        }}
      >
        No past plans yet
      </Text>
      <Text
        style={{
          fontFamily: 'Inter_500Medium',
          fontSize: 12,
          color: '#AAAAAA',
        }}
      >
        Your history will show up here
      </Text>
    </View>
  )
}
