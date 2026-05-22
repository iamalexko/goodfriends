// Shared low-level components used across all screens

export function NavBar({ active, navigate }) {
  const items = [
    { id: 'home',        icon: 'ti-home',     label: 'home' },
    { id: 'crew',        icon: 'ti-users',    label: 'crew' },
    { id: 'create',      icon: null,          label: 'plan', fab: true },
    { id: 'plans',       icon: 'ti-calendar', label: 'plans' },
    { id: 'profile',     icon: 'ti-user',     label: 'profile' },
  ]
  return (
    <div className="flex justify-around items-center py-2.5 pb-7 border-t border-black/[0.06] bg-[rgba(255,251,245,0.95)] backdrop-blur-xl z-10">
      {items.map(item => item.fab ? (
        <div key="fab" className="flex flex-col items-center gap-1 -mt-2.5">
          <button
            onClick={() => navigate('create')}
            className="w-[50px] h-[50px] rounded-full bg-ink flex items-center justify-center border-[3px] border-base"
          >
            <i className="ti ti-plus text-white text-xl" />
          </button>
          <span className="text-[9px] font-semibold text-[#ccc] mt-1">plan</span>
        </div>
      ) : (
        <button key={item.id} onClick={() => navigate(item.id)} className="flex flex-col items-center gap-1 px-2.5">
          <i className={`ti ${item.icon} text-xl ${active === item.id ? 'text-ink' : 'text-[#ccc]'}`} />
          <span className={`text-[9px] font-semibold ${active === item.id ? 'text-ink' : 'text-[#ccc]'}`}>{item.label}</span>
        </button>
      ))}
    </div>
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
