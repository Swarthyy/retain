import { initials } from '@/lib/utils'

export default function Avatar({ name, size = 36, gold = false }: { name: string; size?: number; gold?: boolean }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: gold ? 'linear-gradient(135deg,#D4A76A55,#D4A76A22)' : '#1e1208',
      border: `1.5px solid ${gold ? '#D4A76A' : '#4a3322'}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-inter)',
      fontSize: size * 0.32,
      fontWeight: 800,
      color: gold ? '#D4A76A' : '#906e50',
      flexShrink: 0,
      boxShadow: gold ? '0 0 10px #D4A76A44' : undefined,
    }}>
      {initials(name)}
    </div>
  )
}
