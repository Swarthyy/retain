'use client'

import Link from 'next/link'

const TABS = [
  {
    href: '/today',
    label: 'Today',
    icon: (c: string) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="7.5" stroke={c} strokeWidth="1.7" />
        <path d="M11 7v4l3 3" stroke={c} strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/leaderboard',
    label: 'Ranks',
    icon: (c: string) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M4 15l4.5-5.5 4 3 3.5-4.5 3 3" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 18h16" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      </svg>
    ),
  },
  {
    href: '/feed',
    label: 'Feed',
    icon: (c: string) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M5 7h12M5 11h8M5 15h6" stroke={c} strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (c: string) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="8" r="3.5" stroke={c} strokeWidth="1.7" />
        <path d="M4 18c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke={c} strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function NavBar({ pathname }: { pathname: string }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 448,
      height: 88,
      background: 'rgba(6,3,2,0.92)',
      backdropFilter: 'blur(24px) saturate(200%)',
      WebkitBackdropFilter: 'blur(24px) saturate(200%)',
      borderTop: '0.5px solid rgba(239,228,207,0.1)',
      display: 'flex',
      padding: '8px 0 24px',
      zIndex: 50,
    }}>
      {TABS.map(tab => {
        const active = pathname === tab.href
        const c = active ? '#D4A76A' : '#4a3322'
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '8px 0',
              textDecoration: 'none',
              minHeight: 44,
            }}
          >
            {tab.icon(c)}
            <span style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: '0.3px',
              color: c,
              fontFamily: 'var(--font-inter)',
            }}>
              {tab.label}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
