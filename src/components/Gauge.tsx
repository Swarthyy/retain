const serif = "'Cormorant Garamond', Georgia, serif"
const sans = "'Inter', sans-serif"

interface GaugeProps {
  days: number
  target: number
  label?: string
  size?: number
}

export default function Gauge({ days, target, label, size = 210 }: GaugeProps) {
  const r = size / 2 - 14
  const circ = 2 * Math.PI * r
  const pct = target > 0 ? Math.min(1, days / target) : 0
  const offset = circ * (1 - pct)
  const angle = -Math.PI / 2 + 2 * Math.PI * pct
  const ex = size / 2 + r * Math.cos(angle)
  const ey = size / 2 + r * Math.sin(angle)
  const gid = `gg${size}`

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} overflow="visible" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D4A76A" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#D4A76A" />
        </linearGradient>
        <filter id={`${gid}glow`}>
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e1208" strokeWidth="10" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)', filter: `url(#${gid}glow)` }}
      />
      {pct > 0.02 && (
        <circle cx={ex} cy={ey} r="6" fill="#D4A76A" style={{ filter: 'drop-shadow(0 0 6px #D4A76A)' }} />
      )}
      <text x={size / 2} y={size / 2 - 12} textAnchor="middle" fontFamily={serif} fontStyle="italic" fontSize={days >= 100 ? 50 : 62} fontWeight="400" fill="#EFE4CF">
        {days}
      </text>
      <text x={size / 2} y={size / 2 + 18} textAnchor="middle" fontFamily={sans} fontSize="11" fill="#906e50" letterSpacing="2">
        {(days === 1 ? 'DAY' : 'DAYS')} RETAINED
      </text>
      {label && (
        <text x={size / 2} y={size / 2 + 36} textAnchor="middle" fontFamily={sans} fontSize="10" fill="#4a3322" letterSpacing="1">
          {label}
        </text>
      )}
    </svg>
  )
}
