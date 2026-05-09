'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSessionProfile } from '@/lib/app-data'

const serif = 'var(--font-cormorant)'
const sans = 'var(--font-inter)'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    getSessionProfile()
      .then(session => {
        if (!alive) return
        if (session) router.replace(session.profile?.onboarded ? '/today' : '/onboarding')
        else setLoading(false)
      })
      .catch(() => setLoading(false))
    return () => { alive = false }
  }, [router])

  function normalizeUsername(value: string) {
    return value.trim().toLowerCase()
  }

  async function handlePasswordAuth(e: React.FormEvent) {
    e.preventDefault()
    const clean = normalizeUsername(username)
    if (!/^[a-z0-9_.]{2,24}$/.test(clean)) {
      setError('Use 2-24 lowercase letters, numbers, underscores, or dots.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setSubmitting(true)
    setError('')

    if (mode === 'signup') {
      const { data: existing, error: lookupError } = await supabase
        .from('users')
        .select('id')
        .eq('username', clean)
        .maybeSingle()
      if (lookupError) {
        setSubmitting(false)
        setError(lookupError.message)
        return
      }
      if (existing) {
        setSubmitting(false)
        setError('That username is taken.')
        return
      }

      const { data: created, error: createError } = await supabase
        .from('users')
        .insert({ username: clean })
        .select('id')
        .single()
      if (createError || !created) {
        setSubmitting(false)
        setError(createError?.message || 'Could not create account.')
        return
      }

      await supabase.from('streaks').insert({
        user_id: created.id,
        streak_start: new Date().toISOString().split('T')[0],
        best_days: 0,
        celebrated_milestones: [],
        volume_score: 0,
      })

      localStorage.setItem('retain_user_id', created.id)
      localStorage.setItem('retain_username', clean)
      localStorage.setItem(`retain_pw_${clean}`, password)
      localStorage.removeItem('retain_onboarded')
      router.replace('/onboarding')
      return
    }

    const savedPassword = localStorage.getItem(`retain_pw_${clean}`)
    if (savedPassword && savedPassword !== password) {
      setSubmitting(false)
      setError('Wrong password on this device.')
      return
    }

    const { data: existing, error: lookupError } = await supabase
      .from('users')
      .select('id')
      .eq('username', clean)
      .maybeSingle()
    if (lookupError || !existing) {
      setSubmitting(false)
      setError(lookupError?.message || 'No account found with that username.')
      return
    }

    localStorage.setItem('retain_user_id', existing.id)
    localStorage.setItem('retain_username', clean)
    if (!savedPassword) localStorage.setItem(`retain_pw_${clean}`, password)
    localStorage.setItem('retain_onboarded', 'true')
    router.replace('/today')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060302' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #D4A76A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#060302' }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 80, color: '#EFE4CF', lineHeight: 0.9, letterSpacing: -2, animation: 'goldPulse 3s ease-in-out infinite' }}>
            retain
          </div>
          <div style={{ color: '#4a3322', fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', marginTop: 14, fontWeight: 600 }}>
            multiplayer streak
          </div>
        </div>

        <form onSubmit={handlePasswordAuth} style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeIn 0.35s ease both' }}>
          <div style={{ display: 'flex', gap: 4, background: '#1e1208', borderRadius: 12, padding: 4, marginBottom: 4 }}>
            {(['signin', 'signup'] as const).map(k => {
              const active = mode === k
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setMode(k); setError('') }}
                  style={{ flex: 1, minHeight: 38, background: active ? '#D4A76A' : 'transparent', color: active ? '#060302' : '#906e50', border: 'none', borderRadius: 9, fontFamily: sans, fontSize: 12, fontWeight: active ? 800 : 500, cursor: 'pointer' }}
                >
                  {k === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              )
            })}
          </div>

            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError('') }}
              placeholder="username"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              style={{ background: '#1e1208', border: '1px solid rgba(239,228,207,0.15)', borderRadius: 14, padding: '16px 20px', color: '#EFE4CF', fontFamily: sans, fontSize: 16, outline: 'none', width: '100%' }}
            />

            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              style={{ background: '#1e1208', border: '1px solid rgba(239,228,207,0.15)', borderRadius: 14, padding: '16px 20px', color: '#EFE4CF', fontFamily: sans, fontSize: 16, outline: 'none', width: '100%' }}
            />

          {error && <div style={{ fontSize: 12, color: '#e05555', textAlign: 'center', lineHeight: 1.5 }}>{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            style={{ background: submitting ? '#1e1208' : '#D4A76A', color: submitting ? '#4a3322' : '#060302', border: 'none', borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: sans, minHeight: 54 }}
          >
            {submitting ? 'checking...' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          <div style={{ fontSize: 11, color: '#4a3322', lineHeight: 1.5, textAlign: 'center' }}>
            Friends can use a unique username and password. No email link required.
          </div>
        </form>
      </div>
    </div>
  )
}
