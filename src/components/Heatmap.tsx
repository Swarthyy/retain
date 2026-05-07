'use client'

import { getCurrentDays } from '@/lib/utils'

export type DayType = 'triumph' | 'conscious' | 'lapse'
export type DailyLogMap = Record<string, DayType>  // key: 'YYYY-MM-DD'

const TYPE_COLOR: Record<DayType, string> = {
  triumph:  '#C2557A',  // rose-crimson
  conscious:'#7A4E5C',  // muted dusty rose
  lapse:    '#1e1208',  // near-black
}

const RETAINED_FULL  = '#D4A76A'
const RETAINED_FADE  = '#6b4420'
const EMPTY          = '#130C07'

function cellColor(daysAgo: number, streakDays: number, logEntry: DayType | undefined): string {
  if (logEntry) return TYPE_COLOR[logEntry]
  if (daysAgo < streakDays) return RETAINED_FULL
  if (daysAgo < streakDays + 4) return RETAINED_FADE
  return EMPTY
}

interface HeatmapProps {
  streakStart: string
  dailyLog?: DailyLogMap
}

export default function Heatmap({ streakStart, dailyLog = {} }: HeatmapProps) {
  const WEEKS = 52, DAYS = 7, CELL = 11, GAP = 3
  const total = WEEKS * DAYS
  const streakDays = getCurrentDays(streakStart)

  // Build date map: for each cell index, compute the date string
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const cells: string[] = []
  for (let i = 0; i < total; i++) {
    const dAgo = total - 1 - i
    const dt = new Date(today)
    dt.setDate(today.getDate() - dAgo)
    const dateKey = dt.toISOString().split('T')[0]
    cells.push(cellColor(dAgo, streakDays, dailyLog[dateKey]))
  }

  const W = WEEKS * (CELL + GAP) - GAP
  const H = DAYS * (CELL + GAP) - GAP
  const months = ['J','F','M','A','M','J','J','A','S','O','N','D']

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <svg width={W} height={H + 14} viewBox={`0 0 ${W} ${H + 14}`}>
        <g transform="translate(0,14)">
          {months.map((m, i) => (
            <text key={i} x={Math.round((i / 12) * W)} y="-4" fontFamily="var(--font-inter)" fontSize="9" fill="#4a3322">{m}</text>
          ))}
          {Array.from({ length: WEEKS }, (_, wi) =>
            Array.from({ length: DAYS }, (_, di) => {
              const idx = wi * DAYS + di
              return (
                <rect
                  key={`${wi}-${di}`}
                  x={wi * (CELL + GAP)}
                  y={di * (CELL + GAP)}
                  width={CELL}
                  height={CELL}
                  rx="2"
                  fill={cells[idx]}
                />
              )
            })
          )}
        </g>
      </svg>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
        {([
          { color: RETAINED_FULL, label: 'Retained' },
          { color: TYPE_COLOR.triumph, label: 'Triumph' },
          { color: TYPE_COLOR.conscious, label: 'Conscious' },
          { color: TYPE_COLOR.lapse, label: 'Lapse' },
        ] as const).map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
            <span style={{ fontSize: 9, color: '#4a3322', letterSpacing: 0.5 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
