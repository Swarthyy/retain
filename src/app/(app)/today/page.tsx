'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getCurrentDays, startDateLabel, greeting, dayWord,
  MILESTONES, MILESTONE_TITLES,
  getLiveVolume, calcResetPenalty, inBingeWindow, triumphMessage,
} from '@/lib/utils'
import Gauge from '@/components/Gauge'
import ResetModal, { ResetEventType, ResetModalFlow } from '@/components/ResetModal'
import NotificationBanner from '@/components/NotificationBanner'

type StreakRow = {
  streak_start: string
  best_days: number
  celebrated_milestones: number[]
  volume_score: number
  last_event_at: string | null
  binge_count: number
  triumph_count: number
  partnered_count: number
}
type Banner = { id: string; message: string }

export default function TodayPage() {
  const [streak, setStreak] = useState<StreakRow | null>(null)
  const [userId, setUserId] = useState('')
  const [username, setUsername] = useState('')
  const [circleId, setCircleId] = useState<string | null>(null)
  const [rank, setRank] = useState(1)
  const [totalUsers, setTotalUsers] = useState(1)
  const [isCrownHolder, setIsCrownHolder] = useState(false)

  // Modal state
  const [resetFlow, setResetFlow] = useState<ResetModalFlow | 'idle'>('idle')
  const [eventType, setEventType] = useState<ResetEventType>(null)
  const [preResetDays, setPreResetDays] = useState(0)
  const [preResetBest, setPreResetBest] = useState(0)
  const [isRecord, setIsRecord] = useState(false)
  const [previewPenalty, setPreviewPenalty] = useState(0)
  const [previewVolumeAfter, setPreviewVolumeAfter] = useState(0)
  const [previewPenaltyRate, setPreviewPenaltyRate] = useState(0)
  const [previewLiveVolume, setPreviewLiveVolume] = useState(0)
  const [currentTriumphMsg, setCurrentTriumphMsg] = useState('')

  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)

  const loadBanners = useCallback(async (uid: string, myRank: number, total: number) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const dismissed: string[] = JSON.parse(localStorage.getItem('retain_dismissed_banners') || '[]')
    const result: Banner[] = []

    const { data: lapseEvents } = await supabase
      .from('events')
      .select('id,username,kind,body,user_id')
      .eq('kind', 'lapse')
      .gte('created_at', since)
      .neq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(10)

    const others = (lapseEvents || []).filter(e => !dismissed.includes(e.id))
    if (others.length === 1) {
      const e = others[0]
      const match = e.body.match(/reset after (\d+)/)
      const lostDays = match ? match[1] : '?'
      result.push({ id: e.id, message: `⚔  ${e.username} just lost their ${lostDays}-day streak. Their record is yours to take.` })
    } else if (others.length >= 2) {
      const names = others.slice(0, 2).map(e => e.username).join(' and ')
      result.push({ id: others[0].id, message: `⚔  ${names} both fell. The field is thinning. Rise.` })
    }

    const lastPlaceId = `lastplace_${uid}`
    if (myRank === total && total > 1 && !dismissed.includes(lastPlaceId)) {
      result.push({ id: lastPlaceId, message: "Dead last. Even the novice has more resolve. Don't be the one they talk about." })
    }
    setBanners(result)
  }, [])

  const loadData = useCallback(async (uid: string) => {
    const [{ data: s }, { data: all }, { data: membership }] = await Promise.all([
      supabase
        .from('streaks')
        .select('streak_start,best_days,celebrated_milestones,volume_score,last_event_at,binge_count,triumph_count,partnered_count')
        .eq('user_id', uid)
        .single(),
      supabase.from('streaks').select('user_id,streak_start'),
      supabase.from('circle_members').select('circle_id').eq('user_id', uid).maybeSingle(),
    ])

    if (s) setStreak(s)
    if (membership) setCircleId(membership.circle_id)

    let myRank = 1, total = 1
    if (all) {
      const ranked = all
        .map(r => ({ uid: r.user_id, d: getCurrentDays(r.streak_start) }))
        .sort((a, b) => b.d - a.d)
      myRank = ranked.findIndex(r => r.uid === uid) + 1 || 1
      total = all.length
      setRank(myRank)
      setTotalUsers(total)
      setIsCrownHolder(myRank === 1 && total > 1)
    }
    setLoading(false)
    loadBanners(uid, myRank, total)
  }, [loadBanners])

  useEffect(() => {
    const uid = localStorage.getItem('retain_user_id') || ''
    const uname = localStorage.getItem('retain_username') || ''
    setUserId(uid)
    setUsername(uname)
    if (uid) loadData(uid)
  }, [loadData])

  // Milestone detection
  useEffect(() => {
    if (!streak || !userId || !username) return
    const days = getCurrentDays(streak.streak_start)
    const celebrated = streak.celebrated_milestones || []
    const hit = MILESTONES.find(m => days >= m && !celebrated.includes(m))
    if (!hit) return
    const title = MILESTONE_TITLES[hit]
    const isFirst = !celebrated.includes(hit)
    supabase.from('events').insert({
      user_id: userId, username,
      kind: isFirst ? 'milestone_first' : 'milestone_return',
      body: `hit ${hit} days.`,
      cta: `They're now a "${title}."`,
      circle_id: circleId,
    })
    const updated = [...celebrated, hit]
    supabase.from('streaks').update({ celebrated_milestones: updated }).eq('user_id', userId)
    setStreak(s => s ? { ...s, celebrated_milestones: updated } : s)
  }, [streak, userId, username, circleId])

  // ── Event type selection ──────────────────────────────────────────────

  function handleSelectType(t: ResetEventType) {
    if (!streak) return
    const days = getCurrentDays(streak.streak_start)
    const liveVol = getLiveVolume(streak.volume_score, streak.streak_start)

    if (t === 'triumph') {
      setEventType('triumph')
      setPreResetDays(days)
      setPreviewLiveVolume(liveVol)
      setCurrentTriumphMsg(triumphMessage(username))
      setResetFlow('triumph')
      return
    }

    // lapse or conscious
    const multiplier = inBingeWindow(streak.last_event_at) ? Math.max(1, streak.binge_count + 1) : 1
    const { penalty, volumeAfter, penaltyRate } = calcResetPenalty(liveVol, multiplier)
    setEventType(t)
    setPreResetDays(days)
    setPreResetBest(streak.best_days)
    setIsRecord(days > streak.best_days)
    setPreviewLiveVolume(liveVol)
    setPreviewPenalty(penalty)
    setPreviewVolumeAfter(volumeAfter)
    setPreviewPenaltyRate(penaltyRate)
    setResetFlow('preview')
  }

  // ── Triumph (no streak/volume change) ────────────────────────────────

  async function handleConfirmTriumph() {
    if (!userId || !streak) return
    const days = getCurrentDays(streak.streak_start)
    const liveVol = getLiveVolume(streak.volume_score, streak.streak_start)
    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()

    await Promise.all([
      // Audit log
      supabase.from('retention_events').insert({
        user_id: userId, event_type: 'triumph',
        volume_before: liveVol, volume_after: liveVol,
        penalty_multiplier: 1, streak_days_at_event: days,
      }),
      // Daily log for heatmap
      supabase.from('daily_log').upsert({ user_id: userId, log_date: today, day_type: 'triumph' }, { onConflict: 'user_id,log_date' }),
      // Streak mastery counters
      supabase.from('streaks').update({
        triumph_count: (streak.triumph_count || 0) + 1,
        partnered_count: (streak.partnered_count || 0) + 1,
      }).eq('user_id', userId),
      // Circle broadcast
      supabase.from('events').insert({
        user_id: userId, username,
        kind: 'triumph',
        body: currentTriumphMsg,
        cta: `${days} days and the streak endures.`,
        circle_id: circleId,
      }),
    ])

    setStreak(s => s ? {
      ...s,
      triumph_count: (s.triumph_count || 0) + 1,
      partnered_count: (s.partnered_count || 0) + 1,
    } : s)
    setResetFlow('idle')
    setEventType(null)
  }

  // ── Reset (lapse / conscious) ─────────────────────────────────────────

  async function handleConfirmReset() {
    if (!userId || !streak || !eventType || eventType === 'triumph') return
    const days = preResetDays
    const liveVol = previewLiveVolume
    const newBest = isRecord ? days : streak.best_days
    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()
    const multiplier = inBingeWindow(streak.last_event_at) ? Math.max(1, streak.binge_count + 1) : 1
    const newBingeCount = inBingeWindow(streak.last_event_at) ? streak.binge_count + 1 : 1

    // Check for crown transfer before resetting
    const wasKing = isCrownHolder && totalUsers > 1

    // Lapse feed body copy
    const lapseBody = eventType === 'lapse'
      ? `A moment of silence. ${username} lost the battle. The reservoir leaks to ${previewVolumeAfter}. The journey begins anew.`
      : `${username} chose the mortal path tonight. The reservoir takes a hit, but respect is maintained.`

    await Promise.all([
      // Update streak
      supabase.from('streaks').update({
        streak_start: today,
        best_days: newBest,
        celebrated_milestones: [],
        volume_score: previewVolumeAfter,
        last_event_at: now,
        binge_count: newBingeCount,
        partnered_count: (streak.partnered_count || 0) + (eventType === 'conscious' ? 1 : 0),
      }).eq('user_id', userId),
      // Audit log
      supabase.from('retention_events').insert({
        user_id: userId, event_type: eventType,
        volume_before: liveVol, volume_after: previewVolumeAfter,
        penalty_multiplier: multiplier, streak_days_at_event: days,
      }),
      // Daily log for heatmap
      supabase.from('daily_log').upsert({
        user_id: userId, log_date: today,
        day_type: eventType === 'lapse' ? 'lapse' : 'conscious',
      }, { onConflict: 'user_id,log_date' }),
      // Circle broadcast — TOTAL ACCOUNTABILITY (both lapse and conscious are public)
      supabase.from('events').insert({
        user_id: userId, username,
        kind: eventType,
        body: lapseBody,
        cta: isRecord ? `A new longest before the fall.` : `Best remains ${newBest} days.`,
        circle_id: circleId,
      }),
    ])

    // Crown transfer: find new #1 after reset
    if (wasKing) {
      const { data: allStreaks } = await supabase.from('streaks').select('user_id,streak_start,users(username)')
      if (allStreaks) {
        type Row = { user_id: string; streak_start: string; users: { username: string } }
        const sorted = (allStreaks as unknown as Row[])
          .map(r => ({ uid: r.user_id, uname: r.users?.username || '??', d: getCurrentDays(r.streak_start) }))
          .sort((a, b) => b.d - a.d)
        const newKing = sorted.find(r => r.uid !== userId)
        if (newKing && circleId) {
          supabase.from('events').insert({
            user_id: userId, username,
            kind: 'crown_transfer',
            body: `has fallen from the throne. ${newKing.uname} claims the Crown. ♛`,
            cta: 'A new king rises.',
            circle_id: circleId,
          })
        }
      }
    }

    setStreak({
      streak_start: today,
      best_days: newBest,
      celebrated_milestones: [],
      volume_score: previewVolumeAfter,
      last_event_at: now,
      binge_count: newBingeCount,
      triumph_count: streak.triumph_count || 0,
      partnered_count: (streak.partnered_count || 0) + (eventType === 'conscious' ? 1 : 0),
    })
    setIsCrownHolder(false)
    setResetFlow('record')
  }

  function dismissBanner(id: string) {
    const prev: string[] = JSON.parse(localStorage.getItem('retain_dismissed_banners') || '[]')
    localStorage.setItem('retain_dismissed_banners', JSON.stringify([...prev, id]))
    setBanners(b => b.filter(x => x.id !== id))
  }

  function closeModal() {
    setResetFlow('idle')
    setEventType(null)
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
  const liveVolume = getLiveVolume(streak.volume_score, streak.streak_start)
  const nextMilestone = MILESTONES.find(m => m > days) ?? null
  const gaugeTarget = nextMilestone ?? days
  const gaugeLabel = nextMilestone ? `NEXT: ${nextMilestone}d` : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 88px)', padding: '52px 0 16px', position: 'relative' }}>

      {/* Header */}
      <div style={{ padding: '4px 22px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 22, color: '#EFE4CF', fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.1 }}>
            {greeting()}
            {isCrownHolder && <span style={{ marginLeft: 8, fontSize: 18, color: '#D4A76A' }}>♛</span>}
          </div>
          <div style={{ fontSize: 12, color: '#906e50', marginTop: 4 }}>Since {startDateLabel(days)}</div>
        </div>
        <div style={{ background: 'rgba(239,228,207,0.07)', border: '1px solid rgba(239,228,207,0.1)', borderRadius: 14, padding: '8px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, letterSpacing: 2.5, color: '#D4A76A', textTransform: 'uppercase', fontWeight: 700 }}>Rank</div>
          <div style={{ fontFamily: 'var(--font-cormorant)', fontStyle: 'italic', fontSize: 26, color: '#D4A76A', lineHeight: 1 }}>#{rank}</div>
          <div style={{ fontSize: 10, color: '#906e50', marginTop: 2 }}>of {totalUsers}</div>
        </div>
      </div>

      {/* Notification banners */}
      {banners.length > 0 && (
        <div style={{ padding: '0 20px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {banners.map(b => (
            <NotificationBanner key={b.id} message={b.message} onDismiss={() => dismissBanner(b.id)} />
          ))}
        </div>
      )}

      {/* Gauge */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 16px' }}>
        <Gauge days={days} target={gaugeTarget} label={gaugeLabel} size={210} />
      </div>

      {/* Streak stats card */}
      {days < best ? (
        <div style={{ margin: '0 20px 12px', background: 'rgba(239,228,207,0.07)', border: '1px solid rgba(239,228,207,0.1)', borderRadius: 16, padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 2, color: '#906e50', textTransform: 'uppercase' }}>Current</div>
              <div style={{ fontSize: 18, color: '#EFE4CF', fontWeight: 800, marginTop: 2 }}>
                {days} <span style={{ fontSize: 11, fontWeight: 400, color: '#906e50' }}>days</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: '#906e50', textTransform: 'uppercase' }}>Best</div>
              <div style={{ fontSize: 18, color: '#D4A76A', fontWeight: 800, marginTop: 2 }}>
                {best} <span style={{ fontSize: 11, fontWeight: 400, color: '#906e50' }}>days</span>
              </div>
            </div>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: '#1e1208' }}>
            <div style={{ height: '100%', borderRadius: 999, width: `${Math.min(100, (days / best) * 100)}%`, background: 'linear-gradient(90deg,#D78A5088,#D4A76A)', boxShadow: '0 0 8px #D4A76A66', position: 'relative', overflow: 'hidden', transition: 'width 0.8s ease' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)', animation: 'shimmer 2.5s linear infinite' }} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#906e50', marginTop: 8 }}>{best - days} days to match your best</div>
        </div>
      ) : (() => {
        const prevM = [...MILESTONES].reverse().find(m => m <= days) ?? 0
        const barPct = nextMilestone ? Math.min(100, ((days - prevM) / (nextMilestone - prevM)) * 100) : 100
        const nextLabel = nextMilestone ? `${nextMilestone}d · ${MILESTONE_TITLES[nextMilestone]}` : 'Ascetic · max'
        const footerText = nextMilestone ? `${nextMilestone - days} days to ${MILESTONE_TITLES[nextMilestone]}` : 'Peak rank achieved.'
        return (
          <div style={{ margin: '0 20px 12px', background: 'rgba(212,167,106,0.06)', border: '1px solid rgba(212,167,106,0.2)', borderRadius: 16, padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: 2, color: '#906e50', textTransform: 'uppercase' }}>Beyond best</div>
                <div style={{ fontSize: 18, color: '#D4A76A', fontWeight: 800, marginTop: 2 }}>
                  +{days - best} <span style={{ fontSize: 11, fontWeight: 400, color: '#906e50' }}>days</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: '#906e50', textTransform: 'uppercase' }}>Next rank</div>
                <div style={{ fontSize: 15, color: '#EFE4CF', fontWeight: 800, marginTop: 4, letterSpacing: -0.2 }}>{nextLabel}</div>
              </div>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: '#1e1208' }}>
              <div style={{ height: '100%', borderRadius: 999, width: `${barPct}%`, background: 'linear-gradient(90deg,#D78A5088,#D4A76A)', boxShadow: '0 0 8px #D4A76A66', position: 'relative', overflow: 'hidden', transition: 'width 0.8s ease' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)', animation: 'shimmer 2.5s linear infinite' }} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#906e50', marginTop: 8 }}>{footerText}</div>
          </div>
        )
      })()}

      {/* Reservoir card */}
      <div style={{ margin: '0 20px 12px', background: 'rgba(212,167,106,0.05)', border: '1px solid rgba(212,167,106,0.15)', borderRadius: 16, padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: '#906e50', textTransform: 'uppercase', marginBottom: 4 }}>The Reservoir</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#D4A76A', lineHeight: 1, letterSpacing: -0.5 }}>{liveVolume}</div>
            <div style={{ fontSize: 10, color: '#4a3322', marginTop: 4 }}>days accumulated</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {inBingeWindow(streak.last_event_at) && streak.binge_count > 0 && (
              <div style={{ color: '#e05555', fontWeight: 700, fontSize: 10, marginBottom: 4 }}>⚠ BINGE ×{streak.binge_count + 1}</div>
            )}
            <div style={{ fontSize: 11, color: '#4a3322', lineHeight: 1.5 }}>
              Never resets.<br />Drains on events.
            </div>
          </div>
        </div>
      </div>

      {/* Log event button */}
      <div style={{ padding: '8px 20px 0' }}>
        <button
          onClick={() => setResetFlow('type')}
          style={{ width: '100%', minHeight: 52, background: 'transparent', border: '1px solid rgba(239,228,207,0.2)', borderRadius: 14, color: '#EFE4CF', fontFamily: 'var(--font-inter)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
        >
          Log an event
        </button>
      </div>

      {resetFlow !== 'idle' && (
        <ResetModal
          days={preResetDays || days}
          best={preResetBest || best}
          liveVolume={previewLiveVolume || liveVolume}
          bingeCount={inBingeWindow(streak.last_event_at) ? streak.binge_count + 1 : 1}
          flow={resetFlow as ResetModalFlow}
          eventType={eventType}
          isRecord={isRecord}
          volumeAfter={previewVolumeAfter}
          penalty={previewPenalty}
          penaltyRate={previewPenaltyRate}
          triumphMsg={currentTriumphMsg}
          onSelectType={handleSelectType}
          onConfirm={handleConfirmReset}
          onConfirmTriumph={handleConfirmTriumph}
          onCancel={closeModal}
          onBeginAgain={closeModal}
        />
      )}
    </div>
  )
}
