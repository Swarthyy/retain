'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { createCircle, getSessionProfile, joinCircle } from '@/lib/app-data'
import {
  getCurrentDays, rankTitle, MILESTONES, getLiveVolume,
  masteryRatio, masteryClass,
} from '@/lib/utils'
import Heatmap, { DailyLogMap } from '@/components/Heatmap'

type StreakRow = {
  streak_start: string
  best_days: number
  celebrated_milestones: number[]
  volume_score: number
  triumph_count: number
  partnered_count: number
}
type CircleInfo = { id: string; name: string; invite_code: string }
type RelicType = 'iron_will' | 'transmuter' | 'phoenix'
type CircleDrawerMode = 'choose' | 'create' | 'join'

const RELIC_DEFS: Record<RelicType, { icon: string; name: string; desc: string; color: string }> = {
  iron_will:  { icon: '⬡', name: 'Iron Will',   color: '#a08040', desc: 'Survived 14 days after a lapse without falling again.' },
  transmuter: { icon: '◈', name: 'The Transmuter', color: '#C2557A', desc: '100% Mastery Ratio with at least 5 partnered events.' },
  phoenix:    { icon: '◎', name: 'The Phoenix',  color: '#D4A76A', desc: 'Fell to zero volume. Climbed back past 100 without another lapse.' },
}

