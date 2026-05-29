// Tag derivations. Per-member tags consume a `score` row from member_scores;
// group tags consume aggregate stats. Both are capped at a small number
// of chips so the row stays scannable.

export function getMemberTags(score) {
  const tags = []
  const rate      = score?.attendance_rate || 0
  const organised = score?.plans_organised || 0
  const attended  = score?.total_attended  || 0
  const streak    = score?.streak || []

  if (organised >= 5)
    tags.push({ label: 'master planner', bg: '#EEF2FF', color: '#3730A3' })
  if (rate >= 85 && attended >= 5)
    tags.push({ label: 'always shows up', bg: '#DCFCE7', color: '#166534' })

  const currentStreak = streak.slice(-3).every(Boolean)
  if (currentStreak && attended >= 3)
    tags.push({ label: 'on a streak 🔥', bg: '#F0FDF4', color: '#166534' })

  if (rate >= 40 && rate < 70)
    tags.push({ label: 'wildcard', bg: '#FDF4FF', color: '#7E22CE' })
  if (score?.last_minute_saves >= 3)
    tags.push({ label: 'last-min legend', bg: '#FEF3C7', color: '#92400E' })

  // "new here" supersedes everything else for very-new members.
  if (attended < 3)
    return [{ label: 'new here', bg: '#E6F1FB', color: '#185FA5' }]

  return tags.slice(0, 2)
}

export function getGroupTags(avgAttendance, totalPlans) {
  const tags = []

  if (avgAttendance >= 80)
    tags.push({ label: 'always shows up', bg: '#DCFCE7', color: '#166534' })
  if (totalPlans >= 10)
    tags.push({ label: 'big planners', bg: '#FFFBEB', color: '#78350F' })

  // Fallback so the chip row is never empty.
  if (tags.length === 0)
    tags.push({ label: 'Dubai crew', bg: '#F3F4F6', color: '#6B7280' })

  return tags.slice(0, 3)
}
