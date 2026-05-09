'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { completeOnboarding, createCircle, getSessionProfile } from '@/lib/app-data'
import { computeRankIndex, RANK_SCALE } from '@/lib/utils'
import type { SessionProfile } from '@/lib/types'

type Step = 'loading' | 'name' | 'streak' | 'circle' | 'finish'

const serif = 'var(--font-cormorant)'
const sans = 'var(--font-inter)'

const fullScreen: React.CSSProperties = {
  minHeight: '100vh',
  background: '#060302',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 28px',
  textAlign: 'center',
}

function cleanUsername(value: string) {
  return value.trim().toLowerCase()
}

export default function OnboardingPage() {
  const router = useRouter()
  const [session, setSession] = useState<SessionProfile | null>(null)
  const [step, setStep] = useState<Step>('loading')
  const [username, setUsername] = useState('')
  const [streakInput, setStreakInput] = useState('')
  const [bestInput, setBestInput] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [createdCode, setCreatedCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const streakDays = Number(streakInput || 0)
  const bestDays = Number(bestInput || streakInput || 0)
  const rank = useMemo(() => RANK_SCALE[computeRankIndex(streakDays)], [streakDays])

  function normalizeDays(value: string) {
    const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 4)
    return digits
  }

  useEffect(() => {
    let alive = true
    async function init() {
      const current = await getSessionProfile()
      if (!current) {
        router.replace('/login')
        return
      }

      const pending = localStorage.getItem('retain_pending_circle_code') || ''
      if (pending) setInviteCode(pending)

      if (!alive) return
      if (current.profile?.onboarded) {
        router.replace('/today')
        return
      }

      setSession(current)
      if (current.profile?.username) setUsername(current.profile.username)
      setStep(current.profile?.username ? 'streak' : 'name')
    }

    init()
    return () => { alive = false }
  }, [router])

  function nextFromName(e: React.FormEvent) {
    e.preventDefault()
    const clean = cleanUsername(username)
    if (!/^[a-z0-9_.]{2,24}$/.test(clean)) {
      setError('Use 2-24 lowercase letters, numbers, underscores, or dots.')
      return
    }
    setUsername(clean)
    setError('')
    setStep('streak')
  }

  function nextFromStreak(e: React.FormEvent) {
    e.preventDefault()
    if (!Number.isFinite(streakDays) || streakDays < 0 || streakDays > 9999) {
      setError('Enter a streak between 0 and 9999 days.')
      return
    }
    if (!Number.isFinite(bestDays) || bestDays < streakDays || bestDays > 9999) {
      setError('Your all-time best should be at least your current streak.')
      return
    }
    setError('')
    setStep('circle')
  }

  async function finish(mode: 'solo' | 'join' | 'create') {
    setSubmitting(true)
    setError('')
    try {
      if (mode === 'join' && inviteCode.trim().length !== 6) {
        throw new Error('Enter the 6-character invite code.')
      }

      await completeOnboarding({
        username,
        streakDays,
        bestDays,
        inviteCode: mode === 'join' ? inviteCode.trim().toUpperCase() : null,
      })
      localStorage.removeItem('retain_pending_circle_code')

      if (mode === 'create') {
        const circle = await createCircle()
        setCreatedCode(circle.invite_code)
        setStep('finish')
      } else {
        router.replace('/today')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'loading') {
    return (
      <div style={fullScreen}>
        <div style={{ width: 24, height: 24, border: '2px solid #D4A76A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (step === 'name') {
    return (
      <form onSubmit={nextFromName} style={fullScreen}>
        <div style={{ width: '100%', maxWidth: 340, animation: 'slideUp 0.5s ease both' }}>
          <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 64, color: '#EFE4CF', lineHeight: 1, marginBottom: 8 }}>retain</div>
          <div style={{ fontSize: 12, color: '#906e50', lineHeight: 1.6, marginBottom: 34 }}>
            {session?.email ? `Signed in as ${session.email}` : 'Choose your public name.'}
          </div>
          <input
            value={username}
            onChange={e => { setUsername(e.target.value); setError('') }}
            placeholder="username"
            maxLength={24}
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '2px solid rgba(212,167,106,0.5)', color: '#EFE4CF', fontFamily: serif, fontStyle: 'italic', fontSize: 54, textAlign: 'center', outline: 'none', padding: '6px 0 10px' }}
          />
          {error && <div style={{ color: '#e05555', fontSize: 12, marginTop: 12 }}>{error}</div>}
          <button disabled={submitting} style={{ marginTop: 30, width: '100%', minHeight: 54, background: '#D4A76A', color: '#060302', border: 'none', borderRadius: 14, fontFamily: sans, fontWeight: 800, cursor: 'pointer' }}>
            Continue
          </button>
        </div>
      </form>
    )
  }

  if (step === 'streak') {
    return (
      <form onSubmit={nextFromStreak} style={fullScreen}>
        <div style={{ width: '100%', maxWidth: 340, animation: 'slideUp 0.5s ease both' }}>
          <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 34, color: '#EFE4CF', lineHeight: 1.2, marginBottom: 12 }}>
            Are you already retaining?
          </div>
          <div style={{ fontSize: 13, color: '#906e50', lineHeight: 1.6, marginBottom: 24 }}>
            Enter your current streak and your all-time best. Both matter on the leaderboard.
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'block', textAlign: 'left' }}>
              <span style={{ display: 'block', fontSize: 10, color: '#906e50', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Current streak</span>
              <input
                type="text"
                inputMode="numeric"
                value={streakInput}
                onFocus={() => { if (streakInput === '0') setStreakInput('') }}
                onChange={e => { setStreakInput(normalizeDays(e.target.value)); setError('') }}
                placeholder="0"
                style={{ width: '100%', background: 'linear-gradient(180deg,#241407,#160b04)', border: '1px solid rgba(212,167,106,0.28)', borderRadius: 16, color: '#D4A76A', fontFamily: sans, fontSize: 48, fontWeight: 800, textAlign: 'center', outline: 'none', padding: '16px' }}
              />
            </label>
            <label style={{ display: 'block', textAlign: 'left' }}>
              <span style={{ display: 'block', fontSize: 10, color: '#906e50', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>All-time best</span>
              <input
                type="text"
                inputMode="numeric"
                value={bestInput}
                onFocus={() => { if (!bestInput && streakInput) setBestInput(streakInput) }}
                onChange={e => { setBestInput(normalizeDays(e.target.value)); setError('') }}
                placeholder={streakInput || '0'}
                style={{ width: '100%', background: 'rgba(239,228,207,0.05)', border: '1px solid rgba(239,228,207,0.12)', borderRadius: 14, color: '#EFE4CF', fontFamily: sans, fontSize: 26, fontWeight: 800, textAlign: 'center', outline: 'none', padding: '14px 16px' }}
              />
            </label>
          </div>
          <div style={{ color: rank.color, fontFamily: serif, fontStyle: 'italic', fontSize: 28, marginTop: 18 }}>{rank.title}</div>
          {error && <div style={{ color: '#e05555', fontSize: 12, marginTop: 12 }}>{error}</div>}
          <button disabled={submitting} style={{ marginTop: 30, width: '100%', minHeight: 54, background: '#D4A76A', color: '#060302', border: 'none', borderRadius: 14, fontFamily: sans, fontWeight: 800, cursor: 'pointer' }}>
            Continue
          </button>
          <button type="button" onClick={() => setStep('name')} style={{ marginTop: 14, background: 'none', border: 'none', color: '#4a3322', fontFamily: sans, cursor: 'pointer' }}>
            Back
          </button>
        </div>
      </form>
    )
  }

  if (step === 'circle') {
    return (
      <div style={fullScreen}>
        <div style={{ width: '100%', maxWidth: 340, animation: 'slideUp 0.5s ease both' }}>
          <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 34, color: '#EFE4CF', lineHeight: 1.2, marginBottom: 8 }}>
            Your circle.
          </div>
          <div style={{ fontSize: 13, color: '#906e50', lineHeight: 1.6, marginBottom: 26 }}>
            Create a private leaderboard, join your friends, or start solo.
          </div>
          <input
            value={inviteCode}
            onChange={e => { setInviteCode(e.target.value.toUpperCase()); setError('') }}
            placeholder="INVITE"
            maxLength={6}
            autoCapitalize="characters"
            style={{ width: '100%', background: '#1e1208', border: '1px solid rgba(239,228,207,0.15)', borderRadius: 14, padding: '16px 20px', color: '#D4A76A', fontFamily: sans, fontSize: 28, fontWeight: 800, letterSpacing: 8, outline: 'none', textAlign: 'center', marginBottom: 12 }}
          />
          {error && <div style={{ color: '#e05555', fontSize: 12, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => finish('join')} disabled={submitting || inviteCode.trim().length !== 6} style={{ width: '100%', minHeight: 54, background: inviteCode.trim().length === 6 ? '#D4A76A' : '#1e1208', color: inviteCode.trim().length === 6 ? '#060302' : '#4a3322', border: 'none', borderRadius: 14, fontFamily: sans, fontWeight: 800, cursor: inviteCode.trim().length === 6 ? 'pointer' : 'not-allowed' }}>
              {submitting ? 'Joining...' : 'Join with code'}
            </button>
            <button onClick={() => finish('create')} disabled={submitting} style={{ width: '100%', minHeight: 54, background: 'transparent', color: '#EFE4CF', border: '1px solid rgba(239,228,207,0.2)', borderRadius: 14, fontFamily: sans, fontWeight: 700, cursor: 'pointer' }}>
              Create a circle
            </button>
            <button onClick={() => finish('solo')} disabled={submitting} style={{ width: '100%', minHeight: 50, background: 'none', color: '#4a3322', border: 'none', fontFamily: sans, cursor: 'pointer' }}>
              Go solo for now
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={fullScreen}>
      <div style={{ width: '100%', maxWidth: 340, animation: 'scaleIn 0.4s ease both' }}>
        <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 34, color: '#D4A76A', marginBottom: 10 }}>
          Circle created.
        </div>
        <div style={{ color: '#906e50', fontSize: 13, marginBottom: 22 }}>Share this code with your friends:</div>
        <div style={{ color: '#D4A76A', background: 'rgba(212,167,106,0.1)', border: '1px solid rgba(212,167,106,0.3)', borderRadius: 16, padding: '20px 24px', fontSize: 34, fontWeight: 800, letterSpacing: 10, marginBottom: 28 }}>
          {createdCode}
        </div>
        <button onClick={() => router.replace('/today')} style={{ width: '100%', minHeight: 54, background: '#D4A76A', color: '#060302', border: 'none', borderRadius: 14, fontFamily: sans, fontWeight: 800, cursor: 'pointer' }}>
          Enter retain
        </button>
      </div>
    </div>
  )
}
