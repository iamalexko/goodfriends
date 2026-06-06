// Tier 3 — RESERVED for deliberate brand moments only (e.g. AI summary
// generation). Ink dot with the cream negative-space smile drawing in and out,
// looping. Do NOT use for routine fetches — those are Tier 2 skeletons. Keep it
// rare so it stays meaningful. Mirror of apps/mobile/components/BrandLoader.tsx.

export function BrandLoader({ size = 96, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <svg width={size} height={size} viewBox="0 0 1024 1024">
        <circle cx={512} cy={512} r={300} fill="#111111" />
        <path
          className="gf-smile"
          d="M 362 532 Q 512 682 662 532"
          fill="none"
          stroke="#FFFBF5"
          strokeWidth={86}
          strokeLinecap="round"
        />
      </svg>
      {label ? (
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#888888' }}>{label}</div>
      ) : null}
    </div>
  )
}

// Button busy state — a tiny breathing ink dot (not a spinner, not the full
// smile-draw). Pair with the existing busy text ("Saving…", "Generating…").
export function BreathingDot({ size = 6, color = '#FFFFFF' }) {
  return (
    <span
      className="gf-breathe"
      style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: color }}
    />
  )
}
