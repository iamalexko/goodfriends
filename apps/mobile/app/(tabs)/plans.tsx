import { useEffect, useRef, useState } from 'react'
import { Image, Pressable, RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { MapPin, Camera } from 'phosphor-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated'

import { supabase } from '../../lib/supabase'
import { AppHeader, APP_HEADER_ROW_HEIGHT } from '../../components/AppHeader'
import { Plan } from '../../components/PlanCard'
import { Loader } from '../../components/Loader'

type Tab = 'upcoming' | 'past'

// Local YYYY-MM-DD — never toISOString() (UTC) which would mislabel Today in Dubai (UTC+4).
function ymd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

// Tier fallback gradient for past memory cards with no cover photo.
const TIER_GRAD: Record<1 | 2 | 3, readonly [string, string]> = {
  1: ['#111111', '#3A3A3A'],
  2: ['#FDE68A', '#FB923C'],
  3: ['#818CF8', '#A78BFA'],
}

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

    const today = ymd(new Date())
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

    // Past enrichment — attendance + cover photo, two batched queries (no N+1).
    const pastIds = pa.map((p) => p.id)
    if (pastIds.length) {
      const [attRes, photoRes] = await Promise.all([
        supabase.from('attendances').select('plan_id, came').in('plan_id', pastIds),
        supabase
          .from('posts')
          .select('plan_id, image_url, created_at')
          .in('plan_id', pastIds)
          .eq('type', 'photo')
          .order('created_at', { ascending: true }),
      ])

      const att = new Map<string, { came: number; total: number }>()
      ;(attRes.data || []).forEach((r: any) => {
        const cur = att.get(r.plan_id) || { came: 0, total: 0 }
        cur.total += 1
        if (r.came) cur.came += 1
        att.set(r.plan_id, cur)
      })

      const ph = new Map<string, { cover: string | null; count: number }>()
      ;(photoRes.data || []).forEach((r: any) => {
        const cur = ph.get(r.plan_id) || { cover: null, count: 0 }
        if (!cur.cover && r.image_url) cur.cover = r.image_url
        cur.count += 1
        ph.set(r.plan_id, cur)
      })

      pa.forEach((p) => {
        p.attendance = att.get(p.id)
        p.photos = ph.get(p.id)
      })
    }

    setUpcoming(up)
    setPast(pa)
    setLoading(false)
  }

  async function onRefresh() {
    setRefreshing(true)
    await loadPlans()
    setRefreshing(false)
  }

  // scrollY drives AppHeader's glass (UI-thread driven).
  const scrollY = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y
  })

  // Top padding clears the AppHeader (insets.top + 52 row + 12 breathing).
  const headerPadTop = insets.top + APP_HEADER_ROW_HEIGHT + 12
  const todayStr = ymd(new Date())

  // Horizontal pager — Upcoming (page 0) / Past (page 1). Tapping a tab scrolls
  // to it; swiping the content settles onto the nearest page and syncs the tab.
  const { width } = useWindowDimensions()
  const pagerRef = useRef<ScrollView>(null)
  function goToTab(id: Tab) {
    setTab(id)
    pagerRef.current?.scrollTo({ x: id === 'past' ? width : 0, animated: true })
  }
  function onPagerSettle(e: { nativeEvent: { contentOffset: { x: number } } }) {
    const next: Tab = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width)) === 1 ? 'past' : 'upcoming'
    if (next !== tab) setTab(next)
  }

  // Upcoming → day-grouped agenda (ascending).
  const upcomingDays: { dateStr: string; plans: Plan[] }[] = (() => {
    const m = new Map<string, Plan[]>()
    upcoming.forEach((p) => {
      const k = p.date || ''
      const arr = m.get(k)
      if (arr) arr.push(p)
      else m.set(k, [p])
    })
    return [...m.keys()].sort().map((k) => ({ dateStr: k, plans: m.get(k)! }))
  })()

  // Past → month-grouped timeline (descending; past is already date-desc).
  const pastMonths: { key: string; plans: Plan[] }[] = (() => {
    const m = new Map<string, Plan[]>()
    past.forEach((p) => {
      const k = (p.date || '').slice(0, 7)
      const arr = m.get(k)
      if (arr) arr.push(p)
      else m.set(k, [p])
    })
    return [...m.keys()].map((k) => ({ key: k, plans: m.get(k)! }))
  })()

  const upcomingBody =
    upcoming.length === 0 ? (
      <EmptyUpcoming onCreate={() => router.push('/create' as any)} />
    ) : (
      upcomingDays.map((day, i) => (
        <AgendaDay
          key={day.dateStr}
          dateStr={day.dateStr}
          plans={day.plans}
          isToday={day.dateStr === todayStr}
          isLast={i === upcomingDays.length - 1}
          onOpen={(id) => router.push(`/plan/${id}` as any)}
        />
      ))
    )

  const pastBody =
    past.length === 0 ? (
      <EmptyPast />
    ) : (
      pastMonths.map((month) => {
        const stat = monthStat(month.plans)
        return (
          <View key={month.key}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, fontWeight: '800', color: '#111111' }}>
                {monthLabel(month.key)}
              </Text>
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 9, color: '#AAAAAA' }}>
                {stat.count} plan{stat.count > 1 ? 's' : ''}
                {stat.rate != null ? ` · ${stat.rate}% showed` : ''}
              </Text>
            </View>
            {month.plans.map((p) =>
              p.status === 'cancelled' ? (
                <CancelledRow key={p.id} plan={p} onPress={() => router.push(`/plan/${p.id}` as any)} />
              ) : (
                <MemoryCard key={p.id} plan={p} onPress={() => router.push(`/plan/${p.id}` as any)} />
              ),
            )}
          </View>
        )
      })
    )

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFBF5' }}>
      {loading ? (
        <View style={{ flex: 1, paddingTop: headerPadTop }}>
          <Loader />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Fixed header — hero + tab toggle stay put while the content pages. */}
          <View style={{ paddingTop: headerPadTop }}>
            <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 32, fontWeight: '800', color: '#111111', letterSpacing: -1, lineHeight: 32 }}>
                Plans.
              </Text>
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#AAAAAA', marginTop: 4 }}>
                {tab === 'upcoming' ? "everything you've said yes to" : 'your time machine 📸'}
              </Text>
            </View>

            <View style={{ paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)', flexDirection: 'row' }}>
              {([
                { id: 'upcoming' as const, label: 'Upcoming' },
                { id: 'past' as const, label: 'Past' },
              ]).map((t) => {
                const active = tab === t.id
                return (
                  <Pressable key={t.id} onPress={() => goToTab(t.id)} style={{ paddingHorizontal: 16, paddingVertical: 10, position: 'relative' }}>
                    <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 13, fontWeight: '700', color: active ? '#111111' : '#BBBBBB' }}>
                      {t.label}
                    </Text>
                    {active && (
                      <View style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, backgroundColor: '#FB923C' }} />
                    )}
                  </Pressable>
                )
              })}
            </View>
          </View>

          {/* Swipeable pager — two full-width pages, each its own vertical scroll. */}
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            directionalLockEnabled
            onMomentumScrollEnd={onPagerSettle}
            style={{ flex: 1 }}
          >
            <View style={{ width }}>
              <Animated.ScrollView
                onScroll={onScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingTop: 14, paddingBottom: insets.bottom + 72 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FB923C" />}
              >
                {upcomingBody}
              </Animated.ScrollView>
            </View>

            <View style={{ width }}>
              <Animated.ScrollView
                onScroll={onScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingTop: 14, paddingBottom: insets.bottom + 72 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FB923C" />}
              >
                {pastBody}
              </Animated.ScrollView>
            </View>
          </ScrollView>
        </View>
      )}

      <AppHeader scrollY={scrollY} />
    </View>
  )
}

