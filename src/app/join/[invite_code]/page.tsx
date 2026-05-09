'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSessionProfile, joinCircle } from '@/lib/app-data'

const serif = 'var(--font-cormorant)'
const sans = 'var(--font-inter)'

export default function JoinPage() {
  const params = useParams<{ invite_code: string }>()
  const code = (params.invite_code || '').toUpperCase()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function init() {
      if (!code) return
      localStorage.setItem('retain_pending_circle_code', code)
      const session = await getSessionProfile()
      if (!alive) return
      if (!session) {
        router.replace('/login')
      } else if (!session.profile?.onboarded) {
        router.replace('/onboarding')
      } else {
        setLoading(false)
      }
    }
    init().catch(err => {
      setError(err instanceof Error ? err.message : 'Could not open invite.')
      setLoading(false)
    })
    return () => { alive = false }
  }, [code, router])

  async function handleJoin() {
    setJoining(true)
    setError('')
    try {
      await joinCircle(code)
      localStorage.removeItem('retain_pending_circle_code')
      router.replace('/leaderboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join circle.')
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060302' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #D4A76A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, background: '#060302', textAlign: 'center' }}>
      <div style={{ fontSize: 44, marginBottom: 20, animation: 'goldPulse 3s ease-in-out infinite' }}>⚔</div>
      <div style={{ fontSize: 11, color: '#4a3322', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 12 }}>
        Invite code
      </div>
      <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 42, color: '#D4A76A', lineHeight: 1.2, marginBottom: 12, letterSpacing: 4 }}>
        {code}
      </div>
      <div style={{ fontSize: 14, color: '#906e50', lineHeight: 1.6, maxWidth: 280, marginBottom: 28 }}>
        Join this private circle and enter the leaderboard.
      </div>
      {error && <div style={{ fontSize: 12, color: '#e05555', lineHeight: 1.5, marginBottom: 14 }}>{error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320 }}>
        <button onClick={handleJoin} disabled={joining} style={{ width: '100%', minHeight: 54, background: joining ? '#1e1208' : '#D4A76A', color: joining ? '#4a3322' : '#060302', fontFamily: sans, fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 14, cursor: joining ? 'not-allowed' : 'pointer' }}>
          {joining ? 'Joining...' : 'Join circle'}
        </button>
        <button onClick={() => router.push('/today')} style={{ width: '100%', minHeight: 48, background: 'transparent', color: '#4a3322', fontFamily: sans, fontSize: 14, border: 'none', cursor: 'pointer' }}>
          Not now
        </button>
      </div>
    </div>
  )
}
