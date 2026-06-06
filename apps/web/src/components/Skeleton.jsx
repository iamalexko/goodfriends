// Tier 2 — routine loads. Warm-grey skeletons that mirror each screen's layout
// so content fills in instead of popping onto a blank screen. Fill breathes
// #F3EFE7 <-> #E9E2D6 (warm, never cold grey) via the .gf-skeleton class
// (see index.css). Mirror of apps/mobile/components/Skeleton.tsx.

export function SkeletonBlock({ width = '100%', height = 12, radius = 8, style, className = '' }) {
  return (
    <div
      className={`gf-skeleton ${className}`}
      style={{ width, height, borderRadius: radius, ...style }}
    />
  )
}

export function SkeletonText({ width = '100%', height = 12, style }) {
  return <SkeletonBlock width={width} height={height} radius={height / 2} style={style} />
}

export function SkeletonStat() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <SkeletonBlock width={36} height={22} radius={7} />
      <SkeletonBlock width={50} height={9} radius={4} />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
      <SkeletonBlock width={38} height={38} radius={19} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <SkeletonBlock width="55%" height={12} radius={6} />
        <SkeletonBlock width="32%" height={9} radius={4} />
      </div>
      <SkeletonBlock width={52} height={22} radius={999} />
    </div>
  )
}

// Mirrors a plan card (white island, name + meta + faces row).
export function SkeletonCard() {
  return (
    <div
      style={{
        marginBottom: 10,
        padding: 14,
        borderRadius: 16,
        background: '#FFFFFF',
        border: '1px solid rgba(0,0,0,0.05)',
      }}
    >
      <SkeletonBlock width="62%" height={16} radius={7} />
      <SkeletonBlock width="44%" height={12} radius={6} style={{ marginTop: 10 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
        <SkeletonBlock width={24} height={24} radius={12} />
        <SkeletonBlock width={24} height={24} radius={12} />
        <SkeletonBlock width={64} height={10} radius={5} style={{ marginLeft: 4 }} />
      </div>
    </div>
  )
}

// Convenience: a stack of N plan-card skeletons (the common screen-load case).
export function SkeletonCardList({ count = 3 }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
