export function getCurrentDays(streakStart: string): number {
  const start = new Date(streakStart)
  const today = new Date()
  start.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
}

export function startDateLabel(days: number): string {
  const dt = new Date()
  dt.setDate(dt.getDate() - days)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const RANK_SCALE = [
  { title: 'Gooner',     desc: 'No resolve. The abyss stares back.',           color: '#9B3030', icon: '☠' },
  { title: 'Novice',     desc: 'The first step is taken.',                      color: '#7a7060', icon: '○' },
  { title: 'Initiate',   desc: 'A week held. The seed is planted.',             color: '#6b8040', icon: '◇' },
  { title: 'Apprentice', desc: 'Fourteen days. The body learns patience.',      color: '#4878a0', icon: '◆' },
  { title: 'Warrior',    desc: 'Thirty days. Most men never stand here.',       color: '#c07830', icon: '⚔' },
  { title: 'Monk',       desc: 'Sixty days of silence and strength.',           color: '#8060b0', icon: '☯' },
  { title: 'Disciple',   desc: 'Ninety days. You are not the same man.',        color: '#308888', icon: '✦' },
  { title: 'Elder',      desc: 'Half a year. You breathe different now.',       color: '#4880b8', icon: '✧' },
  { title: 'Ascetic',    desc: 'A full year conquered. The self is yours.',     color: '#a0a8b8', icon: '◎' },
  { title: 'Sage',       desc: 'A year, rarely fallen. Mastery begins.',        color: '#30a860', icon: '✺' },
  { title: 'Master',     desc: 'Two years of near-flawless discipline.',        color: '#4060d0', icon: '★' },
  { title: 'GOAT',       desc: 'Legendary. Untouchable. The monastery bows.',   color: '#D4A76A', icon: '♛' },
]

export function computeRankIndex(days: number, annualResets = 0): number {
  if (days >= 365 && annualResets === 0) return 11
  if (days >= 730) return 10
  if (days >= 365 && annualResets <= 2) return 9
  if (days >= 365) return 8
  if (days >= 180) return 7
  if (days >= 90) return 6
  if (days >= 60) return 5
  if (days >= 30) return 4
  if (days >= 14) return 3
  if (days >= 7) return 2
  if (days >= 1) return 1
  return 0
}

export function rankTitle(days: number, annualResets = 0): string {
  return RANK_SCALE[computeRankIndex(days, annualResets)].title
}

export function dayWord(n: number): string {
  return n === 1 ? 'day' : 'days'
}

export function initials(name: string): string {
  return name.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || '??'
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Still standing.'
  if (h < 12) return 'Good morning.'
  if (h < 17) return 'Good afternoon.'
  if (h < 21) return 'Good evening.'
  return 'Still here.'
}

export const MILESTONES = [30, 60, 90, 180, 365]
export const MILESTONE_TITLES: Record<number, string> = {
  30: 'Warrior',
  60: 'Monk',
  90: 'Disciple',
  180: 'Elder',
  365: 'Ascetic',
}

export function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Mastery & Class ────────────────────────────────────────────────────────

export function masteryRatio(triumphCount: number, partneredCount: number): number | null {
  if (partneredCount === 0) return null
  return Math.round((triumphCount / partneredCount) * 100)
}

export function masteryClass(days: number, triumphCount: number, partneredCount: number): string {
  if (partneredCount === 0 && days >= 30) return 'The Ascetic'
  const ratio = partneredCount > 0 ? triumphCount / partneredCount : 0
  if (days >= 30 && ratio >= 0.7 && triumphCount >= 3) return 'The Alchemist'
  return 'The Initiate'
}

// ── Triumph message generator (time-aware) ────────────────────────────────

export function triumphMessage(username: string): string {
  const hour = new Date().getHours()
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (hour >= 0 && hour < 5) {
    return `Emergency Alert: ${username} successfully deployed the weapon at ${timeStr}. Payload retained. The brotherhood sleeps peacefully.`
  }
  if (hour >= 5 && hour < 10) {
    return `${username} skipped the coffee and chose violence this morning. The seed remains.`
  }
  const pool = [
    `${username} walked through the fire and emerged unburned. The streak holds.`,
    `${username} faced the test and did not yield. The reservoir grows.`,
    `${username} held the line. The monastery takes note.`,
    `The fire was lit. ${username} let it burn but kept the seed. The streak endures.`,
  ]
  return pool[Math.floor(Math.random() * pool.length)]
}

// ── Volume ─────────────────────────────────────────────────────────────────

export function getLiveVolume(volumeScore: number, streakStart: string): number {
  return Math.floor(volumeScore + getCurrentDays(streakStart))
}

export function calcResetPenalty(
  liveVolume: number,
  multiplier: number
): { penaltyRate: number; multiplier: number; volumeAfter: number; penalty: number } {
  const penaltyRate = Math.min(0.15 * multiplier, 1.0)
  const penalty = Math.round(liveVolume * penaltyRate)
  const volumeAfter = Math.max(0, liveVolume - penalty)
  return { penaltyRate, multiplier, volumeAfter, penalty }
}

export function inBingeWindow(lastEventAt: string | null | undefined): boolean {
  if (!lastEventAt) return false
  const daysSince = (Date.now() - new Date(lastEventAt).getTime()) / (1000 * 60 * 60 * 24)
  return daysSince < 14
}
