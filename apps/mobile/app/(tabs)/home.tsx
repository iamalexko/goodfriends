import { useEffect, useState } from 'react'
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated'

import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { AppHeader, APP_HEADER_ROW_HEIGHT } from '../../components/AppHeader'
import { PlanCard, Plan } from '../../components/PlanCard'
import { SkeletonCard, SkeletonText } from '../../components/Skeleton'

// Local YYYY-MM-DD — never via toISOString(), which is UTC and would mislabel
// Today/Tomorrow near midnight in Dubai (UTC+4).
function ymd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

// Parse a YYYY-MM-DD as LOCAL noon so weekday/label math never TZ-shifts.
function localNoon(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`)
}

export default function Home() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { profile } = useAuth()

  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dayFilter, setDayFilter] = useState<string | 'all'>('all')

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
      .select('group_id')
      .eq('user_id', user.id)
      .single()

    const groupId = membership?.group_id
    if (!groupId) {
      setLoading(false)
      return
    }

    // Upcoming OPEN plans the user is involved in (organising or invited).
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

    setLoading(false)
  }

  async function onRefresh() {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  // Optimistic inline RSVP — flips the card from buttons → status and recolours
  // the day chip (amber → green) the instant the last reply on a day is cleared.
  async function handleInlineRsvp(plan: Plan, status: 'in' | 'no') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, my_rsvp: status } : p)))
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase
      .from('rsvps')
      .upsert({ plan_id: plan.id, user_id: user.id, status }, { onConflict: 'plan_id,user_id' })
    if (error) {
      // rollback
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, my_rsvp: null } : p)))
      return
    }
    // Notify the organiser (never self) — same RPC pattern as PlanDetail.
    if (plan.organiser_id && plan.organiser_id !== user.id) {
      try {
        await supabase.rpc('create_notification', {
          p_user_id: plan.organiser_id,
          p_type: 'event_rsvp',
          p_title: 'RSVP update',
          p_body: `${profile?.display_name || 'Someone'} is ${status === 'in' ? 'in' : 'out'} for ${plan.name}`,
          p_plan_id: plan.id,
          p_actor_id: user.id,
        })
      } catch {}
    }
  }

  const firstName = profile?.display_name?.split(' ')[0] || 'there'

  // scrollY drives AppHeader's glass. useAnimatedScrollHandler runs on the UI
  // thread so the glass tracks the finger 1:1 with no JS bridge latency.
  const scrollY = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y
  })

  // Top padding clears the AppHeader (insets.top + 52 row + 12 breathing).
  const headerPadTop = insets.top + APP_HEADER_ROW_HEIGHT + 12

  // ---- Week window + day grouping (all client-side) ----
  const now = new Date()
  const todayStr = ymd(now)
  const tomorrowStr = ymd(addDays(now, 1))
  const weekEndStr = ymd(addDays(now, 7))

  const weekPlans = plans.filter((p) => p.date >= todayStr && p.date <= weekEndStr)
  const laterPlans = plans
    .filter((p) => p.date > weekEndStr)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const byDate = new Map<string, Plan[]>()
  weekPlans.forEach((p) => {
    const arr = byDate.get(p.date)
    if (arr) arr.push(p)
    else byDate.set(p.date, [p])
  })
  const sortedDates = [...byDate.keys()].sort()

  // Plans beyond this week group by MONTH (June / July…) instead of one "Later".
  const byMonth = new Map<string, Plan[]>()
  laterPlans.forEach((p) => {
    const key = p.date.slice(0, 7) // 'YYYY-MM'
    const arr = byMonth.get(key)
    if (arr) arr.push(p)
    else byMonth.set(key, [p])
  })
  const sortedMonths = [...byMonth.keys()].sort()

  const dayHasReply = (dateStr: string) =>
    (byDate.get(dateStr) || []).some((p) => !p.my_rsvp && p.status === 'open')

  const totalNeedsReply = plans.filter((p) => !p.my_rsvp && p.status === 'open').length

  function dayChipLabel(dateStr: string) {
    if (dateStr === todayStr) return 'Today'
    if (dateStr === tomorrowStr) return 'Tomorrow'
    return localNoon(dateStr).toLocaleDateString('en-AE', { weekday: 'short' })
  }

  // Relative-word-first header parts: a bold ink word + a muted numeric sub.
  // Today/Tomorrow use LOCAL date math (todayStr/tomorrowStr via ymd), not UTC.
  function dayHeaderParts(dateStr: string): { word: string; sub: string } {
    const d = localNoon(dateStr)
    const dayMonth = d.toLocaleDateString('en-AE', { day: 'numeric', month: 'short' }) // "7 Jun"
    if (dateStr === todayStr || dateStr === tomorrowStr) {
      const word = dateStr === todayStr ? 'Today' : 'Tomorrow'
      return { word, sub: `${d.toLocaleDateString('en-AE', { weekday: 'short' })} · ${dayMonth}` }
    }
    return { word: d.toLocaleDateString('en-AE', { weekday: 'long' }), sub: dayMonth }
  }

  function monthLabel(key: string): string {
    const d = localNoon(`${key}-01`)
    const sameYear = key.slice(0, 4) === todayStr.slice(0, 4)
    return d.toLocaleDateString('en-AE', sameYear ? { month: 'long' } : { month: 'long', year: 'numeric' })
  }

  const visibleDates = dayFilter === 'all' ? sortedDates : sortedDates.filter((d) => d === dayFilter)
  const isEmpty = weekPlans.length === 0 && laterPlans.length === 0

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFBF5' }}>
      {loading ? (
        <View style={{ flex: 1, paddingTop: headerPadTop }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 14, gap: 8 }}>
            <SkeletonText width={150} height={20} />
            <SkeletonText width={120} height={11} />
          </View>
          <SkeletonText width={88} height={10} style={{ marginLeft: 20, marginBottom: 12 }} />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingTop: headerPadTop,
            // The translucent NativeTabs bar overlays the full-screen scroll
            // content. insets.bottom is only the home indicator (~34pt) — add
            // ~72 so the last card clears the bar.
            paddingBottom: insets.bottom + 72,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FB923C" />
          }
        >
          {/* Greeting + one-line week summary (no crew pill). */}
          <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 14 }}>
            <Text
              numberOfLines={1}
              style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, fontWeight: '700', color: '#111111', letterSpacing: -0.4, lineHeight: 25 }}
            >
              Hey {firstName} {profile?.emoji || '👋'}
            </Text>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: totalNeedsReply ? '#FB923C' : '#2E7355', marginTop: 3 }}>
              {totalNeedsReply > 0
                ? `${totalNeedsReply} plan${totalNeedsReply > 1 ? 's' : ''} need your reply this week`
                : "You're all caught up ✓"}
            </Text>
          </View>

          {/* Day filter chips: All + one per day-with-plans. */}
          {weekPlans.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 14 }}
            >
              <DayChip
                label="All"
                count={weekPlans.length}
                state="all"
                selected={dayFilter === 'all'}
                onPress={() => setDayFilter('all')}
              />
              {sortedDates.map((d) => (
                <DayChip
                  key={d}
                  label={dayChipLabel(d)}
                  count={(byDate.get(d) || []).length}
                  state={dayHasReply(d) ? 'reply' : 'done'}
                  selected={dayFilter === d}
                  onPress={() => setDayFilter(d)}
                />
              ))}
            </ScrollView>
          )}

          {/* Feed */}
          {isEmpty ? (
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
              <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, fontWeight: '700', color: '#111111', marginBottom: 4 }}>
                No plans yet
              </Text>
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#AAAAAA', textAlign: 'center' }}>
                Use the + Plan button up top to plan something.
              </Text>
            </View>
          ) : (
            <>
              {visibleDates.map((d) => (
                <View key={d}>
                  <FeedHeader {...dayHeaderParts(d)} />
                  {(byDate.get(d) || []).map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      // The dated day header above already shows the date — drop it on the card.
                      showDate={false}
                      onPress={() => router.push(`/plan/${plan.id}` as any)}
                      onRsvp={(s) => handleInlineRsvp(plan, s)}
                    />
                  ))}
                </View>
              ))}

              {/* Beyond this week: one group per month. A month doesn't pin the exact
                  day, so these cards keep their date (showDate). */}
              {dayFilter === 'all' &&
                sortedMonths.map((mk, mi) => (
                  <View key={mk}>
                    <FeedHeader word={monthLabel(mk)} sub={mi === 0 ? 'later' : undefined} />
                    {(byMonth.get(mk) || []).map((plan) => (
                      <PlanCard
                        key={plan.id}
                        plan={plan}
                        showDate
                        onPress={() => router.push(`/plan/${plan.id}` as any)}
                        onRsvp={(s) => handleInlineRsvp(plan, s)}
                      />
                    ))}
                  </View>
                ))}
            </>
          )}
        </Animated.ScrollView>
      )}

      {/* AppHeader sits OVER the scroll view — rendered after so it stacks on top. */}
      <AppHeader scrollY={scrollY} />
    </View>
  )
}

function DayChip({
  label,
  count,
  state,
  selected,
  onPress,
}: {
  label: string
  count: number
  state: 'all' | 'reply' | 'done'
  selected: boolean
  onPress: () => void
}) {
  // Status colours stay (they signal meaning): amber = reply-needed, sage = handled,
  // warm-grey = neutral "All". Selected → ink chip with a light inverted badge.
  const countBg = selected
    ? 'rgba(255,255,255,0.22)'
    : state === 'reply'
      ? '#FEF3C7'
      : state === 'done'
        ? '#DCEFE6'
        : '#F0EBE2'
  const countFg = selected
    ? '#FFFFFF'
    : state === 'reply'
      ? '#B45309'
      : state === 'done'
        ? '#2E7355'
        : '#9A8C74'
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: selected ? '#111111' : '#FFFFFF',
        borderWidth: 1,
        borderColor: selected ? '#111111' : 'rgba(0,0,0,0.08)',
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 11,
        marginRight: 6,
      }}
    >
      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, fontWeight: '700', color: selected ? '#FFFFFF' : '#555555' }}>
        {label}
      </Text>
      <View style={{ minWidth: 15, height: 15, paddingHorizontal: 3, borderRadius: 999, backgroundColor: countBg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 8, fontWeight: '800', color: countFg }}>{count}</Text>
      </View>
    </Pressable>
  )
}

// Relative-word-first feed header: a bold ink word + a muted warm-grey numeric
// sub, then a hairline rule filling the remaining width. Replaces the old small
// all-caps grey label.
function FeedHeader({ word, sub }: { word: string; sub?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 9 }}>
      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, fontWeight: '600', color: '#111111', letterSpacing: -0.2 }}>{word}</Text>
      {sub ? (
        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#9A8C74', marginLeft: 7 }}>{sub}</Text>
      ) : null}
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.1)', marginLeft: 12 }} />
    </View>
  )
}
