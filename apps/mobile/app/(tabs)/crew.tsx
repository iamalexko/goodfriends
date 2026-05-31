import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated'
import { getMemberTags } from '@goodfriends/shared'

import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { AppHeader, APP_HEADER_ROW_HEIGHT } from '../../components/AppHeader'
import { StatCell } from '../../components/StatCell'
import { Loader } from '../../components/Loader'

// Position-based bar colours: rank determines colour, not identity.
const MEMBER_COLORS = ['#FB923C', '#818CF8', '#34D399', '#F472B6', '#60A5FA']
const MEMBER_BAR = [
  ['#FB923C', '#FCD34D'],
  ['#818CF8', '#A78BFA'],
  ['#34D399', '#6EE7B7'],
  ['#F472B6', '#FB7185'],
  ['#60A5FA', '#93C5FD'],
]

type Tag = { label: string; bg: string; color: string }
type Score = {
  score?: number
  plans_organised?: number
  attendance_rate?: number
  streak?: boolean[]
}
type Member = {
  id: string
  name: string
  emoji: string
  hasScore: boolean
  score: Score
  isYou: boolean
}

const SECTION_LABEL = {
  fontFamily: 'Inter_700Bold' as const,
  fontSize: 10,
  fontWeight: '700' as const,
  letterSpacing: 0.8,
  textTransform: 'uppercase' as const,
  color: '#BBBBBB',
}