// ---- Past month helpers ----
function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number)
  if (!y || !m) return ''
  const now = new Date()
  if (y === now.getFullYear() && m === now.getMonth() + 1) return 'This month'
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('en-AE', y === now.getFullYear() ? { month: 'long' } : { month: 'long', year: 'numeric' })
}

function monthStat(plans: Plan[]) {
  let came = 0
  let total = 0
  for (const p of plans) {
    came += p.attendance?.came || 0
    total += p.attendance?.total || 0
  }
  return { count: plans.length, rate: total > 0 ? Math.round((came / total) * 100) : null }
}

// ---- Upcoming agenda ----
function AgendaDay({
  dateStr,
  plans,
  isToday,
  isLast,
  onOpen,
}: {
  dateStr: string
  plans: Plan[]
  isToday: boolean
  isLast: boolean
  onOpen: (id: string) => void
}) {
  const d = new Date(`${dateStr}T12:00:00`)
  const weekday = d.toLocaleDateString('en-AE', { weekday: 'short' }).toUpperCase()
  const dayNum = d.getDate()

  return (
    <View style={{ flexDirection: 'row', gap: 11, paddingHorizontal: 14 }}>
      {/* Rail */}
      <View style={{ alignItems: 'center', width: 36 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isToday ? '#111111' : '#FFFFFF',
            borderWidth: isToday ? 0 : 1,
            borderColor: 'rgba(0,0,0,0.07)',
          }}
        >
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 6, fontWeight: '700', letterSpacing: 0.4, color: isToday ? 'rgba(255,255,255,0.55)' : '#BBBBBB' }}>{weekday}</Text>
          <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, fontWeight: '800', color: isToday ? '#FFFFFF' : '#111111', lineHeight: 15 }}>{dayNum}</Text>
        </View>
        {!isLast && <View style={{ flex: 1, width: 1.5, backgroundColor: 'rgba(0,0,0,0.07)', marginVertical: 4, minHeight: 14 }} />}
      </View>

      {/* Plans for the day */}
      <View style={{ flex: 1, paddingBottom: 12 }}>
        {plans.map((p) => (
          <AgendaCard key={p.id} plan={p} onPress={() => onOpen(p.id)} />
        ))}
      </View>
    </View>
  )
}