export default function ProfilePage() {
  const [streak, setStreak] = useState<StreakRow | null>(null)
  const [username, setUsername] = useState('')
  const [userId, setUserId] = useState('')
  const [rank, setRank] = useState(1)
  const [total, setTotal] = useState(1)
  const [memberSince, setMemberSince] = useState('')
  const [adjVal, setAdjVal] = useState('')
  const [adjMsg, setAdjMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [circle, setCircle] = useState<CircleInfo | null>(null)
  const [copied, setCopied] = useState(false)
  const [relics, setRelics] = useState<Set<RelicType>>(new Set())
  const [dailyLog, setDailyLog] = useState<DailyLogMap>({})
  const [showBrotherhood, setShowBrotherhood] = useState(false)
  const [drawerMode, setDrawerMode] = useState<CircleDrawerMode>('choose')
  const [joinCode, setJoinCode] = useState('')
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [drawerError, setDrawerError] = useState('')
  const [createdCode, setCreatedCode] = useState('')
  const adjTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    getSessionProfile().then(session => {
      const uid = session?.userId || ''
      const uname = session?.profile?.username || ''
      setUserId(uid)
      setUsername(uname)
      if (uid) load(uid)
      else setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function load(uid: string) {
    const [{ data: s }, { data: u }, { data: all }, { data: membership }, { data: logRows }, { data: earnedRelics }] = await Promise.all([
      supabase.from('streaks').select('streak_start,best_days,celebrated_milestones,volume_score,triumph_count,partnered_count').eq('user_id', uid).single(),
      supabase.from('users').select('created_at').eq('id', uid).single(),
      supabase.from('streaks').select('user_id,streak_start,users(username)'),
      supabase.from('circle_members').select('circle_id, circles(id, name, invite_code)').eq('user_id', uid).maybeSingle(),
      supabase.from('daily_log').select('log_date,day_type').eq('user_id', uid).gte('log_date', new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0]),
      supabase.from('relics').select('relic_type').eq('user_id', uid),
    ])

    if (s) { setStreak(s); setAdjVal(String(getCurrentDays(s.streak_start))) }
    if (u) setMemberSince(new Date(u.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))
    if (all) {
      const ranked = all.map(r => ({ uid: r.user_id, d: getCurrentDays(r.streak_start) })).sort((a, b) => b.d - a.d)
      setRank(ranked.findIndex(r => r.uid === uid) + 1 || 1)
      setTotal(all.length)
    }
    if (membership) {
      type MemberRow = { circle_id: string; circles: CircleInfo }
      setCircle((membership as unknown as MemberRow).circles)
    }
    if (logRows) {
      const map: DailyLogMap = {}
      logRows.forEach((r: { log_date: string; day_type: string }) => {
        map[r.log_date] = r.day_type as DailyLogMap[string]
      })
      setDailyLog(map)
    }
    if (earnedRelics) {
      setRelics(new Set(earnedRelics.map((r: { relic_type: string }) => r.relic_type as RelicType)))
    }
    setLoading(false)

    // Check & award new relics (runs after initial data loaded)
    if (s && uid) checkAndAwardRelics(uid, s, all || [])
  }

  async function checkAndAwardRelics(uid: string, s: StreakRow, allStreaks: { user_id: string; streak_start: string }[]) {
    const days = getCurrentDays(s.streak_start)
    const liveVol = getLiveVolume(s.volume_score, s.streak_start)
    const tc = s.triumph_count || 0
    const pc = s.partnered_count || 0
    const consciousCount = pc - tc

    const [{ data: allLapses }, { data: recentLapses }, { data: zeroVolEvent }] = await Promise.all([
      supabase.from('retention_events').select('id,created_at').eq('user_id', uid).eq('event_type', 'lapse').order('created_at').limit(1),
      supabase.from('retention_events').select('id').eq('user_id', uid).eq('event_type', 'lapse').gte('created_at', new Date(Date.now() - 14 * 86400000).toISOString()).limit(1),
      supabase.from('retention_events').select('id,created_at').eq('user_id', uid).lte('volume_after', 0).order('created_at').limit(1),
    ])

    const toAward: RelicType[] = []

    // Iron Will: has a lapse in history, no lapse in 14 days, streak >= 14
    if (allLapses && allLapses.length > 0 && (!recentLapses || recentLapses.length === 0) && days >= 14) {
      toAward.push('iron_will')
    }

    // Transmuter: 5+ partnered events, 100% triumph rate (no conscious events)
    if (tc >= 5 && consciousCount === 0) {
      toAward.push('transmuter')
    }

    // Phoenix: had a zero-volume event, no lapse after it, now volume >= 100
    if (zeroVolEvent && zeroVolEvent.length > 0 && liveVol >= 100) {
      const afterDate = zeroVolEvent[0].created_at
      const { data: lapsesAfterZero } = await supabase
        .from('retention_events').select('id').eq('user_id', uid).eq('event_type', 'lapse').gte('created_at', afterDate).limit(1)
      if (!lapsesAfterZero || lapsesAfterZero.length === 0) {
        toAward.push('phoenix')
      }
    }

    // Award newly earned relics
    for (const relic of toAward) {
      const { error } = await supabase.from('relics').upsert({ user_id: uid, relic_type: relic }, { onConflict: 'user_id,relic_type', ignoreDuplicates: true })
      if (!error) {
        setRelics(prev => new Set([...prev, relic]))
        // Broadcast to circle feed
        const username = (await getSessionProfile())?.profile?.username || ''
        const { data: membership } = await supabase.from('circle_members').select('circle_id').eq('user_id', uid).maybeSingle()
        const def = RELIC_DEFS[relic]
        supabase.from('events').insert({
          user_id: uid, username,
          kind: 'relic',
          body: `earned the ${def.name} relic. ${def.icon}`,
          cta: def.desc,
          circle_id: membership?.circle_id ?? null,
        })
      }
    }
  }

  async function handleSetStreak() {
    const n = parseInt(adjVal)
    if (isNaN(n) || n < 0 || n > 9999) {
      setAdjMsg({ text: 'Enter a number between 0 and 9999.', ok: false }); return
    }
    const today = new Date()
    today.setDate(today.getDate() - n)
    const streakStart = today.toISOString().split('T')[0]
    const newBest = streak ? Math.max(streak.best_days, n) : n
    await supabase.from('streaks').update({ streak_start: streakStart, best_days: newBest, celebrated_milestones: [] }).eq('user_id', userId)
    setStreak(s => s ? { ...s, streak_start: streakStart, best_days: newBest } : s)
    setAdjMsg({ text: 'Saved ✓', ok: true })
    if (adjTimer.current) clearTimeout(adjTimer.current)
    adjTimer.current = setTimeout(() => setAdjMsg(null), 2500)
  }

  // ── Seek Brotherhood: create circle ──────────────────────────────────────

  async function handleCreateCircle() {
    setDrawerLoading(true); setDrawerError('')
    try {
      const circ = await createCircle()
      setCircle(circ)
      setCreatedCode(circ.invite_code)
    } catch (err) {
      setDrawerError(err instanceof Error ? err.message : 'Could not create. Try again.')
    } finally {
      setDrawerLoading(false)
    }
  }

  async function handleJoinCircle() {
    const code = joinCode.trim().toUpperCase()
    if (code.length !== 6) { setDrawerError('Enter the 6-character code.'); return }
    setDrawerLoading(true); setDrawerError('')
    try {
      const circ = await joinCircle(code)
      setCircle(circ)
      setShowBrotherhood(false)
    } catch (err) {
      setDrawerError(err instanceof Error ? err.message : 'No circle found.')
    } finally {
      setDrawerLoading(false)
    }
  }

  if (loading || !streak) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #D4A76A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  const days = getCurrentDays(streak.streak_start)
  const best = streak.best_days
  const title = rankTitle(best)
  const liveVolume = getLiveVolume(streak.volume_score, streak.streak_start)
  const tc = streak.triumph_count || 0
  const pc = streak.partnered_count || 0
  const mRatio = masteryRatio(tc, pc)
  const mClass = masteryClass(days, tc, pc)

  const stats = [
    { label: 'Current streak', val: days, unit: 'days', c: '#EFE4CF' },
    { label: 'All-time best', val: best, unit: 'days', c: '#D4A76A' },
    { label: 'Current rank', val: `#${rank}`, unit: `of ${total}`, c: '#D78A50' },
    { label: 'Reservoir', val: liveVolume, unit: 'volume', c: '#906e50' },
  ]

  return (
    <div style={{ padding: '42px 0 24px' }}>

      {/* Avatar + username + class */}
      <div style={{ margin: '0 20px 18px', padding: '24px 18px 18px', textAlign: 'center', borderRadius: 22, border: '1px solid rgba(212,167,106,0.18)', background: 'radial-gradient(circle at 50% 0%, rgba(212,167,106,0.20), transparent 42%), linear-gradient(180deg,rgba(239,228,207,0.06),rgba(239,228,207,0.025))', boxShadow: '0 0 36px rgba(212,167,106,0.07)' }}>
        <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(212,167,106,0.36),rgba(215,138,80,0.14))', border: '2px solid rgba(212,167,106,0.48)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, boxShadow: '0 0 28px rgba(212,167,106,0.18)' }}>
          🧘
        </div>
        <div style={{ fontSize: 22, color: '#EFE4CF', fontWeight: 900, letterSpacing: -0.4 }}>@{username}</div>
        <div style={{ fontSize: 11, color: '#4a3322', marginTop: 3 }}>{title} · {mClass}</div>
        <div style={{ fontSize: 10, color: '#4a3322', marginTop: 1 }}>Member since {memberSince}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 18 }}>
          <div style={{ borderRadius: 14, background: 'rgba(6,3,2,0.45)', border: '1px solid rgba(212,167,106,0.16)', padding: '10px 8px' }}>
            <div style={{ color: '#4a3322', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' }}>Current</div>
            <div style={{ color: '#EFE4CF', fontSize: 25, fontWeight: 900 }}>{days}<span style={{ color: '#906e50', fontSize: 11, marginLeft: 3 }}>d</span></div>
          </div>
          <div style={{ borderRadius: 14, background: 'rgba(212,167,106,0.08)', border: '1px solid rgba(212,167,106,0.22)', padding: '10px 8px' }}>
            <div style={{ color: '#906e50', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' }}>All-time</div>
            <div style={{ color: '#D4A76A', fontSize: 25, fontWeight: 900 }}>{best}<span style={{ color: '#906e50', fontSize: 11, marginLeft: 3 }}>d</span></div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 20px 18px' }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: 'linear-gradient(180deg,rgba(239,228,207,0.065),rgba(239,228,207,0.035))', border: '1px solid rgba(239,228,207,0.09)', borderRadius: 16, padding: '13px 14px', minHeight: 86 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: '#906e50', textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 20, color: s.c, fontWeight: 800, letterSpacing: -0.3, lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: 10, color: '#4a3322', marginTop: 4 }}>{s.unit}</div>
          </div>
        ))}
      </div>

      {/* Mastery Ratio */}
      <div style={{ margin: '0 20px 16px', background: 'linear-gradient(135deg,rgba(194,85,122,0.09),rgba(239,228,207,0.035))', border: '1px solid rgba(194,85,122,0.20)', borderRadius: 18, padding: 16 }}>
        <div style={{ fontSize: 10, color: '#C2557A', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Mastery Ratio</div>
        {mRatio === null ? (
          <div style={{ fontSize: 13, color: '#4a3322', fontStyle: 'italic' }}>Awaiting the test.</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#C2557A', lineHeight: 1 }}>{mRatio}%</div>
            <div style={{ fontSize: 12, color: '#4a3322', marginBottom: 4 }}>{tc} triumphs · {pc - tc} conscious</div>
          </div>
        )}
        {pc > 0 && (
          <div style={{ height: 5, borderRadius: 999, background: '#1e1208' }}>
            <div style={{ height: '100%', borderRadius: 999, width: `${mRatio ?? 0}%`, background: 'linear-gradient(90deg,#7A4E5C,#C2557A)', transition: 'width 0.8s ease' }} />
          </div>
        )}
        <div style={{ fontSize: 10, color: '#4a3322', marginTop: 6 }}>{mClass}</div>
      </div>

      {/* Relics */}
      <div style={{ margin: '0 20px 16px', background: 'rgba(239,228,207,0.045)', border: '1px solid rgba(239,228,207,0.09)', borderRadius: 18, padding: 16 }}>
        <div style={{ fontSize: 10, color: '#D4A76A', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Relics</div>
        {Object.entries(RELIC_DEFS).map(([key, def]) => {
          const earned = relics.has(key as RelicType)
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: earned ? `${def.color}22` : 'rgba(239,228,207,0.04)',
                border: `1px solid ${earned ? def.color + '55' : 'rgba(239,228,207,0.1)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, color: earned ? def.color : '#1e1208',
                boxShadow: earned ? `0 0 12px ${def.color}44` : undefined,
                animation: earned ? 'goldPulse 3s ease-in-out infinite' : undefined,
              }}>
                {def.icon}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: earned ? def.color : '#2a1208' }}>{def.name}</div>
                <div style={{ fontSize: 10, color: '#2a1208', lineHeight: 1.4 }}>{def.desc}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Milestones */}
      <div style={{ margin: '0 20px 16px', background: 'linear-gradient(180deg,rgba(239,228,207,0.055),rgba(239,228,207,0.03))', border: '1px solid rgba(239,228,207,0.09)', borderRadius: 18, padding: 16 }}>
        <div style={{ fontSize: 10, color: '#D4A76A', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Milestone Progress</div>
        {MILESTONES.map(m => {
          const pct = Math.min(100, (best / m) * 100)
          const done = best >= m
          return (
            <div key={m} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#EFE4CF', fontWeight: 600 }}>{m} days</span>
                {done
                  ? <span style={{ fontSize: 10, fontWeight: 700, color: '#D4A76A', letterSpacing: 1, border: '1px solid rgba(212,167,106,0.3)', borderRadius: 999, padding: '2px 8px' }}>ACHIEVED ✓</span>
                  : <span style={{ fontSize: 11, color: '#4a3322' }}>{m - best} to go</span>
                }
              </div>
              <div style={{ height: 5, borderRadius: 999, background: '#1e1208' }}>
                <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: done ? 'linear-gradient(90deg,#D78A50,#D4A76A)' : '#4a3322', boxShadow: done ? '0 0 8px #D4A76A55' : undefined }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Heatmap */}
      <div style={{ margin: '0 20px 16px', background: 'linear-gradient(135deg,rgba(212,167,106,0.08),rgba(239,228,207,0.035))', border: '1px solid rgba(212,167,106,0.16)', borderRadius: 18, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 14, color: '#EFE4CF', fontWeight: 800 }}>365-Day Consistency</div>
            <div style={{ fontSize: 10, color: '#906e50', marginTop: 2 }}>Your path, day by day</div>
          </div>
          <div style={{ color: '#D4A76A', fontSize: 18, fontWeight: 900 }}>{Math.min(365, days)}</div>
        </div>
        <Heatmap streakStart={streak.streak_start} dailyLog={dailyLog} />
      </div>

      {/* Set starting streak */}
      <div style={{ margin: '0 20px 16px', background: 'rgba(239,228,207,0.06)', border: '1px solid rgba(239,228,207,0.08)', borderRadius: 16, padding: '14px 16px' }}>
        <div style={{ fontSize: 13, color: '#EFE4CF', fontWeight: 600, marginBottom: 3 }}>Set Starting Streak</div>
        <div style={{ fontSize: 12, color: '#906e50', marginBottom: 10, lineHeight: 1.5 }}>Already on a streak? Sync your days for the leaderboard.</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="number" min={0} max={9999} value={adjVal} onChange={e => setAdjVal(e.target.value)} placeholder="Days"
            style={{ flex: 1, background: '#1e1208', border: '1px solid #4a3322', borderRadius: 10, padding: '12px 14px', color: '#EFE4CF', fontFamily: 'var(--font-inter)', fontSize: 15, fontWeight: 700, outline: 'none', minHeight: 48 }} />
          <button onClick={handleSetStreak} style={{ minWidth: 58, minHeight: 48, background: '#D4A76A', color: '#060302', fontFamily: 'var(--font-inter)', fontSize: 13, fontWeight: 800, border: 'none', borderRadius: 10, cursor: 'pointer' }}>Set</button>
        </div>
        {adjMsg && <div style={{ fontSize: 11, marginTop: 6, color: adjMsg.ok ? '#D4A76A' : '#e05555' }}>{adjMsg.text}</div>}
      </div>

      {/* Circle / Seek Brotherhood */}
      <div style={{ margin: '0 20px 0', background: 'rgba(239,228,207,0.06)', border: '1px solid rgba(239,228,207,0.08)', borderRadius: 16, padding: '14px 16px' }}>
        <div style={{ fontSize: 13, color: '#EFE4CF', fontWeight: 600, marginBottom: 3 }}>Your Circle</div>
        {circle ? (
          <>
            <div style={{ fontSize: 12, color: '#906e50', marginBottom: 10 }}>{circle.name}</div>
            <button
              onClick={() => { navigator.clipboard.writeText(circle.invite_code); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'rgba(212,167,106,0.08)', border: '1px solid rgba(212,167,106,0.2)', borderRadius: 10, padding: '12px 14px', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 11, color: '#906e50', fontFamily: 'var(--font-inter)' }}>Invite code</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#D4A76A', fontFamily: 'var(--font-inter)', letterSpacing: 4 }}>{circle.invite_code}</span>
              <span style={{ fontSize: 11, color: copied ? '#4CAF50' : '#4a3322', fontFamily: 'var(--font-inter)' }}>{copied ? 'copied ✓' : 'tap to copy'}</span>
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, color: '#4a3322', lineHeight: 1.5, marginBottom: 12 }}>You fight alone. Find your brothers.</div>
            <button
              onClick={() => { setShowBrotherhood(true); setDrawerMode('choose'); setDrawerError(''); setCreatedCode('') }}
              style={{ width: '100%', minHeight: 48, background: 'rgba(212,167,106,0.1)', border: '1px solid rgba(212,167,106,0.3)', borderRadius: 12, color: '#D4A76A', fontFamily: 'var(--font-inter)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              ⚔ Seek Brotherhood
            </button>
          </>
        )}
      </div>

      {/* Dev button */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ padding: '16px 20px 0' }}>
          <button onClick={() => { window.location.href = '/onboarding' }}
            style={{ width: '100%', minHeight: 48, background: 'transparent', border: '1px solid rgba(212,167,106,0.2)', borderRadius: 14, color: '#906e50', fontFamily: 'var(--font-inter)', fontSize: 13, cursor: 'pointer' }}>
            ⚙ Test Onboarding Flow
          </button>
        </div>
      )}

      {/* Sign out */}
      <div style={{ padding: '16px 20px 0' }}>
        <button onClick={async () => { await supabase.auth.signOut(); localStorage.removeItem('retain_user_id'); localStorage.removeItem('retain_username'); localStorage.removeItem('retain_onboarded'); localStorage.removeItem('retain_pending_circle_code'); window.location.href = '/login' }}
          style={{ width: '100%', minHeight: 48, background: 'transparent', border: '1px solid rgba(239,228,207,0.1)', borderRadius: 14, color: '#4a3322', fontFamily: 'var(--font-inter)', fontSize: 14, cursor: 'pointer' }}>
          Sign out
        </button>
      </div>

      {/* ── Seek Brotherhood bottom drawer ─────────────────────────────────── */}
      {showBrotherhood && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowBrotherhood(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(6,3,2,0.7)', zIndex: 200, backdropFilter: 'blur(4px)' }}
          />
          {/* Sheet */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
            background: '#0d0a07', borderTop: '1px solid rgba(212,167,106,0.15)',
            borderRadius: '20px 20px 0 0',
            padding: '24px 24px 48px',
            animation: 'slideUp 0.3s ease both',
          }}>
            {/* Handle */}
            <div style={{ width: 40, height: 4, background: '#2a1a0e', borderRadius: 999, margin: '0 auto 20px' }} />

            {createdCode ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>⚔</div>
                <div style={{ fontFamily: 'var(--font-cormorant)', fontStyle: 'italic', fontSize: 24, color: '#D4A76A', marginBottom: 8 }}>Circle created.</div>
                <div style={{ fontSize: 12, color: '#906e50', marginBottom: 20 }}>Share this code with your brothers:</div>
                <div style={{ fontFamily: 'var(--font-inter)', fontSize: 34, fontWeight: 800, letterSpacing: 10, color: '#D4A76A', background: 'rgba(212,167,106,0.1)', border: '1px solid rgba(212,167,106,0.3)', borderRadius: 14, padding: '18px 24px', marginBottom: 24, animation: 'goldPulse 2s ease-in-out infinite' }}>
                  {createdCode}
                </div>
                <button onClick={() => setShowBrotherhood(false)} style={{ width: '100%', minHeight: 52, background: '#D4A76A', color: '#060302', fontFamily: 'var(--font-inter)', fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 14, cursor: 'pointer' }}>
                  Done
                </button>
              </div>
            ) : drawerMode === 'choose' ? (
              <>
                <div style={{ fontFamily: 'var(--font-cormorant)', fontStyle: 'italic', fontSize: 28, color: '#EFE4CF', marginBottom: 6 }}>Seek Brotherhood.</div>
                <div style={{ fontSize: 13, color: '#906e50', lineHeight: 1.6, marginBottom: 28 }}>Compete privately. One code. Instant rivalry.</div>
                {drawerError && <div style={{ fontSize: 12, color: '#e05555', marginBottom: 12 }}>{drawerError}</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button onClick={() => { setDrawerMode('create'); setDrawerError('') }} style={{ width: '100%', minHeight: 52, background: '#D4A76A', color: '#060302', fontFamily: 'var(--font-inter)', fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 14, cursor: 'pointer' }}>Create a circle</button>
                  <button onClick={() => { setDrawerMode('join'); setDrawerError('') }} style={{ width: '100%', minHeight: 52, background: 'transparent', color: '#EFE4CF', fontFamily: 'var(--font-inter)', fontSize: 15, border: '1px solid rgba(239,228,207,0.2)', borderRadius: 14, cursor: 'pointer' }}>Join with a code</button>
                </div>
              </>
            ) : drawerMode === 'create' ? (
              <>
                <button onClick={() => setDrawerMode('choose')} style={{ background: 'none', border: 'none', color: '#4a3322', fontFamily: 'var(--font-inter)', fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}>← back</button>
                <div style={{ fontFamily: 'var(--font-cormorant)', fontStyle: 'italic', fontSize: 26, color: '#EFE4CF', marginBottom: 24 }}>Create a circle.</div>
                {drawerError && <div style={{ fontSize: 12, color: '#e05555', marginBottom: 12 }}>{drawerError}</div>}
                <button onClick={handleCreateCircle} disabled={drawerLoading} style={{ width: '100%', minHeight: 52, background: drawerLoading ? '#1e1208' : '#D4A76A', color: drawerLoading ? '#4a3322' : '#060302', fontFamily: 'var(--font-inter)', fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 14, cursor: drawerLoading ? 'not-allowed' : 'pointer' }}>
                  {drawerLoading ? 'creating…' : 'Create my circle'}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setDrawerMode('choose')} style={{ background: 'none', border: 'none', color: '#4a3322', fontFamily: 'var(--font-inter)', fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}>← back</button>
                <div style={{ fontFamily: 'var(--font-cormorant)', fontStyle: 'italic', fontSize: 26, color: '#EFE4CF', marginBottom: 20 }}>Join a circle.</div>
                <input type="text" value={joinCode} onChange={e => { setJoinCode(e.target.value.toUpperCase()); setDrawerError('') }} placeholder="XXXXXX" maxLength={6} autoFocus autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                  style={{ width: '100%', background: '#1e1208', border: '1px solid rgba(239,228,207,0.15)', borderRadius: 12, padding: '16px', color: '#D4A76A', fontFamily: 'var(--font-inter)', fontSize: 26, fontWeight: 800, letterSpacing: 8, outline: 'none', textAlign: 'center', marginBottom: 10 }} />
                {drawerError && <div style={{ fontSize: 12, color: '#e05555', marginBottom: 10 }}>{drawerError}</div>}
                <button onClick={handleJoinCircle} disabled={drawerLoading || joinCode.trim().length !== 6}
                  style={{ width: '100%', minHeight: 52, background: joinCode.trim().length === 6 && !drawerLoading ? '#D4A76A' : '#1e1208', color: joinCode.trim().length === 6 && !drawerLoading ? '#060302' : '#4a3322', fontFamily: 'var(--font-inter)', fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 14, cursor: joinCode.trim().length === 6 && !drawerLoading ? 'pointer' : 'not-allowed' }}>
                  {drawerLoading ? 'joining…' : 'Join circle'}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
