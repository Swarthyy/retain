'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentDays, rankTitle, dayWord, getLiveVolume, masteryRatio, masteryClass } from '@/lib/utils'
import Avatar from '@/components/Avatar'

type Entry = {
  user_id: string
  username: string
  current: number
  best: number
  liveVolume: number
  triumphCount: number
  partneredCount: number
  masteryPct: number | null
}
type CircleInfo = { id: string; name: string; invite_code: string }
type WeightClass = 'vanguard' | 'heavyweights' | 'sharpshooters'
type SortMode = 'current' | 'best'

const Crown = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ verticalAlign: 'middle' }}>
    <path d="M8 1l2.1 4.3L15 6.3l-3.5 3.4.83 4.8L8 12.1 3.67 14.5l.83-4.8L1 6.3l4.9-.01L8 1z" fill="#D4A76A" stroke="#D4A76A" strokeWidth="0.5" strokeLinejoin="round" />
  </svg>
)

const RELIC_CFG: Record<string, { icon: string; label: string }> = {
  iron_will:  { icon: '◈', label: 'Iron Will' },
  transmuter: { icon: '⟁', label: 'Transmuter' },
  phoenix:    { icon: '✦', label: 'Phoenix' },
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [weightClass, setWeightClass] = useState<WeightClass>('vanguard')
  const [sortMode, setSortMode] = useState<SortMode>('current')
  const [scope, setScope] = useState<'circle' | 'global'>('circle')
  const [myId, setMyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [circle, setCircle] = useState<CircleInfo | null>(null)
  const [circleMemberIds, setCircleMemberIds] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)
  const [inspectedUser, setInspectedUser] = useState<Entry | null>(null)
  const [inspectedRelics, setInspectedRelics] = useState<string[]>([])
  const [relicsLoading, setRelicsLoading] = useState(false)

  useEffect(() => {
    const uid = localStorage.getItem('retain_user_id') || ''
    setMyId(uid)
    load(uid)
  }, [])

  async function load(uid: string) {
    const { data: membership } = await supabase
      .from('circle_members')
      .select('circle_id, circles(id, name, invite_code)')
      .eq('user_id', uid)
      .maybeSingle()

    type MemberRow = { circle_id: string; circles: { id: string; name: string; invite_code: string } }
    const circleInfo = membership ? (membership as unknown as MemberRow).circles : null
    if (circleInfo) {
      setCircle(circleInfo)
      const { data: members } = await supabase
        .from('circle_members').select('user_id').eq('circle_id', circleInfo.id)
      if (members) setCircleMemberIds(new Set(members.map((r: { user_id: string }) => r.user_id)))
    }

    const { data: allData } = await supabase
      .from('streaks')
      .select('user_id, streak_start, best_days, volume_score, triumph_count, partnered_count, users(username)')

    type Row = {
      user_id: string; streak_start: string; best_days: number;
      volume_score: number; triumph_count: number; partnered_count: number
      users: { username: string }
    }
    const global: Entry[] = allData
      ? (allData as unknown as Row[]).map(r => {
          const tc = r.triumph_count || 0
          const pc = r.partnered_count || 0
          return {
            user_id: r.user_id,
            username: r.users?.username || '??',
            current: getCurrentDays(r.streak_start),
            best: r.best_days,
            liveVolume: getLiveVolume(r.volume_score || 0, r.streak_start),
            triumphCount: tc,
            partneredCount: pc,
            masteryPct: masteryRatio(tc, pc),
          }
        })
      : []

    setEntries(global)
    setLoading(false)
    if (circleInfo) setScope('circle')
    else setScope('global')
  }

  async function handleRowTap(u: Entry) {
    setInspectedUser(u)
    setInspectedRelics([])
    setRelicsLoading(true)
    const { data } = await supabase.from('relics').select('relic_type').eq('user_id', u.user_id)
    setInspectedRelics(data ? data.map((r: { relic_type: string }) => r.relic_type) : [])
    setRelicsLoading(false)
  }

  const visibleEntries = scope === 'circle' && circle
    ? entries.filter(e => circleMemberIds.has(e.user_id))
    : entries

  const sorted = [...visibleEntries].sort((a, b) => {
    if (weightClass === 'vanguard') {
      if (sortMode === 'current') return b.current - a.current || a.username.localeCompare(b.username)
      return b.best - a.best || a.username.localeCompare(b.username)
    }
    if (weightClass === 'heavyweights') {
      return b.liveVolume - a.liveVolume || a.username.localeCompare(b.username)
    }
    if (a.masteryPct === null && b.masteryPct === null) return a.username.localeCompare(b.username)
    if (a.masteryPct === null) return 1
    if (b.masteryPct === null) return -1
    return b.masteryPct - a.masteryPct || b.partneredCount - a.partneredCount
  })

  const crownHolderId = weightClass === 'vanguard' && sorted.length > 0 ? sorted[0].user_id : null
  const myRank = sorted.findIndex(e => e.user_id === myId) + 1
  const me = visibleEntries.find(e => e.user_id === myId)

  // For non-Vanguard right-column display
  function myVal(e: Entry) {
    if (weightClass === 'heavyweights') return e.liveVolume
    return e.masteryPct ?? 0
  }

  function valLabel(e: Entry) {
    if (weightClass === 'heavyweights') return 'VOL'
    if (e.masteryPct === null) return '—'
    return '%'
  }

  function myCardVal(e: Entry) {
    if (weightClass === 'vanguard') return sortMode === 'current' ? e.current : e.best
    if (weightClass === 'heavyweights') return e.liveVolume
    return e.masteryPct ?? 0
  }

  function copyCode() {
    if (!circle) return
    navigator.clipboard.writeText(circle.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const inspectedRank = inspectedUser
    ? sorted.findIndex(e => e.user_id === inspectedUser.user_id) + 1
    : 0

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #D4A76A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <>
      <div style={{ padding: '52px 0 24px' }}>

        {/* Circle / Global scope toggle */}
        {circle && (
          <div style={{ padding: '0 20px 10px' }}>
            <div style={{ display: 'flex', gap: 4, background: '#1e1208', borderRadius: 12, padding: 4 }}>
              {(['circle', 'global'] as const).map(k => {
                const active = scope === k
                return (
                  <button key={k} onClick={() => setScope(k)} style={{
                    flex: 1, minHeight: 40, padding: '8px 0',
                    background: active ? '#D4A76A' : 'transparent',
                    color: active ? '#060302' : '#906e50',
                    fontFamily: 'var(--font-inter)', fontSize: 12,
                    fontWeight: active ? 800 : 400,
                    border: 'none', borderRadius: 9, cursor: 'pointer', transition: 'all 0.18s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    {k === 'circle' ? (
                      <>
                        <span>⚔ {circle.name}</span>
                        <span
                          onClick={e => { e.stopPropagation(); copyCode() }}
                          style={{ fontSize: 14, opacity: copied ? 1 : 0.55, cursor: 'pointer', lineHeight: 1 }}
                          title={copied ? 'Copied!' : `Tap to copy invite code ${circle.invite_code}`}
                        >
                          {copied ? '✓' : '⎋'}
                        </span>
                      </>
                    ) : '🌐 Global'}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Weight class tabs */}
        <div style={{ padding: '0 20px 10px' }}>
          <div style={{ display: 'flex', gap: 4, background: '#0d0a07', borderRadius: 12, padding: 4 }}>
            {([
              { key: 'vanguard', label: '⚔ Vanguard' },
              { key: 'heavyweights', label: '◎ Heavyweights' },
              { key: 'sharpshooters', label: '♦ Sharpshooters' },
            ] as { key: WeightClass; label: string }[]).map(({ key, label }) => {
              const active = weightClass === key
              return (
                <button key={key} onClick={() => setWeightClass(key)} style={{
                  flex: 1, minHeight: 38, padding: '6px 4px',
                  background: active ? '#EFE4CF' : 'transparent',
                  color: active ? '#060302' : '#4a3322',
                  fontFamily: 'var(--font-inter)', fontSize: 10,
                  fontWeight: active ? 800 : 400,
                  border: 'none', borderRadius: 9, cursor: 'pointer', transition: 'all 0.18s',
                  whiteSpace: 'nowrap',
                }}>
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Vanguard: compact sort toggle */}
        {weightClass === 'vanguard' && (
          <div style={{ padding: '0 20px 10px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setSortMode(s => s === 'current' ? 'best' : 'current')}
              style={{
                padding: '5px 12px', background: 'rgba(239,228,207,0.05)',
                border: '1px solid rgba(239,228,207,0.12)', borderRadius: 999,
                color: '#906e50', fontFamily: 'var(--font-inter)', fontSize: 11, cursor: 'pointer',
              }}
            >
              {sortMode === 'current' ? 'Sort: Current ↕' : 'Sort: All-time ↕'}
            </button>
          </div>
        )}

        {/* Class description */}
        {weightClass !== 'vanguard' && (
          <div style={{ padding: '0 20px 14px' }}>
            <div style={{ padding: '10px 14px', background: 'rgba(239,228,207,0.04)', borderRadius: 12, fontSize: 12, color: '#4a3322', lineHeight: 1.5 }}>
              {weightClass === 'heavyweights'
                ? '◎ Ranked by total Reservoir volume — accumulated days that survive every reset.'
                : '♦ Ranked by Mastery Ratio — triumphs as a % of all partnered events. Requires ≥1 partnered event.'}
            </div>
          </div>
        )}

        {/* Your rank card */}
        {me && (
          <div style={{ margin: '0 20px 14px', background: 'rgba(239,228,207,0.07)', border: '1px solid rgba(239,228,207,0.1)', borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar name={me.username} size={44} gold={myRank <= 3} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#906e50' }}>Your rank</div>
              <div style={{ fontSize: 28, color: myRank === 1 ? '#D4A76A' : '#EFE4CF', fontWeight: 800, letterSpacing: -0.5, lineHeight: 1 }}>
                #{myRank} <span style={{ fontSize: 13, fontWeight: 400, color: '#906e50' }}>of {sorted.length}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: '#906e50', letterSpacing: 2, textTransform: 'uppercase' }}>
                {weightClass === 'vanguard' ? (sortMode === 'current' ? 'Streak' : 'Best') : weightClass === 'heavyweights' ? 'Volume' : 'Mastery'}
              </div>
              <div style={{ fontSize: 22, color: '#D4A76A', fontWeight: 800, lineHeight: 1, marginTop: 2 }}>
                {me.masteryPct !== null || weightClass !== 'sharpshooters'
                  ? `${myCardVal(me)}${weightClass === 'sharpshooters' ? '%' : ''}`
                  : '—'}
              </div>
            </div>
          </div>
        )}

        {/* Empty circle state */}
        {scope === 'circle' && sorted.length <= 1 && (
          <div style={{ padding: '0 20px', textAlign: 'center' }}>
            <div style={{ padding: '32px 24px', background: 'rgba(239,228,207,0.04)', border: '1px solid rgba(239,228,207,0.08)', borderRadius: 16 }}>
              <div style={{ fontSize: 24, marginBottom: 12 }}>⚔</div>
              <div style={{ fontSize: 14, color: '#906e50', lineHeight: 1.6 }}>
                Your circle is empty.<br />Share code <span style={{ color: '#D4A76A', fontWeight: 700 }}>{circle?.invite_code}</span> with friends.
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard list */}
        <div style={{ padding: '0 20px' }}>
          {sorted.map((u, i) => {
            const rankN = i + 1
            const first = rankN === 1
            const isMe = u.user_id === myId
            const isCrown = u.user_id === crownHolderId && sorted.length > 1
            return (
              <div
                key={u.user_id}
                onClick={() => handleRowTap(u)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', minHeight: 60,
                  borderRadius: 12, marginBottom: 6,
                  background: isMe ? 'rgba(212,167,106,0.08)' : first ? 'rgba(212,167,106,0.05)' : 'rgba(239,228,207,0.04)',
                  border: `1px solid ${isMe ? 'rgba(212,167,106,0.3)' : first ? 'rgba(212,167,106,0.15)' : 'rgba(239,228,207,0.08)'}`,
                  boxShadow: first ? '0 0 16px rgba(212,167,106,0.1)' : undefined,
                  cursor: 'pointer',
                }}
              >
                <div style={{ width: 24, textAlign: 'center', flexShrink: 0, fontSize: 13, fontWeight: first ? 800 : 400, color: rankN <= 3 ? '#D4A76A' : '#4a3322' }}>
                  {isCrown ? <Crown /> : rankN}
                </div>
                <Avatar name={u.username} size={34} gold={first} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: '#EFE4CF', fontWeight: isMe ? 800 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {isMe ? 'You' : u.username}
                    {isCrown && <span style={{ marginLeft: 5, fontSize: 12, color: '#D4A76A' }}>♛</span>}
                  </div>
                  <div style={{ fontSize: 10, color: '#4a3322', marginTop: 2 }}>
                    {rankTitle(u.best)}
                    {u.masteryPct !== null && <span> · {u.masteryPct}% mastery</span>}
                  </div>
                </div>

                {/* Right column: Vanguard shows current + muted best; others show val/label */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {weightClass === 'vanguard' ? (
                    <>
                      <div style={{ fontSize: 20, color: isMe || first ? '#D4A76A' : '#EFE4CF', fontWeight: 800, letterSpacing: -0.3, lineHeight: 1 }}>
                        {u.current}
                      </div>
                      <div style={{ fontSize: 10, color: '#4a3322', marginTop: 3, letterSpacing: 0.3 }}>
                        {dayWord(u.current).toUpperCase()} · best {u.best}d
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 20, color: isMe || first ? '#D4A76A' : '#EFE4CF', fontWeight: 800, letterSpacing: -0.3, lineHeight: 1 }}>
                        {u.masteryPct === null && weightClass === 'sharpshooters' ? '—' : myVal(u)}
                      </div>
                      <div style={{ fontSize: 9, color: '#4a3322', marginTop: 2, letterSpacing: 1 }}>
                        {u.masteryPct === null && weightClass === 'sharpshooters' ? 'no events' : valLabel(u)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Brotherhood Inspect Drawer */}
      {inspectedUser && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setInspectedUser(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
              zIndex: 40, backdropFilter: 'blur(2px)',
            }}
          />
          {/* Drawer */}
          <div style={{
            position: 'fixed', bottom: 88, left: 0, right: 0, zIndex: 50,
            background: '#110d08',
            borderTop: '1px solid rgba(212,167,106,0.2)',
            borderRadius: '20px 20px 0 0',
            padding: '20px 24px 36px',
            animation: 'slideUp 0.25s ease',
          }}>
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 999, background: '#2a1e12', margin: '0 auto 20px' }} />

            {/* User header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <Avatar name={inspectedUser.username} size={56} gold={inspectedRank === 1} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 20, color: '#EFE4CF', fontWeight: 800, letterSpacing: -0.3 }}>
                  {inspectedUser.user_id === myId ? 'You' : inspectedUser.username}
                </div>
                <div style={{ fontSize: 12, color: '#D4A76A', marginTop: 2 }}>
                  {masteryClass(inspectedUser.current, inspectedUser.triumphCount, inspectedUser.partneredCount)}
                </div>
                <div style={{ fontSize: 11, color: '#4a3322', marginTop: 3 }}>
                  {rankTitle(inspectedUser.best)}
                  {inspectedRank > 0 && ` · #${inspectedRank} overall`}
                </div>
              </div>
            </div>

            {/* 4-stat grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'Current', val: `${inspectedUser.current}d` },
                { label: 'Best',    val: `${inspectedUser.best}d` },
                { label: 'Rank',    val: `#${inspectedRank}` },
                { label: 'Reservoir', val: `${inspectedUser.liveVolume}` },
              ].map(({ label, val }) => (
                <div key={label} style={{
                  background: 'rgba(239,228,207,0.05)', border: '1px solid rgba(239,228,207,0.08)',
                  borderRadius: 12, padding: '10px 8px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 8, letterSpacing: 1.5, color: '#4a3322', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 16, color: '#D4A76A', fontWeight: 800 }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Mastery ratio */}
            {inspectedUser.masteryPct !== null && (
              <div style={{
                background: 'rgba(212,167,106,0.06)', border: '1px solid rgba(212,167,106,0.15)',
                borderRadius: 12, padding: '10px 14px', marginBottom: 14,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: '#4a3322', textTransform: 'uppercase' }}>Mastery Ratio</div>
                  <div style={{ fontSize: 11, color: '#906e50', marginTop: 2 }}>
                    {inspectedUser.triumphCount} triumphs · {inspectedUser.partneredCount} partnered
                  </div>
                </div>
                <span style={{ fontSize: 22, color: '#D4A76A', fontWeight: 800 }}>{inspectedUser.masteryPct}%</span>
              </div>
            )}

            {/* Relics */}
            <div>
              <div style={{ fontSize: 9, letterSpacing: 2, color: '#4a3322', textTransform: 'uppercase', marginBottom: 10 }}>Relics</div>
              {relicsLoading ? (
                <div style={{ fontSize: 12, color: '#4a3322' }}>Loading…</div>
              ) : inspectedRelics.length === 0 ? (
                <div style={{ fontSize: 12, color: '#2a1208' }}>No relics earned yet.</div>
              ) : (
                <div style={{ display: 'flex', gap: 12 }}>
                  {inspectedRelics.map(r => {
                    const cfg = RELIC_CFG[r]
                    if (!cfg) return null
                    return (
                      <div key={r} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: '50%',
                          background: 'rgba(212,167,106,0.12)',
                          border: '1.5px solid rgba(212,167,106,0.4)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 20, color: '#D4A76A',
                          animation: 'goldPulse 2.5s ease-in-out infinite',
                        }}>
                          {cfg.icon}
                        </div>
                        <div style={{ fontSize: 9, color: '#906e50', letterSpacing: 1 }}>{cfg.label}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
