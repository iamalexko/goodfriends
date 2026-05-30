import { useEffect, useMemo, useState } from 'react'
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'

import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { TopBar } from '../../components/TopBar'
import { CrewPill } from '../../components/CrewPill'
import { PlanCard, Plan } from '../../components/PlanCard'
import { Pill } from '../../components/Pill'
import { Loader } from '../../components/Loader'

// Urgency score: pending RSVPs float to top, then tier (lower = more
// important), then sooner date wins. Mirrors apps/web/src/screens/Home.jsx.
function getPriorityScore(plan: Plan) {
  let score = 0
  if (!plan.my_rsvp) score += 1000
  score += (4 - (plan.tier || 3)) * 100
  const days = (new Date(plan.date).getTime() - Date.now()) / 86400000
  score -= days
  return score
}

type SortMode = 'urgency' | 'time' | 'tier'

type Group = {
  id: string
  name: string
  emoji?: string | null
  avg_attendance?: number | null
  member_emojis?: string[]
  member_count?: number
}

const sortLabel: Record<SortMode, string> = {
  urgency: 'urgency',
  time: 'date',
  tier: 'tier',
}

export default function Home() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { profile } = useAuth()

  const [plans, setPlans] = useState<Plan[]>([])
  const [pastPlans, setPastPlans] = useState<Plan[]>([])
  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('urgency')
  const [showSortSheet, setShowSortSheet] = useState(false)

  const displayPlans = useMemo(() => {
    const copy = [...plans]
    if (sortMode === 'time') {
      return copy.sort((a, b) => +new Date(a.date) - +new Date(b.date))
    }
    if (sortMode === 'tier') {
      return copy.sort((a, b) =>
        a.tier !== b.tier ? a.tier - b.tier : +new Date(a.date) - +new Date(b.date),
      )
    }
    return copy.sort((a, b) => getPriorityScore(b) - getPriorityScore(a))
  }, [plans, sortMode])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: membership } = await supabase
      .from('group_members')
      .select('group_id, groups(*)')
      .eq('user_id', user.id)
      .single()

    const groupId = membership?.group_id
    if (!groupId) {
      setLoading(false)
      return
    }

    // First 4 member emojis for the crew pill
    const { data: memberData } = await supabase
      .from('group_members')
      .select('profiles(emoji)')
      .eq('group_id', groupId)
      .limit(4)
    const memberEmojis = (memberData || [])
      .map((m: any) => m.profiles?.emoji)
      .filter(Boolean)

    // Total member count
    const { count: memberCount } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)

    // Average attendance across all scored members in this group
    const { data: scoreData } = await supabase
      .from('member_scores')
      .select('attendance_rate')
      .eq('group_id', groupId)
    const rates = (scoreData || [])
      .map((s: any) => s.attendance_rate)
      .filter(Boolean) as number[]
    const avg = rates.length > 0
      ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length)
      : null

    setGroup({
      ...(membership as any).groups,
      avg_attendance: avg,
      member_emojis: memberEmojis,
      member_count: memberCount || memberEmojis.length,
    })

    // Upcoming plans the user is involved in (organising or invited).
    const today = new Date().toISOString().split('T')[0]
    const { data: upcomingData } = await supabase
      .from('plans')
      .select(`*, rsvps(user_id, status, profiles(emoji, display_name))`)
      .eq('group_id', groupId)
      .eq('status', 'open')
      .gte('date', today)
      .order('date', { ascending: true })

    if (upcomingData) {
      const visiblePlans = upcomingData.filter(
        (p: any) => p.organiser_id === user.id || p.rsvps.some((r: any) => r.user_id === user.id),
      )

      const enriched: Plan[] = visiblePlans.map((p: any) => {
        const confirmed = p.rsvps.filter((r: any) => r.status === 'in')
        const likely = p.rsvps.filter((r: any) => r.status === 'likely')
        const mine = p.rsvps.find((r: any) => r.user_id === user.id)
        return {
          ...p,
          confirmed_count: confirmed.length,
          likely_count: likely.length,
          my_rsvp: mine?.status ?? null,
          is_organiser: p.organiser_id === user.id,
          rsvp_faces: confirmed.map((r: any) => r.profiles?.emoji).filter(Boolean),
        }
      })
      setPlans(enriched)
    }

    // Past plans — flat compact rows
    const { data: past } = await supabase
      .from('plans')
      .select('*')
      .eq('group_id', groupId)
      .eq('status', 'closed')
      .order('date', { ascending: false })
      .limit(3)
    if (past) setPastPlans(past as Plan[])

    setLoading(false)
  }

  async function onRefresh() {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const day = new Date().toLocaleDateString('en-AE', { weekday: 'long' })
  const firstName = profile?.display_name?.split(' ')[0] || 'there'

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFBF5' }}>
      <TopBar />

      {/* Greeting row sits ABOVE the ScrollView so it stays put while
          plans scroll underneath. */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <Text
          style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 9,
            color: '#BBBBBB',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          {day} · Dubai
        </Text>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <Text
            style={{
              flexShrink: 1,
              fontFamily: 'PlusJakartaSans_700Bold',
              fontSize: 22,
              fontWeight: '700',
              color: '#111111',
              letterSpacing: -0.4,
              lineHeight: 25,
            }}
            numberOfLines={1}
          >
            Hey {firstName} {profile?.emoji || '👋'}
          </Text>
          {group && (
            <CrewPill
              groupName={group.name}
              memberEmojis={group.member_emojis}
              avgAttendance={group.avg_attendance}
              onPress={() => router.push('/(tabs)/crew' as any)}
            />
          )}
        </View>
      </View>

      {loading ? (
        <Loader />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingTop: 4,
            paddingBottom: Math.max(20, insets.bottom + 12),
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FB923C" />
          }
        >
          {/* Coming up section header with sort chip */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              marginBottom: 10,
            }}
          >
            <Text style={sectionLabelStyle}>Coming up</Text>
            <Pressable onPress={() => setShowSortSheet(true)} hitSlop={6}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Text style={sectionLabelStyle}>Sort by: {sortLabel[sortMode]}</Text>
                <Ionicons name="chevron-down" size={9} color="#BBBBBB" />
              </View>
            </Pressable>
          </View>

          {displayPlans.length === 0 ? (
            <View
              style={{
                marginHorizontal: 20,
                marginBottom: 12,
                padding: 20,
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
              <Text style={{ fontSize: 28, marginBottom: 8 }}>🎉</Text>
              <Text
                style={{
                  fontFamily: 'PlusJakartaSans_800ExtraBold',
                  fontSize: 13,
                  fontWeight: '700',
                  color: '#111111',
                  marginBottom: 4,
                }}
              >
                No plans yet
              </Text>
              <Text
                style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 12,
                  color: '#AAAAAA',
                  textAlign: 'center',
                }}
              >
                Use the + button in the nav bar to plan something.
              </Text>
            </View>
          ) : (
            displayPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                // TODO: route to /plan/[id] when the detail screen ships in Phase 3
                onPress={undefined}
              />
            ))
          )}

          {/* Past plans — flat rows */}
          {pastPlans.length > 0 && (
            <>
              <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginHorizontal: 20, marginVertical: 16 }} />
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 20,
                  marginBottom: 12,
                }}
              >
                <Text style={sectionLabelStyle}>Last plans</Text>
              </View>
              {pastPlans.map((p) => (
                <Pressable
                  key={p.id}
                  // TODO: route to plan detail
                  // Static style — Pressable style-as-function drops styles
                  // on iOS RN in this Expo SDK. Press feedback comes via
                  // android_ripple / native default.
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(0,0,0,0.04)',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#E5E7EB',
                      }}
                    />
                    <View>
                      <Text
                        style={{
                          fontFamily: 'Inter_600SemiBold',
                          fontSize: 13,
                          color: '#555555',
                        }}
                      >
                        {p.name}
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Inter_500Medium',
                          fontSize: 11,
                          color: '#AAAAAA',
                          marginTop: 2,
                        }}
                      >
                        {new Date(p.date).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  </View>
                  <Pill variant="mint">Closed</Pill>
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* Sort sheet */}
      <Modal
        visible={showSortSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSortSheet(false)}
      >
        <Pressable
          onPress={() => setShowSortSheet(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            // Stop propagation so taps inside the sheet don't dismiss it
            onPress={(e) => e.stopPropagation?.()}
            style={{
              backgroundColor: '#FFFBF5',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: Math.max(24, insets.bottom + 12),
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: 'rgba(0,0,0,0.1)',
                alignSelf: 'center',
                marginBottom: 16,
              }}
            />
            <Text
              style={{
                fontFamily: 'PlusJakartaSans_800ExtraBold',
                fontSize: 16,
                fontWeight: '800',
                color: '#111111',
                marginBottom: 12,
              }}
            >
              Sort plans
            </Text>

            {(
              [
                { key: 'urgency' as const, label: 'Urgency', sub: 'Reply needed first, then tier + time', emoji: '⚡' },
                { key: 'time' as const, label: 'Date', sub: 'Soonest plans first', emoji: '🗓️' },
                { key: 'tier' as const, label: 'Tier', sub: 'Most important plans first', emoji: '🏆' },
              ]
            ).map((opt) => {
              const active = sortMode === opt.key
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    setSortMode(opt.key)
                    setShowSortSheet(false)
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 14,
                    borderRadius: 14,
                    marginBottom: 6,
                    backgroundColor: active ? 'rgba(251,146,60,0.08)' : 'rgba(255,255,255,0.8)',
                    borderWidth: active ? 1.5 : 1,
                    borderColor: active ? 'rgba(251,146,60,0.3)' : 'rgba(0,0,0,0.06)',
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{opt.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: 'PlusJakartaSans_700Bold',
                        fontSize: 14,
                        fontWeight: '700',
                        color: '#111111',
                        marginBottom: 2,
                      }}
                    >
                      {opt.label}
                    </Text>
                    <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#AAAAAA' }}>
                      {opt.sub}
                    </Text>
                  </View>
                  {active && <Ionicons name="checkmark" size={18} color="#FB923C" />}
                </Pressable>
              )
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const sectionLabelStyle = {
  fontFamily: 'Inter_700Bold' as const,
  fontSize: 9,
  fontWeight: '700' as const,
  letterSpacing: 0.8,
  textTransform: 'uppercase' as const,
  color: '#BBBBBB',
}
