'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const serif = 'var(--font-cormorant)'
const sans = 'var(--font-inter)'

export default function LoginPage() {
  const [mode, setMode] = useState<'begin' | 'returning'>('begin')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleBegin() {
    setLoading(true)
    setError('')
    // No DB user created yet — that happens in onboarding step 2
    localStorage.setItem('retain_user_id', '')
    localStorage.setItem('retain_username', '')
    localStorage.removeItem('retain_onboarded')
    router.push('/onboarding')
  }

  async function handleReturning(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = username.trim().toLowerCase()
    if (trimmed.length < 2) { setError('At least 2 characters.'); return }
    setLoading(true)
    setError('')

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', trimmed)
      .maybeSingle()

    if (!existing) {
      setError('No monk found with that name.')
      setLoading(false)
      return
    }

    localStorage.setItem('retain_user_id', existing.id)
    localStorage.setItem('retain_username', trimmed)
    router.push('/today')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: '#060302',
    }}>
      <div style={{ width: '100%', maxWidth: 340 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 80, color: '#EFE4CF', lineHeight: 0.9, letterSpacing: -2, animation: 'goldPulse 3s ease-in-out infinite' }}>
            retain
          </div>
          <div style={{ color: '#4a3322', fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', marginTop: 14, fontWeight: 600 }}>
            multiplayer streak
          </div>
        </div>

        {mode === 'begin' ? (
          <div style={{ animation: 'fadeIn 0.4s ease both' }}>
            <button
              onClick={handleBegin}
              disabled={loading}
              style={{
                width: '100%', minHeight: 58,
                background: loading ? '#1e1208' : '#D4A76A',
                color: loading ? '#4a3322' : '#060302',
                fontFamily: sans, fontSize: 16, fontWeight: 800,
                border: 'none', borderRadius: 16,
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: 0.3,
                transition: 'all 0.2s',
              }}
            >
              {loading ? 'entering…' : 'Begin'}
            </button>

            {error && <div style={{ fontSize: 12, color: '#e05555', textAlign: 'center', marginTop: 10 }}>{error}</div>}

            <button
              onClick={() => { setMode('returning'); setError('') }}
              style={{ display: 'block', width: '100%', marginTop: 16, background: 'none', border: 'none', color: '#4a3322', fontFamily: sans, fontSize: 13, cursor: 'pointer', letterSpacing: 0.3 }}
            >
              Already a monk? →
            </button>
          </div>
        ) : (
          <form onSubmit={handleReturning} style={{ animation: 'fadeIn 0.35s ease both', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="your username"
              maxLength={24}
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              style={{
                background: '#1e1208',
                border: '1px solid rgba(239,228,207,0.15)',
                borderRadius: 14, padding: '16px 20px',
                color: '#EFE4CF', fontFamily: sans,
                fontSize: 16, fontWeight: 500,
                outline: 'none', width: '100%', letterSpacing: 0.2,
              }}
            />

            {error && <div style={{ fontSize: 12, color: '#e05555', textAlign: 'center', marginTop: -4 }}>{error}</div>}

            <button
              type="submit"
              disabled={loading || username.trim().length < 2}
              style={{
                background: loading || username.trim().length < 2 ? '#1e1208' : '#D4A76A',
                color: loading || username.trim().length < 2 ? '#4a3322' : '#060302',
                border: 'none', borderRadius: 14, padding: '16px',
                fontSize: 15, fontWeight: 800,
                cursor: loading || username.trim().length < 2 ? 'not-allowed' : 'pointer',
                fontFamily: sans, minHeight: 52, transition: 'all 0.2s',
                letterSpacing: 0.3,
              }}
            >
              {loading ? 'looking…' : 'Return'}
            </button>

            <button
              type="button"
              onClick={() => { setMode('begin'); setError(''); setUsername('') }}
              style={{ background: 'none', border: 'none', color: '#4a3322', fontFamily: sans, fontSize: 13, cursor: 'pointer', letterSpacing: 0.3 }}
            >
              ← New here
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
