'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import NavBar from '@/components/NavBar'
import { getSessionProfile } from '@/lib/app-data'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    getSessionProfile()
      .then(session => {
        if (!alive) return
        if (!session) router.replace('/login')
        else if (!session.profile?.onboarded) router.replace('/onboarding')
        else setReady(true)
      })
      .catch(() => router.replace('/login'))
    return () => { alive = false }
  }, [router])

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060302' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #D4A76A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 448, margin: '0 auto', minHeight: '100vh', position: 'relative', background: '#060302' }}>
      <div style={{ paddingBottom: 88 }}>
        {children}
      </div>
      <NavBar pathname={pathname} />
    </div>
  )
}