export default function Crew() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()

  const [group, setGroup] = useState<{ name?: string; emoji?: string } | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [stats, setStats] = useState({ plans: 0, avgAttendance: 0, thisMonth: 0 })
  const [loading, setLoading] = useState(true)

  const scrollY = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y })
  const headerPadTop = insets.top + APP_HEADER_ROW_HEIGHT + 12

  useEffect(() => {
    loadData()
  }, [user])

  async function loadData() {
    if (!user) return

    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id, groups(*)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(1)
    const mem = memberships?.[0] as any
    if (!mem?.groups) { setLoading(false); return }
    setGroup(mem.groups)
    const groupId = mem.group_id

    // No direct FK group_members → member_scores, so fetch + merge by user_id.
    const [allMemRes, scoresRes, plansRes] = await Promise.all([
      supabase.from('group_members').select('user_id, profiles(id, display_name, emoji)').eq('group_id', groupId),
      supabase.from('member_scores').select('user_id, score, plans_organised, attendance_rate, streak').eq('group_id', groupId),
      supabase.from('plans').select('id, date, status').eq('group_id', groupId),
    ])

    const allMem = (allMemRes.data || []) as any[]
    const scoresByUser = new Map<string, Score>((scoresRes.data || []).map((s: any) => [s.user_id, s]))
    const plans = (plansRes.data || []) as any[]

    const now = new Date()
    const closed = plans.filter((p) => p.status === 'closed')
    const thisMonth = plans.filter((p) => {
      if (!p.date) return false
      const d = new Date(p.date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })

    let totalRate = 0
    let rateCount = 0
    scoresByUser.forEach((s) => {
      if (s.attendance_rate) { totalRate += s.attendance_rate; rateCount++ }
    })
    setStats({
      plans: closed.length,
      avgAttendance: rateCount > 0 ? Math.round(totalRate / rateCount) : 0,
      thisMonth: thisMonth.length,
    })

    const enriched: Member[] = allMem
      .map((m) => {
        const raw = scoresByUser.get(m.user_id)
        const score: Score = raw || { score: 0, plans_organised: 0, attendance_rate: 0, streak: [] }
        return {
          id: m.user_id,
          name: m.profiles?.display_name || 'Friend',
          emoji: m.profiles?.emoji || '😊',
          hasScore: !!raw,
          score,
          isYou: m.user_id === user.id,
        }
      })
      .sort((a, b) => {
        if (a.hasScore !== b.hasScore) return a.hasScore ? -1 : 1
        const rateDiff = (b.score.attendance_rate || 0) - (a.score.attendance_rate || 0)
        if (rateDiff !== 0) return rateDiff
        return (b.score.score || 0) - (a.score.score || 0)
      })
    setMembers(enriched)
    setLoading(false)
  }

  const scoredMembers = members.filter((m) => m.hasScore && (m.score.attendance_rate || 0) > 0)
  const noRealData = scoredMembers.length === 0

  // Podium columns: 2nd | 1st | 3rd (centre-anchored on 1st).
  const podium: { rank: number; m: Member; height: number; bg: string; border: string; color: string; label: string }[] = []
  if (scoredMembers.length >= 2) podium.push({ rank: 2, m: scoredMembers[1], height: 56, bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.2)', color: '#818CF8', label: '2nd' })
  if (scoredMembers.length >= 1) podium.push({ rank: 1, m: scoredMembers[0], height: 80, bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.25)', color: '#FB923C', label: '1st' })
  if (scoredMembers.length >= 3) podium.push({ rank: 3, m: scoredMembers[2], height: 40, bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.2)', color: '#34D399', label: '3rd' })

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFBF5' }}>
      {loading ? (
        <View style={{ flex: 1, paddingTop: headerPadTop }}><Loader /></View>
      ) : (
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: headerPadTop, paddingBottom: 24 }}
        >
          {/* Group hero */}
          <View style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#111111', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 24 }}>{group?.emoji || '🎉'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, fontWeight: '800', color: '#111111', letterSpacing: -0.4 }} numberOfLines={1}>
                  {group?.name || 'Your crew'}
                </Text>
                <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#AAAAAA', marginTop: 2 }}>
                  {members.length} members · Dubai
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <StatCell value={stats.plans} label="plans done" />
              <StatCell value={stats.avgAttendance ? `${stats.avgAttendance}%` : '—'} label="avg show-up" color="#34D399" />
              <StatCell value={stats.thisMonth} label="this month" color="#FB923C" />
            </View>
          </View>

          {noRealData ? (
            <View style={{ marginHorizontal: 20, marginTop: 4, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', borderRadius: 20, padding: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 44, marginBottom: 4 }}>🏆</Text>
              <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20, fontWeight: '800', color: '#111111', marginBottom: 4 }}>Podium loading…</Text>
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#AAAAAA', textAlign: 'center' }}>Close your first plan to start the race</Text>
            </View>
          ) : (
            <>
              {/* Hall of Fame podium */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 10 }}>
                <Text style={SECTION_LABEL}>Hall of fame</Text>
                <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 10, color: '#AAAAAA' }}>all time</Text>
              </View>
              <View style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', borderRadius: 20, paddingHorizontal: 16, paddingTop: 28, paddingBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 12 }}>
                  {podium.map((col) => (
                    <View key={col.rank} style={{ alignItems: 'center', gap: 6 }}>
                      <View>
                        {col.rank === 1 && (
                          <Text style={{ position: 'absolute', top: -18, alignSelf: 'center', left: 0, right: 0, textAlign: 'center', fontSize: 16 }}>👑</Text>
                        )}
                        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 20 }}>{col.m.emoji}</Text>
                        </View>
                      </View>
                      <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 11, fontWeight: '800', color: '#111111', maxWidth: 80 }} numberOfLines={1}>
                        {col.m.name.split(' ')[0]}
                      </Text>
                      <View style={{ width: 80, height: col.height, borderTopLeftRadius: 12, borderTopRightRadius: 12, backgroundColor: col.bg, borderWidth: 1, borderColor: col.border, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, fontWeight: '800', color: col.color }}>{col.label}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Show-up race */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14 }}>
                <Text style={SECTION_LABEL}>Show-up race</Text>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, fontWeight: '700', color: '#FB923C' }}>last 30 days</Text>
              </View>

              {members.map((m, i) => {
                const rate = m.score.attendance_rate || 0
                const tags = getMemberTags(m.score) as Tag[]
                const bar = MEMBER_BAR[i] || ['#94A3B8', '#CBD5E1']
                const streak = (m.score.streak || []).slice(0, 7)
                return (
                  <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginBottom: 16 }}>
                    {/* Rank */}
                    <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, fontWeight: '800', width: 16, textAlign: 'center', color: i < 3 ? '#FB923C' : '#CCCCCC' }}>{i + 1}</Text>

                    {/* Avatar */}
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center', borderWidth: m.isYou ? 2.5 : 2, borderColor: m.isYou ? '#111111' : '#E5E7EB' }}>
                      <Text style={{ fontSize: 24 }}>{m.emoji}</Text>
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
                        <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, fontWeight: '800', color: '#111111', letterSpacing: -0.2 }}>{m.name}</Text>
                        {m.isYou && (
                          <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: '#FEF3C7' }}>
                            <Text style={{ fontSize: 9, fontWeight: '700', fontFamily: 'Inter_700Bold', color: '#92400E' }}>You</Text>
                          </View>
                        )}
                        {tags.map((tag) => (
                          <View key={tag.label} style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: tag.bg }}>
                            <Text style={{ fontSize: 9, fontWeight: '700', fontFamily: 'Inter_700Bold', color: tag.color }}>{tag.label}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Attendance bar */}
                      <View style={{ height: 7, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 999, overflow: 'hidden', marginBottom: 5 }}>
                        <View style={{ height: '100%', width: `${rate}%`, borderRadius: 999, backgroundColor: bar[0] }} />
                      </View>

                      {/* Streak dots */}
                      <View style={{ flexDirection: 'row', gap: 3 }}>
                        {(streak.length ? streak : Array(7).fill(false)).slice(0, 7).map((hit, j) => (
                          <View key={j} style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: hit ? '#34D399' : '#E5E7EB' }} />
                        ))}
                      </View>
                    </View>

                    {/* Percentage */}
                    <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, fontWeight: '800', minWidth: 44, textAlign: 'right', color: MEMBER_COLORS[i] || '#AAAAAA' }}>
                      {rate ? `${rate}%` : '—'}
                    </Text>
                  </View>
                )
              })}
            </>
          )}
        </Animated.ScrollView>
      )}

      <AppHeader scrollY={scrollY} />
    </View>
  )
}
