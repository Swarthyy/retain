'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionProfile } from '@/lib/app-data'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    let alive = true
    getSessionProfile()
      .then(session => {
        if (!alive) return
        if (!session) router.replace('/login')
        else router.replace(session.profile?.onboarded ? '/today' : '/onboarding')
      })
      .catch(() => router.replace('/login'))
    return () => { alive = false }
  }, [router])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060302' }}>
      <div style={{ width: 24, height: 24, border: '2px solid #D4A76A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}
