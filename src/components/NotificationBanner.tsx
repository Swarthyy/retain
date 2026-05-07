'use client'

export default function NotificationBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      background: 'rgba(30,18,8,0.97)',
      border: '1px solid rgba(212,167,106,0.22)',
      borderRadius: 14,
      padding: '12px 14px',
      animation: 'fadeIn 0.35s ease',
    }}>
      <div style={{ flex: 1, fontSize: 13, color: '#EFE4CF', lineHeight: 1.5, fontWeight: 500 }}>
        {message}
      </div>
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', color: '#4a3322', fontSize: 16, cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0, marginTop: 1 }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}
