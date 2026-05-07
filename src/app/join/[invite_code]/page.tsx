'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const serif = 'var(--font-cormorant)'
const sans = 'var(--font-inter)'

export default function JoinPage() {
  const params = useParams<{ invite_code: string }>()
  const code = (params.invite_code || '').toUpperCase()
  const router = useRouter()

  const [circle, setCircle] = useState<{ id: string; name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState('')
  const [alreadyMember, setAlreadyMember] = useState(false)

  useEffect(() => {
    if (!code) return
    const uid = localStorage.getItem('retain_user_id') || ''

    if (!uid) {
      // Not logged in — store the code and bounce to onboarding
      localStorage.setItem('retain_pending_circle_code', code)
      router.replace('/onboarding')
      return
    }

    async function init() {
      const { data: circ } = await supabase
        .from('circles').select('id, name').eq('invite_code', code).maybeSingle()

      if (!circ) { setError('This invite link is invalid or has expired.'); setLoading(false); return }
      setCircle(circ)

      // Check if already a member
      const { data: mem } = await supabase
        .from('circle_members').select('id').eq('circle_id', circ.id).eq('user_id', uid).maybeSingle()
      if (mem) setAlreadyMember(true)
      setLoading(false)
    }

    init()
  }, [code, router])

  async function handleJoin() {
    if (!circle) return
    setJoining(true)
    const uid = localStorage.getItem('retain_user_id') || ''
    const uname = localStorage.getItem('retain_username') || ''

    await supabase.from('circle_members').upsert({ circle_id: circle.id, user_id: uid }, { onConflict: 'circle_id,user_id' })
    await supabase.from('events').insert({
      user_id: uid, username: uname,
      kind: 'joined_circle',
      body: 'joined the circle.',
      cta: 'The rivalry begins.',
      circle_id: circle.id,
    })

    setJoined(true)
    setJoining(false)
    setTimeout(() => router.push('/leaderboard'), 1800)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060302' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #D4A76A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', background: '#060302', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 16, opacity: 0.4 }}>⚔</div>
        <div style={{ fontSize: 16, color: '#4a3322', lineHeight: 1.6 }}>{error}</div>
        <button onClick={() => router.push('/today')} style={{ marginTop: 32, minHeight: 48, padding: '0 28px', background: 'transparent', border: '1px solid rgba(239,228,207,0.15)', borderRadius: 12, color: '#4a3322', fontFamily: sans, fontSize: 14, cursor: 'pointer' }}>
          Go home
        </button>
      </div>
    )
  }

  if (joined) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', background: '#060302', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16, animation: 'goldPulse 2s ease-in-out infinite' }}>⚔</div>
        <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 32, color: '#D4A76A', marginBottom: 8 }}>Joined.</div>
        <div style={{ fontSize: 14, color: '#906e50' }}>Taking you to the leaderboard…</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', background: '#060302', textAlign: 'center' }}>

      <div style={{ fontSize: 44, marginBottom: 20, animation: 'goldPulse 3s ease-in-out infinite' }}>⚔</div>

      <div style={{ fontSize: 11, color: '#4a3322', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 12 }}>
        You've been summoned
      </div>

      <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 34, color: '#EFE4CF', lineHeight: 1.2, marginBottom: 8 }}>
        {circle?.name}
      </div>

      <div style={{ fontSize: 14, color: '#906e50', lineHeight: 1.6, maxWidth: 280, marginBottom: 40 }}>
        {alreadyMember
          ? "You're already a member of this circle."
          : 'A brotherhood of accountability. Join and let the rivalry begin.'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320 }}>
        {alreadyMember ? (
          <button onClick={() => router.push('/leaderboard')} style={{ width: '100%', minHeight: 54, background: '#D4A76A', color: '#060302', fontFamily: sans, fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 14, cursor: 'pointer' }}>
            View leaderboard
          </button>
        ) : (
          <button onClick={handleJoin} disabled={joining} style={{ width: '100%', minHeight: 54, background: joining ? '#1e1208' : '#D4A76A', color: joining ? '#4a3322' : '#060302', fontFamily: sans, fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 14, cursor: joining ? 'not-allowed' : 'pointer' }}>
            {joining ? 'joining…' : `Join ${circle?.name}`}
          </button>
        )}
        <button onClick={() => router.push('/today')} style={{ width: '100%', minHeight: 48, background: 'transparent', color: '#4a3322', fontFamily: sans, fontSize: 14, border: 'none', cursor: 'pointer' }}>
          Not now
        </button>
      </div>
    </div>
  )
}
