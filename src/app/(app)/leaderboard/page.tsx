'use client'

import { useEffect, useMemo, useState } from 'react'
import { createCircle, getCircleLeaderboard, getSessionProfile, joinCircle } from '@/lib/app-data'
import { dayWord, masteryClass, rankTitle } from '@/lib/utils'
import Avatar from '@/components/Avatar'
import type { Circle, LeaderboardEntry } from '@/lib/types'

type WeightClass = 'vanguard' | 'heavyweights' | 'sharpshooters'
type SortMode = 'current' | 'best'

const Crown = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ verticalAlign: 'middle' }}>
    <path d="M8 1l2.1 4.3L15 6.3l-3.5 3.4.83 4.8L8 12.1 3.67 14.5l.83-4.8L1 6.3l4.9-.01L8 1z" fill="#D4A76A" stroke="#D4A76A" strokeWidth="0.5" strokeLinejoin="round" />
  </svg>
)

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [weightClass, setWeightClass] = useState<WeightClass>('vanguard')
  const [sortMode, setSortMode] = useState<SortMode>('current')
  const [myId, setMyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [circle, setCircle] = useState<Circle | null>(null)
  const [copied, setCopied] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const session = await getSessionProfile()
      setMyId(session?.userId || '')
      const result = await getCircleLeaderboard('circle')
      setEntries(result.entries)
      setCircle(result.circle)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load leaderboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const sorted = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (weightClass === 'vanguard') {
        if (sortMode === 'current') return b.current - a.current || a.username.localeCompare(b.username)
        return b.best - a.best || a.username.localeCompare(b.username)
      }
      if (weightClass === 'heavyweights') return b.liveVolume - a.liveVolume || a.username.localeCompare(b.username)
      if (a.masteryPct === null && b.masteryPct === null) return a.username.localeCompare(b.username)
      if (a.masteryPct === null) return 1
      if (b.masteryPct === null) return -1
      return b.masteryPct - a.masteryPct || b.partneredCount - a.partneredCount
    })
  }, [entries, weightClass, sortMode])

  const crownHolderId = weightClass === 'vanguard' && sorted.length > 0 ? sorted[0].user_id : null
  const myRank = sorted.findIndex(e => e.user_id === myId) + 1
  const me = sorted.find(e => e.user_id === myId)

  async function makeCircle() {
    setError('')
    try {
      const next = await createCircle()
      setCircle(next)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create circle.')
    }
  }

  async function enterCircle() {
    if (joinCode.trim().length !== 6) return
    setError('')
    try {
      await joinCircle(joinCode)
      setJoinCode('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join circle.')
    }
  }

  function copyCode() {
    if (!circle) return
    const inviteUrl = `${window.location.origin}/join/${circle.invite_code}`
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #D4A76A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ padding: '50px 0 24px' }}>
      {circle ? (
        <div style={{ padding: '0 20px 12px' }}>
          <div style={{ background: 'linear-gradient(135deg,rgba(212,167,106,0.18),rgba(239,228,207,0.04))', border: '1px solid rgba(212,167,106,0.24)', borderRadius: 18, padding: 16, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 90% 0%, rgba(212,167,106,0.18), transparent 38%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 10, color: '#906e50', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 7 }}>Circle leaderboard</div>
                <div style={{ color: '#EFE4CF', fontSize: 21, fontWeight: 900, lineHeight: 1.1 }}>{circle.name}</div>
                <div style={{ color: '#4a3322', fontSize: 12, marginTop: 6 }}>{sorted.length} ranked</div>
              </div>
              <button onClick={() => setInviteOpen(true)} style={{ minWidth: 96, minHeight: 48, background: '#D4A76A', color: '#060302', border: 'none', borderRadius: 14, fontFamily: 'var(--font-inter)', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}>
                Invite
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 20px 14px' }}>
          <div style={{ background: 'rgba(239,228,207,0.05)', border: '1px solid rgba(239,228,207,0.1)', borderRadius: 14, padding: 16 }}>
            <div style={{ color: '#EFE4CF', fontSize: 16, fontWeight: 800, marginBottom: 6 }}>No circle yet</div>
            <div style={{ color: '#906e50', fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>Create a private leaderboard or join with a friend&apos;s code.</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="CODE" maxLength={6} style={{ flex: 1, background: '#1e1208', border: '1px solid rgba(239,228,207,0.15)', borderRadius: 10, color: '#D4A76A', padding: '0 12px', letterSpacing: 4, fontWeight: 800 }} />
              <button onClick={enterCircle} style={{ minWidth: 58, background: '#D4A76A', color: '#060302', border: 'none', borderRadius: 10, fontWeight: 800 }}>Join</button>
            </div>
            <button onClick={makeCircle} style={{ marginTop: 10, width: '100%', minHeight: 42, background: 'transparent', color: '#EFE4CF', border: '1px solid rgba(239,228,207,0.2)', borderRadius: 10 }}>Create a circle</button>
          </div>
        </div>
      )}

      {error && <div style={{ padding: '0 20px 10px', color: '#e05555', fontSize: 12 }}>{error}</div>}

      <div style={{ padding: '0 20px 12px' }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(239,228,207,0.04)', border: '1px solid rgba(239,228,207,0.07)', borderRadius: 14, padding: 4 }}>
          {([
            { key: 'vanguard', label: 'Current streak' },
            { key: 'heavyweights', label: 'Total volume' },
            { key: 'sharpshooters', label: 'Mastery rate' },
          ] as { key: WeightClass; label: string }[]).map(({ key, label }) => {
            const active = weightClass === key
            return (
              <button key={key} onClick={() => setWeightClass(key)} style={{ flex: 1, minHeight: 40, background: active ? '#EFE4CF' : 'transparent', color: active ? '#060302' : '#5b3d25', fontFamily: 'var(--font-inter)', fontSize: 10, fontWeight: active ? 900 : 600, border: 'none', borderRadius: 10, cursor: 'pointer' }}>
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {weightClass === 'vanguard' && (
        <div style={{ padding: '0 20px 12px', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setSortMode(s => s === 'current' ? 'best' : 'current')} style={{ padding: '7px 13px', background: 'rgba(212,167,106,0.08)', border: '1px solid rgba(212,167,106,0.18)', borderRadius: 999, color: '#D4A76A', fontFamily: 'var(--font-inter)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            {sortMode === 'current' ? 'Current streak' : 'All-time best'}
          </button>
        </div>
      )}

      {me && (
        <div style={{ margin: '0 20px 14px', background: 'linear-gradient(135deg,rgba(212,167,106,0.15),rgba(239,228,207,0.05))', border: '1px solid rgba(212,167,106,0.25)', borderRadius: 18, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 0 28px rgba(212,167,106,0.08)' }}>
          <Avatar name={me.username} size={44} gold={myRank <= 3} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: '#906e50', letterSpacing: 2, textTransform: 'uppercase' }}>Your rank</div>
            <div style={{ fontSize: 28, color: myRank === 1 ? '#D4A76A' : '#EFE4CF', fontWeight: 800, lineHeight: 1 }}>
              #{myRank || '-'} <span style={{ fontSize: 13, fontWeight: 400, color: '#906e50' }}>of {sorted.length}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: '#906e50', letterSpacing: 2, textTransform: 'uppercase' }}>{weightClass === 'vanguard' ? 'Streak' : weightClass === 'heavyweights' ? 'Volume' : 'Mastery'}</div>
            <div style={{ fontSize: 24, color: '#D4A76A', fontWeight: 900 }}>{weightClass === 'vanguard' ? (sortMode === 'current' ? me.current : me.best) : weightClass === 'heavyweights' ? me.liveVolume : me.masteryPct === null ? '-' : `${me.masteryPct}%`}</div>
          </div>
        </div>
      )}

      {sorted.length === 0 && (
        <div style={{ padding: '34px 20px', textAlign: 'center', color: '#4a3322', fontSize: 14, lineHeight: 1.6 }}>
          No ranks available yet.
        </div>
      )}

      <div style={{ padding: '0 20px' }}>
        {sorted.map((u, i) => {
          const rankN = i + 1
          const first = rankN === 1
          const isMe = u.user_id === myId
          const isCrown = u.user_id === crownHolderId && sorted.length > 1
          return (
            <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px', minHeight: 66, borderRadius: 14, marginBottom: 8, background: isMe ? 'rgba(212,167,106,0.1)' : first ? 'rgba(212,167,106,0.07)' : 'rgba(239,228,207,0.035)', border: `1px solid ${isMe ? 'rgba(212,167,106,0.34)' : first ? 'rgba(212,167,106,0.2)' : 'rgba(239,228,207,0.08)'}`, boxShadow: first ? '0 0 20px rgba(212,167,106,0.08)' : undefined }}>
              <div style={{ width: 24, textAlign: 'center', flexShrink: 0, fontSize: 13, fontWeight: first ? 800 : 400, color: rankN <= 3 ? '#D4A76A' : '#4a3322' }}>{isCrown ? <Crown /> : rankN}</div>
              <Avatar name={u.username} size={34} gold={first} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: '#EFE4CF', fontWeight: isMe ? 800 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isMe ? 'You' : u.username}
                </div>
                <div style={{ fontSize: 10, color: '#4a3322', marginTop: 2 }}>
                  {rankTitle(u.best)} · {masteryClass(u.current, u.triumphCount, u.partneredCount)}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 20, color: isMe || first ? '#D4A76A' : '#EFE4CF', fontWeight: 800, lineHeight: 1 }}>
                  {weightClass === 'vanguard' ? (sortMode === 'current' ? u.current : u.best) : weightClass === 'heavyweights' ? u.liveVolume : u.masteryPct ?? '-'}
                </div>
                <div style={{ fontSize: 10, color: '#4a3322', marginTop: 3 }}>
                  {weightClass === 'vanguard' ? `${sortMode === 'current' ? dayWord(u.current).toUpperCase() : 'BEST'} · ${sortMode === 'current' ? `best ${u.best}d` : `${u.current}d now`}` : weightClass === 'heavyweights' ? 'VOL' : u.masteryPct === null ? 'no events' : '%'}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {inviteOpen && circle && (
        <>
          <div onClick={() => setInviteOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(6,3,2,0.72)', zIndex: 90, backdropFilter: 'blur(5px)' }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 88, zIndex: 91, maxWidth: 448, margin: '0 auto', padding: '0 20px 18px' }}>
            <div style={{ background: '#0d0a07', border: '1px solid rgba(212,167,106,0.22)', borderRadius: 20, padding: 20, boxShadow: '0 -20px 60px rgba(0,0,0,0.45)', animation: 'slideUp 0.25s ease both' }}>
              <div style={{ width: 38, height: 4, borderRadius: 999, background: '#2a1a0e', margin: '0 auto 18px' }} />
              <div style={{ fontFamily: 'var(--font-cormorant)', fontStyle: 'italic', fontSize: 29, color: '#EFE4CF', marginBottom: 6 }}>Invite someone.</div>
              <div style={{ fontSize: 13, color: '#906e50', lineHeight: 1.6, marginBottom: 18 }}>
                Send this link to a friend. They will join {circle.name} after creating their account.
              </div>
              <div style={{ background: 'rgba(239,228,207,0.045)', border: '1px solid rgba(239,228,207,0.10)', borderRadius: 14, padding: '13px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: '#4a3322', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Invite link</div>
                <div style={{ color: '#D4A76A', fontSize: 13, lineHeight: 1.4, wordBreak: 'break-all' }}>{`${window.location.origin}/join/${circle.invite_code}`}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button onClick={copyCode} style={{ minHeight: 50, background: copied ? '#4CAF50' : '#D4A76A', color: '#060302', border: 'none', borderRadius: 14, fontFamily: 'var(--font-inter)', fontSize: 14, fontWeight: 900, cursor: 'pointer' }}>
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                <button onClick={() => setInviteOpen(false)} style={{ minHeight: 50, background: 'transparent', color: '#906e50', border: '1px solid rgba(239,228,207,0.14)', borderRadius: 14, fontFamily: 'var(--font-inter)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  Done
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
