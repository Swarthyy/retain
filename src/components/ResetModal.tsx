'use client'

import { dayWord } from '@/lib/utils'

export type ResetEventType = 'lapse' | 'conscious' | 'triumph' | null
export type ResetModalFlow = 'type' | 'preview' | 'triumph' | 'record'

interface Props {
  days: number
  best: number
  liveVolume: number
  bingeCount: number
  flow: ResetModalFlow
  eventType: ResetEventType
  isRecord: boolean
  volumeAfter: number
  penalty: number
  penaltyRate: number
  triumphMsg: string
  onSelectType: (t: ResetEventType) => void
  onConfirm: () => void
  onConfirmTriumph: () => void
  onCancel: () => void
  onBeginAgain: () => void
}

const modalBase: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(180deg, #060302 0%, #0d0a07 100%)',
  zIndex: 100,
  padding: '60px 28px 40px',
  display: 'flex',
  flexDirection: 'column',
  animation: 'fadeIn 0.2s ease',
}

export default function ResetModal({
  days, best, liveVolume, bingeCount, flow, eventType,
  isRecord, volumeAfter, penalty, penaltyRate, triumphMsg,
  onSelectType, onConfirm, onConfirmTriumph, onCancel, onBeginAgain,
}: Props) {

  /* ── Step 1: Choose event type ── */
  if (flow === 'type') {
    return (
      <div style={modalBase}>
        <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700, color: '#906e50' }}>Log an event</div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>

          {/* Triumph — positive, no reset */}
          <button
            onClick={() => onSelectType('triumph')}
            style={{
              background: 'rgba(212,167,106,0.10)',
              border: '1px solid rgba(212,167,106,0.35)',
              borderRadius: 18, padding: '18px 20px',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 800, color: '#D4A76A', fontFamily: 'var(--font-inter)', marginBottom: 5 }}>
              ♦ Triumph
            </div>
            <div style={{ fontSize: 12, color: '#906e50', lineHeight: 1.6 }}>
              Partnered intimacy, successfully retained. <span style={{ color: '#D4A76A' }}>Streak holds. Reservoir holds.</span> The highest act.
            </div>
          </button>

          {/* Conscious — intentional, resets streak */}
          <button
            onClick={() => onSelectType('conscious')}
            style={{
              background: 'rgba(139,94,110,0.10)',
              border: '1px solid rgba(139,94,110,0.25)',
              borderRadius: 18, padding: '18px 20px',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 800, color: '#C49AAA', fontFamily: 'var(--font-inter)', marginBottom: 5 }}>
              ○ Conscious choice
            </div>
            <div style={{ fontSize: 12, color: '#906e50', lineHeight: 1.6 }}>
              Partnered, intentional. Respect is maintained. <span style={{ color: '#C49AAA' }}>Streak resets. Reservoir drains.</span> Circle will know.
            </div>
          </button>

          {/* Lapse — fall */}
          <button
            onClick={() => onSelectType('lapse')}
            style={{
              background: 'rgba(180,60,40,0.08)',
              border: '1px solid rgba(180,60,40,0.25)',
              borderRadius: 18, padding: '18px 20px',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 800, color: '#e05555', fontFamily: 'var(--font-inter)', marginBottom: 5 }}>
              ⚡ Lapse
            </div>
            <div style={{ fontSize: 12, color: '#906e50', lineHeight: 1.6 }}>
              Solo compulsion. <span style={{ color: '#e05555' }}>Streak resets. Reservoir drains.</span> The circle will be notified. Total accountability.
            </div>
          </button>

        </div>

        <button
          onClick={onCancel}
          style={{ width: '100%', minHeight: 50, background: 'transparent', color: '#4a3322', fontFamily: 'var(--font-inter)', fontSize: 14, border: '1px solid rgba(239,228,207,0.1)', borderRadius: 14, cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    )
  }

  /* ── Triumph celebration ── */
  if (flow === 'triumph') {
    return (
      <div style={modalBase}>
        <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700, color: '#D4A76A' }}>Triumph</div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', gap: 20 }}>
          <div style={{ fontSize: 48, animation: 'goldPulse 2s ease-in-out infinite' }}>♦</div>
          <div style={{ fontFamily: 'var(--font-cormorant)', fontStyle: 'italic', fontSize: 34, color: '#D4A76A', lineHeight: 1.2, animation: 'goldPulse 3s ease-in-out infinite' }}>
            The streak holds.
          </div>
          <div style={{ fontSize: 13, color: '#906e50', lineHeight: 1.7, maxWidth: 280, margin: '0 auto' }}>
            {triumphMsg}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', padding: '14px 0', borderTop: '1px solid rgba(212,167,106,0.12)', borderBottom: '1px solid rgba(212,167,106,0.12)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: '#4a3322', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Streak</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#D4A76A' }}>{days}</div>
              <div style={{ fontSize: 9, color: '#906e50' }}>unchanged</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: '#4a3322', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Reservoir</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#D4A76A' }}>{liveVolume}</div>
              <div style={{ fontSize: 9, color: '#906e50' }}>untouched</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onConfirmTriumph}
            style={{ width: '100%', minHeight: 54, background: '#D4A76A', color: '#060302', fontFamily: 'var(--font-inter)', fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 14, cursor: 'pointer' }}
          >
            Log triumph ♦
          </button>
          <button
            onClick={onCancel}
            style={{ width: '100%', minHeight: 46, background: 'transparent', color: '#4a3322', fontFamily: 'var(--font-inter)', fontSize: 13, border: 'none', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  /* ── Penalty preview (lapse / conscious) ── */
  if (flow === 'preview') {
    const pctDisplay = Math.round(penaltyRate * 100)
    const isLapse = eventType === 'lapse'
    const isBinge = bingeCount > 1
    const accentColor = isLapse ? '#e05555' : '#C49AAA'
    const accentBg = isLapse ? 'rgba(180,60,40,0.10)' : 'rgba(139,94,110,0.10)'

    return (
      <div style={modalBase}>
        <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700, color: accentColor }}>
          {isLapse ? '⚡ Lapse · Preview' : '○ Conscious · Preview'}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ marginBottom: 22, fontSize: 13, color: '#906e50' }}>
            You're ending a{' '}
            <span style={{ color: '#EFE4CF', fontWeight: 700 }}>{days}-{dayWord(days)}</span> streak.
          </div>

          <div style={{ background: accentBg, border: `1px solid ${accentColor}33`, borderRadius: 16, padding: '18px 20px' }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: '#906e50', textTransform: 'uppercase', marginBottom: 14, fontWeight: 700 }}>
              Reservoir impact
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: '#4a3322', letterSpacing: 1 }}>BEFORE</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#D4A76A', lineHeight: 1 }}>{liveVolume}</div>
              </div>
              <div style={{ fontSize: 22, color: '#4a3322', padding: '0 8px' }}>→</div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#4a3322', letterSpacing: 1 }}>AFTER</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: accentColor, lineHeight: 1 }}>{volumeAfter}</div>
              </div>
            </div>

            <div style={{ height: 6, borderRadius: 999, background: '#1e1208', marginBottom: 10 }}>
              <div style={{
                height: '100%', borderRadius: 999,
                width: `${Math.max(0, 100 - pctDisplay)}%`,
                background: isLapse
                  ? 'linear-gradient(90deg,#9B3030,#e05555)'
                  : 'linear-gradient(90deg,#7A4E5C,#C49AAA)',
                transition: 'width 0.6s ease',
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: accentColor }}>−{penalty} drained ({pctDisplay}%)</span>
              {isBinge && (
                <span style={{ fontSize: 10, color: '#e05555', fontWeight: 700 }}>⚠ BINGE ×{bingeCount}</span>
              )}
            </div>

            {isBinge && (
              <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(180,60,40,0.1)', borderRadius: 10, fontSize: 11, color: '#e05555', lineHeight: 1.5 }}>
                Consecutive resets within 14 days escalate the drain. The cost compounds.
              </div>
            )}
          </div>

          {!isLapse && (
            <div style={{ marginTop: 12, fontSize: 11, color: '#4a3322', lineHeight: 1.6, textAlign: 'center' }}>
              A conscious choice is still public. Your circle will witness this.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onConfirm}
            style={{ width: '100%', minHeight: 54, background: isLapse ? '#e05555' : '#C49AAA', color: '#060302', fontFamily: 'var(--font-inter)', fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 14, cursor: 'pointer' }}
          >
            {isLapse ? 'Confirm lapse' : 'Confirm reset'}
          </button>
          <button
            onClick={onCancel}
            style={{ width: '100%', minHeight: 46, background: 'transparent', color: '#4a3322', fontFamily: 'var(--font-inter)', fontSize: 14, border: 'none', cursor: 'pointer' }}
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  /* ── Post-reset record (lapse / conscious) ── */
  if (isRecord) {
    return (
      <div style={modalBase}>
        <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700, color: '#D4A76A' }}>A new best</div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-cormorant)', fontStyle: 'italic', fontSize: 130, color: '#D4A76A', lineHeight: 0.95, letterSpacing: -4, textShadow: '0 0 40px rgba(212,167,106,0.3)' }}>
            {days}
          </div>
          <div style={{ fontSize: 16, color: '#EFE4CF', fontWeight: 700, marginTop: 12 }}>
            {dayWord(days)}. A new longest.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18 }}>
            <div style={{ width: 36, height: 1, background: '#906e50', opacity: 0.3 }} />
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#D4A76A' }} />
            <div style={{ width: 36, height: 1, background: '#906e50', opacity: 0.3 }} />
          </div>
          <div style={{ fontSize: 13, color: '#906e50', marginTop: 18, lineHeight: 1.6 }}>
            Previous best <span style={{ color: '#EFE4CF', fontWeight: 700 }}>{best}</span>. You've written a new line.
          </div>
          <div style={{ marginTop: 28, padding: '14px 20px', background: 'rgba(239,228,207,0.05)', border: '1px solid rgba(239,228,207,0.1)', borderRadius: 14, width: '100%' }}>
            <div style={{ fontSize: 10, color: '#906e50', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Reservoir holds at</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#D4A76A', lineHeight: 1 }}>{volumeAfter}</div>
          </div>
        </div>
        <button onClick={onBeginAgain} style={{ width: '100%', minHeight: 54, background: '#EFE4CF', color: '#060302', fontFamily: 'var(--font-inter)', fontSize: 16, fontWeight: 700, border: 'none', borderRadius: 14, cursor: 'pointer' }}>
          Begin again
        </button>
      </div>
    )
  }

  return (
    <div style={modalBase}>
      <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700, color: '#906e50' }}>Reset</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-cormorant)', fontStyle: 'italic', fontSize: 56, color: '#EFE4CF', lineHeight: 1.1, marginBottom: 12 }}>
          Back to zero.
        </div>
        <div style={{ fontSize: 14, color: '#906e50', lineHeight: 1.6 }}>
          You held for <span style={{ color: '#EFE4CF', fontWeight: 700 }}>{days} {dayWord(days)}</span>.{' '}
          Best remains <span style={{ color: '#EFE4CF', fontWeight: 700 }}>{best}</span>.
        </div>
        <div style={{ marginTop: 28, padding: '14px 20px', background: 'rgba(239,228,207,0.05)', border: '1px solid rgba(239,228,207,0.1)', borderRadius: 14, width: '100%' }}>
          <div style={{ fontSize: 10, color: '#906e50', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Reservoir holds at</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#D4A76A', lineHeight: 1 }}>{volumeAfter}</div>
        </div>
      </div>
      <button onClick={onBeginAgain} style={{ width: '100%', minHeight: 54, background: '#EFE4CF', color: '#060302', fontFamily: 'var(--font-inter)', fontSize: 16, fontWeight: 700, border: 'none', borderRadius: 14, cursor: 'pointer' }}>
        Begin again
      </button>
    </div>
  )
}
