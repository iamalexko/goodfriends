// Shared low-level components used across all screens

export function NavBar({ active, navigate }) {
  const items = [
    { id: 'home',    icon: 'ti-home',     label: 'home' },
    { id: 'crew',    icon: 'ti-users',    label: 'crew' },
    { id: 'create',  icon: null,          label: 'plan', fab: true },
    { id: 'plans',   icon: 'ti-calendar', label: 'plans' },
    { id: 'profile', icon: 'ti-user',     label: 'profile' },
  ]
  return (
    <>
      {/* Mobile bottom nav */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex justify-around items-center py-2 border-t border-black/[0.06] bg-[rgba(255,251,245,0.95)] backdrop-blur-xl"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      >
        {items.map(item => item.fab ? (
          <div key="fab" className="flex flex-col items-center -mt-2">
            <button
              onClick={() => navigate('create')}
              className="w-[50px] h-[50px] rounded-full bg-ink flex items-center justify-center border-[3px] border-base shadow-lg"
            >
              <i className="ti ti-plus text-white text-xl" />
            </button>
            <span className="text-[9px] font-semibold text-[#ccc] mt-1">plan</span>
          </div>
        ) : (
          <button key={item.id} onClick={() => navigate(item.id)} className="flex flex-col items-center gap-1 px-3 py-1">
            <i className={`ti ${item.icon} text-xl ${active === item.id ? 'text-ink' : 'text-[#ccc]'}`} />
            <span className={`text-[9px] font-semibold ${active === item.id ? 'text-ink' : 'text-[#ccc]'}`}>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Desktop sidebar nav */}
      <div className="hidden md:flex fixed left-0 top-0 bottom-0 w-[220px] flex-col gap-1 px-4 py-8 border-r border-black/[0.06] bg-[#FFFBF5] z-50">
        <div className="font-display text-[20px] font-black italic text-ink mb-8 px-3">Goodfriends.</div>
        {items.map(item => item.fab ? (
          <button
            key="fab"
            onClick={() => navigate('create')}
            className="flex items-center gap-3 px-3 py-3 bg-ink text-white rounded-[12px] font-semibold text-[14px] mt-2 mb-2"
          >
            <i className="ti ti-plus text-lg" />
            New plan
          </button>
        ) : (
          <button
            key={item.id}
            onClick={() => navigate(item.id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[14px] font-semibold transition-colors ${active === item.id ? 'bg-black/[0.06] text-ink' : 'text-[#aaa] hover:text-ink hover:bg-black/[0.03]'}`}
          >
            <i className={`ti ${item.icon} text-lg`} />
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}

export function EmojiAvatar({ emoji = '😎', size = 'md', isYou = false, onClick }) {
  const sizes = { sm: 'w-8 h-8 text-lg', md: 'w-11 h-11 text-2xl', lg: 'w-14 h-14 text-4xl' }
  return (
    <div
      onClick={onClick}
      className={`${sizes[size]} rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 relative ${onClick ? 'cursor-pointer' : ''}`}
    >
      {emoji}
      {isYou && <div className="absolute inset-[-3px] rounded-full border-[3px] border-primary pointer-events-none" />}
    </div>
  )
}

export function Pill({ children, variant = 'neutral' }) {
  const variants = {
    gold:    'bg-[#FFFBEB] text-[#78350F]',
    orange:  'bg-primary text-white',
    mint:    'bg-[#DCFCE7] text-[#166534]',
    violet:  'bg-[#EEF2FF] text-[#3730A3]',
    pink:    'bg-[#FDF2F8] text-[#9D174D]',
    yellow:  'bg-[#FEF3C7] text-[#92400E]',
    neutral: 'bg-gray-100 text-gray-500',
    red:     'bg-red-50 text-red-700',
  }
  return (
    <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full ${variants[variant]}`}>
      {children}
    </span>
  )
}

export function BackButton({ onClick }) {
  return (
    <button onClick={onClick} className="w-[34px] h-[34px] rounded-full bg-black/5 flex items-center justify-center flex-shrink-0">
      <i className="ti ti-arrow-left text-ink text-base" />
    </button>
  )
}

export function SectionHeader({ children, action, onAction }) {
  return (
    <div className="flex items-center justify-between px-5 mb-3">
      <span className="text-[10px] font-bold tracking-widest uppercase text-[#bbb]">{children}</span>
      {action && <button onClick={onAction} className="text-[10px] font-bold text-primary">{action}</button>}
    </div>
  )
}

export function Divider() {
  return <div className="h-px bg-black/[0.06] mx-5" />
}

export function Orb({ color, size, top, right, bottom, left, opacity = 0.5 }) {
  return (
    <div className="orb" style={{
      width: size, height: size,
      background: color,
      top, right, bottom, left,
      opacity,
    }} />
  )
}

export function StatCell({ value, label, color = 'text-ink' }) {
  return (
    <div className="bg-white/80 backdrop-blur border border-black/[0.06] rounded-2xl py-3 px-2 text-center">
      <div className={`font-display text-[22px] font-black leading-none ${color}`}>{value}</div>
      <div className="text-[9px] font-semibold uppercase tracking-wider text-[#bbb] mt-1">{label}</div>
    </div>
  )
}
