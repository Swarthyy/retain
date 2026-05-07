'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { timeAgo } from '@/lib/utils'

type FeedEvent = {
  id: string
  user_id: string
  username: string
  kind: string
  body: string
  cta: string
  created_at: string
  circle_id: string | null
  fresh?: boolean
}

type KindCfg = { label: string; accent: string; bg: string; icon: string; pulse?: boolean }

const CFGS: Record<string, KindCfg> = {
  triumph:          { label: 'Triumph',       accent: '#D4A76A', bg: 'rgba(212,167,106,0.10)', icon: '♦', pulse: true },
  lapse:            { label: 'Lapse',         accent: '#6b3030', bg: 'rgba(107,48,48,0.10)',   icon: '↓' },
  failure:          { label: 'Lapse',         accent: '#6b3030', bg: 'rgba(107,48,48,0.10)',   icon: '↓' },
  conscious:        { label: 'Conscious',     accent: '#C49AAA', bg: 'rgba(139,94,110,0.08)', icon: '○' },
  milestone_first:  { label: 'Milestone',     accent: '#D4A76A', bg: 'rgba(212,167,106,0.08)', icon: '★' },
  milestone_return: { label: 'Back to rank',  accent: '#D78A50', bg: 'rgba(215,138,80,0.08)', icon: '◆' },
  milestone:        { label: 'Milestone',     accent: '#D4A76A', bg: 'rgba(212,167,106,0.08)', icon: '★' },
  joined_circle:    { label: 'Joined',        accent: '#4CAF50', bg: 'rgba(76,175,80,0.08)',  icon: '⚔' },
  crown_transfer:   { label: 'Crown',         accent: '#D4A76A', bg: 'rgba(212,167,106,0.12)', icon: '♛', pulse: true },
  relic:            { label: 'Relic earned',  accent: '#D4A76A', bg: 'rgba(212,167,106,0.10)', icon: '◎', pulse: true },
}

const fallback: KindCfg = { label: 'Event', accent: '#906e50', bg: 'rgba(144,110,80,0.06)', icon: '·' }

export default function FeedPage() {
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [unread, setUnread] = useState(0)
  const [circleId, setCircleId] = useState<string | null>(null)
  const [userId, setUserId] = useState('')
  const seenRef = useRef(new Set<string>())
  const circleIdRef = useRef<string | null>(null)
  const userIdRef = useRef('')

  useEffect(() => {
    const uid = localStorage.getItem('retain_user_id') || ''
    setUserId(uid)
    userIdRef.current = uid

    async function load() {
      let cid: string | null = null
      if (uid) {
        const { data: membership } = await supabase
          .from('circle_members').select('circle_id').eq('user_id', uid).maybeSingle()
        if (membership) { cid = membership.circle_id; setCircleId(cid); circleIdRef.current = cid }
      }

      let query = supabase
        .from('events')
        .select('id,user_id,username,kind,body,cta,created_at,circle_id')
        .order('created_at', { ascending: false })
        .limit(60)

      if (cid) {
        query = query.eq('circle_id', cid)
      } else if (uid) {
        query = query.eq('user_id', uid)
      }

      const { data } = await query
      if (data) {
        data.forEach(e => seenRef.current.add(e.id))
        setEvents(data as FeedEvent[])
      }
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel('chronicles-v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, payload => {
        const ev = payload.new as FeedEvent
        if (seenRef.current.has(ev.id)) return
        const myCircle = circleIdRef.current
        const myUid = userIdRef.current
        if (myCircle && ev.circle_id !== myCircle) return
        if (!myCircle && ev.user_id !== myUid) return
        seenRef.current.add(ev.id)
        setEvents(prev => [{ ...ev, fresh: true }, ...prev])
        setUnread(n => n + 1)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { circleIdRef.current = circleId }, [circleId])
  useEffect(() => { userIdRef.current = userId }, [userId])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #D4A76A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ padding: '52px 0 24px' }}>

      {/* Header */}
      <div style={{ padding: '4px 20px 8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-cormorant)', fontStyle: 'italic', fontSize: 30, color: '#EFE4CF', fontWeight: 400 }}>
            Chronicles
          </div>
          <div style={{ fontSize: 11, color: '#4a3322', marginTop: 2, letterSpacing: 0.5 }}>
            {circleId ? "Your circle's events" : 'Your events'}
          </div>
        </div>
        {unread > 0 && (
          <button
            onClick={() => setUnread(0)}
            style={{ background: '#D4A76A', color: '#060302', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-inter)' }}
          >
            {unread} new
          </button>
        )}
      </div>

      <div style={{ padding: '0 20px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4CAF50', boxShadow: '0 0 6px #4CAF5088', animation: 'blink 1.4s steps(1) infinite' }} />
        <span style={{ fontSize: 11, color: '#906e50', letterSpacing: 1 }}>Updating live</span>
      </div>

      {events.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#4a3322', fontSize: 14, lineHeight: 1.7 }}>
          {circleId
            ? 'No circle events yet.\nMilestones, triumphs, and lapses appear here.'
            : 'No events yet. Log an event or hit a milestone to appear here.'}
        </div>
      )}

      <div style={{ padding: '0 20px' }}>
        {events.map(ev => {
          const c = CFGS[ev.kind] ?? fallback
          const dimmed = ev.kind === 'lapse' || ev.kind === 'failure'
          return (
            <div key={ev.id} style={{
              padding: '14px 16px', marginBottom: 8, borderRadius: 14,
              background: ev.fresh ? c.bg : dimmed ? 'rgba(107,48,48,0.06)' : 'rgba(239,228,207,0.04)',
              border: `1px solid ${ev.fresh ? c.accent + '44' : dimmed ? 'rgba(107,48,48,0.15)' : 'rgba(239,228,207,0.08)'}`,
              display: 'flex', gap: 12,
              animation: ev.fresh ? 'fadeIn 0.3s ease' : undefined,
              opacity: dimmed ? 0.8 : 1,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: c.accent + '22',
                border: `1.5px solid ${c.accent}${dimmed ? '33' : '55'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color: c.accent, fontWeight: 800, flexShrink: 0,
                animation: c.pulse ? 'goldPulse 2.5s ease-in-out infinite' : undefined,
              }}>
                {c.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 10, letterSpacing: 2, color: dimmed ? '#4a3322' : c.accent, textTransform: 'uppercase', fontWeight: 700 }}>{c.label}</span>
                  <span style={{ fontSize: 10, color: '#4a3322' }}>{timeAgo(ev.created_at)}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: dimmed ? 400 : 700, color: dimmed ? '#4a3322' : '#EFE4CF', letterSpacing: -0.1, lineHeight: 1.4 }}>
                  {ev.body}
                </div>
                {ev.cta && (
                  <div style={{ fontSize: 11, color: dimmed ? '#2a1208' : '#906e50', marginTop: 5, lineHeight: 1.4 }}>{ev.cta}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
