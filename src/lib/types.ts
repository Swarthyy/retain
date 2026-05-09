export type Profile = {
  id: string
  username: string
  onboarded: boolean
  created_at: string
}

export type Streak = {
  user_id: string
  streak_start: string
  best_days: number
  celebrated_milestones: number[]
  volume_score: number
  last_event_at: string | null
  binge_count: number
  triumph_count: number
  partnered_count: number
}

export type Circle = {
  id: string
  name: string
  invite_code: string
}

export type FeedEvent = {
  id: string
  user_id: string
  username: string
  kind: string
  body: string
  cta: string | null
  created_at: string
  circle_id: string | null
  fresh?: boolean
}

export type LeaderboardEntry = {
  user_id: string
  username: string
  current: number
  best: number
  liveVolume: number
  triumphCount: number
  partneredCount: number
  masteryPct: number | null
}

export type SessionProfile = {
  userId: string
  email: string | null
  profile: Profile | null
}

export type OnboardingInput = {
  username: string
  streakDays: number
  bestDays?: number
  inviteCode?: string | null
}