function AgendaCard({ plan, onPress }: { plan: Plan; onPress: () => void }) {
  const isPendingOpen = !plan.my_rsvp && plan.status === 'open'
  return (
    <Pressable
      onPress={onPress}
      style={{
        position: 'relative',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 11,
        marginBottom: 5,
        borderWidth: isPendingOpen ? 1.5 : 1,
        borderColor: isPendingOpen ? '#FB923C' : 'rgba(0,0,0,0.06)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      }}
    >
      {/* Faint tier corner chip — quiet grey, same family as PlanCard. */}
      <View style={{ position: 'absolute', top: 9, right: 10, backgroundColor: '#F3F4F6', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 }}>
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 7, fontWeight: '700', color: '#AAAAAA' }}>{`T${plan.tier}`}</Text>
      </View>

      <Text numberOfLines={1} style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, fontWeight: '800', color: '#111111', paddingRight: 24 }}>
        {plan.name}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
        <MapPin size={11} weight="fill" color={plan.location ? '#555555' : '#CCCCCC'} />
        <Text numberOfLines={1} style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, color: plan.location ? '#555555' : '#BBBBBB' }}>
          {plan.location || 'TBD'}
        </Text>
      </View>

      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 9, color: '#AAAAAA', marginTop: 2 }}>{plan.time || 'All day'}</Text>

      {isPendingOpen ? (
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 8, fontWeight: '700', color: '#FB923C', marginTop: 6 }}>● Reply needed</Text>
      ) : plan.my_rsvp ? (
        <View style={{ alignSelf: 'flex-start', marginTop: 6, backgroundColor: plan.my_rsvp === 'in' ? '#DCFCE7' : '#FEF3C7', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 7, fontWeight: '700', color: plan.my_rsvp === 'in' ? '#166534' : '#92400E' }}>
            {plan.my_rsvp === 'in' ? "You're in" : 'Likely'}
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}

// ---- Past memory card ----
function MemoryCard({ plan, onPress }: { plan: Plan; onPress: () => void }) {
  const cover = plan.photos?.cover || null
  const photoCount = plan.photos?.count || 0
  const came = plan.attendance?.came || 0
  const total = plan.attendance?.total || 0
  const grad = TIER_GRAD[plan.tier] || TIER_GRAD[3]

  return (
    <Pressable
      onPress={onPress}
      style={{
        marginHorizontal: 16,
        marginBottom: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      }}
    >
      {/* Cover band — photo when available, tier gradient otherwise. Name overlays. */}
      <View style={{ height: 74 }}>
        {cover ? (
          <>
            <Image source={{ uri: cover }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.18)' }} />
          </>
        ) : (
          <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: '100%', height: '100%' }} />
        )}
        {photoCount > 0 && (
          <View style={{ position: 'absolute', top: 7, right: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Camera size={9} weight="fill" color="#FFFFFF" />
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 8, fontWeight: '600', color: '#FFFFFF' }}>{photoCount}</Text>
          </View>
        )}
        <Text numberOfLines={1} style={{ position: 'absolute', bottom: 8, left: 10, right: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>
          {plan.name}
        </Text>
      </View>

      {/* Meta — attendance + date. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 11, paddingVertical: 9 }}>
        {total > 0 ? (
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 9, fontWeight: '700', color: came === total ? '#34D399' : '#888888' }}>
            {came}/{total} showed
          </Text>
        ) : (
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 9, color: '#CCCCCC' }}>no attendance recorded</Text>
        )}
        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 9, color: '#AAAAAA' }}>
          {new Date(plan.date).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}
        </Text>
      </View>
    </Pressable>
  )
}

function CancelledRow({ plan, onPress }: { plan: Plan; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.02)' }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#D1D5DB' }} />
      <Text numberOfLines={1} style={{ flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#999999', textDecorationLine: 'line-through' }}>
        {plan.name}
      </Text>
      <View style={{ backgroundColor: '#F3F4F6', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 8, fontWeight: '700', color: '#9CA3AF' }}>Cancelled</Text>
      </View>
      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 9, color: '#BBBBBB' }}>
        {new Date(plan.date).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}
      </Text>
    </Pressable>
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
      <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, fontWeight: '800', color: '#111111', marginBottom: 4 }}>
        Nothing coming up
      </Text>
      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#AAAAAA', marginBottom: 12 }}>
        Tap + to create your first plan
      </Text>
      <Pressable onPress={onCreate} style={{ backgroundColor: '#111111', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 24 }}>
        <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>
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
      <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, fontWeight: '800', color: '#111111', marginBottom: 4 }}>
        No past plans yet
      </Text>
      <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#AAAAAA' }}>
        Your history will show up here
      </Text>
    </View>
  )
}
