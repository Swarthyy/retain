import { supabase } from '@/lib/supabase'
import { getCurrentDays, getLiveVolume, masteryRatio } from '@/lib/utils'
import type { Circle, FeedEvent, LeaderboardEntry, OnboardingInput, Profile, SessionProfile, Streak } from '@/lib/types'

type RpcCircle = { id: string; name: string; invite_code: string }

export async function getSessionProfile(): Promise<SessionProfile | null> {
  if (typeof window !== 'undefined') {
    const userId = localStorage.getItem('retain_user_id')
    const username = localStorage.getItem('retain_username')
    if (userId && username) {
      return {
        userId,
        email: null,
        profile: {
          id: userId,
          username,
          onboarded: localStorage.getItem('retain_onboarded') === 'true',
          created_at: '',
        },
      }
    }
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return null

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id,username,onboarded,created_at')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw error
  return { userId: user.id, email: user.email ?? null, profile: profile as Profile | null }
}

export async function completeOnboarding(input: OnboardingInput) {
  if (typeof window !== 'undefined') {
    const userId = localStorage.getItem('retain_user_id')
    if (userId) {
      const days = Math.max(0, Math.min(input.streakDays, 9999))
      const bestDays = Math.max(days, Math.min(input.bestDays ?? days, 9999))
      const start = new Date()
      start.setDate(start.getDate() - days)
      const streakStart = start.toISOString().split('T')[0]
      const celebrated = [30, 60, 90, 180, 365].filter(m => m <= days)
      const { error: streakError } = await supabase.from('streaks').upsert({
        user_id: userId,
        streak_start: streakStart,
        best_days: bestDays,
        celebrated_milestones: celebrated,
        volume_score: days,
      }, { onConflict: 'user_id' })
      if (streakError) throw streakError

      if (input.inviteCode) await joinCircle(input.inviteCode)
      localStorage.setItem('retain_onboarded', 'true')
      return { profile_id: userId, joined_circle_id: null }
    }
  }

  const { data, error } = await supabase
    .rpc('complete_onboarding', {
      p_username: input.username,
      p_streak_days: input.streakDays,
      p_best_days: input.bestDays ?? input.streakDays,
      p_invite_code: input.inviteCode || null,
    })
    .single()

  if (error) throw error
  return data
}

export async function createCircle(): Promise<Circle> {
  if (typeof window !== 'undefined') {
    const userId = localStorage.getItem('retain_user_id')
    const username = localStorage.getItem('retain_username') || 'friend'
    if (userId) {
      const code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')
      const { data, error } = await supabase
        .from('circles')
        .insert({ name: `${username}'s circle`, invite_code: code, creator_id: userId })
        .select('id,name,invite_code')
        .single()
      if (error) throw error
      await supabase.from('circle_members').upsert({ circle_id: data.id, user_id: userId }, { onConflict: 'circle_id,user_id' })
      await supabase.from('events').insert({ user_id: userId, username, kind: 'joined_circle', body: 'created a circle.', cta: 'The brotherhood is open.', circle_id: data.id })
      return data as Circle
    }
  }

  const { data, error } = await supabase.rpc('create_circle').single()
  if (error) throw error
  const circle = data as RpcCircle
  return { id: circle.id, name: circle.name, invite_code: circle.invite_code }
}

export async function joinCircle(inviteCode: string): Promise<Circle> {
  if (typeof window !== 'undefined') {
    const userId = localStorage.getItem('retain_user_id')
    const username = localStorage.getItem('retain_username') || 'friend'
    if (userId) {
      const { data: circle, error } = await supabase
        .from('circles')
        .select('id,name,invite_code')
        .eq('invite_code', inviteCode.trim().toUpperCase())
        .maybeSingle()
      if (error) throw error
      if (!circle) throw new Error('No circle found with that code.')
      await supabase.from('circle_members').upsert({ circle_id: circle.id, user_id: userId }, { onConflict: 'circle_id,user_id' })
      await supabase.from('events').insert({ user_id: userId, username, kind: 'joined_circle', body: 'joined the circle.', cta: 'The rivalry begins.', circle_id: circle.id })
      return circle as Circle
    }
  }

  const { data, error } = await supabase
    .rpc('join_circle', { p_invite_code: inviteCode.trim().toUpperCase() })
    .single()
  if (error) throw error
  const circle = data as RpcCircle
  return { id: circle.id, name: circle.name, invite_code: circle.invite_code }
}

export async function logRetentionEvent(eventType: 'triumph' | 'lapse' | 'conscious') {
  if (typeof window !== 'undefined') {
    const userId = localStorage.getItem('retain_user_id')
    const username = localStorage.getItem('retain_username') || 'friend'
    if (userId) {
      const streak = await getMyStreak()
      if (!streak) throw new Error('No streak found.')
      const circle = await getMyCircle()
      const days = getCurrentDays(streak.streak_start)
      const liveVolume = getLiveVolume(streak.volume_score || 0, streak.streak_start)
      const today = new Date().toISOString().split('T')[0]

      if (eventType === 'triumph') {
        await supabase.from('daily_log').upsert({ user_id: userId, log_date: today, day_type: 'triumph' }, { onConflict: 'user_id,log_date' })
        await supabase.from('streaks').update({
          triumph_count: (streak.triumph_count || 0) + 1,
          partnered_count: (streak.partnered_count || 0) + 1,
        }).eq('user_id', userId)
        await supabase.from('events').insert({ user_id: userId, username, kind: 'triumph', body: `${username} held the line. The streak endures.`, cta: `${days} days and the streak holds.`, circle_id: circle?.id ?? null })
        return
      }

      const multiplier = streak.last_event_at && (Date.now() - new Date(streak.last_event_at).getTime()) / 86400000 < 14
        ? Math.max(1, (streak.binge_count || 0) + 1)
        : 1
      const penalty = Math.round(liveVolume * Math.min(0.15 * multiplier, 1))
      const volumeAfter = Math.max(0, liveVolume - penalty)
      const newBest = Math.max(streak.best_days || 0, days)
      await supabase.from('daily_log').upsert({ user_id: userId, log_date: today, day_type: eventType }, { onConflict: 'user_id,log_date' })
      await supabase.from('streaks').update({
        streak_start: today,
        best_days: newBest,
        celebrated_milestones: [],
        volume_score: volumeAfter,
        last_event_at: new Date().toISOString(),
        binge_count: multiplier,
        partnered_count: (streak.partnered_count || 0) + (eventType === 'conscious' ? 1 : 0),
      }).eq('user_id', userId)
      await supabase.from('events').insert({ user_id: userId, username, kind: eventType, body: `${username} reset after ${days} days. The reservoir drains to ${volumeAfter}.`, cta: `Best remains ${newBest} days.`, circle_id: circle?.id ?? null })
      return
    }
  }

  const { error } = await supabase.rpc('log_retention_event', { p_event_type: eventType })
  if (error) throw error
}

export async function getMyStreak(): Promise<Streak | null> {
  let query = supabase
    .from('streaks')
    .select('user_id,streak_start,best_days,celebrated_milestones,volume_score,last_event_at,binge_count,triumph_count,partnered_count')
  if (typeof window !== 'undefined') {
    const userId = localStorage.getItem('retain_user_id')
    if (userId) query = query.eq('user_id', userId)
  }
  const { data, error } = await query.maybeSingle()

  if (error) throw error
  return data as Streak | null
}

export async function getMyCircle(): Promise<Circle | null> {
  let query = supabase
    .from('circle_members')
    .select('circles(id,name,invite_code)')
  if (typeof window !== 'undefined') {
    const userId = localStorage.getItem('retain_user_id')
    if (userId) query = query.eq('user_id', userId)
  }
  const { data, error } = await query.maybeSingle()

  if (error) throw error
  if (!data?.circles) return null
  return data.circles as unknown as Circle
}

export async function getCircleMemberIds(circleId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('circle_members')
    .select('user_id')
    .eq('circle_id', circleId)

  if (error) throw error
  return (data || []).map((r: { user_id: string }) => r.user_id)
}

export async function getCircleLeaderboard(scope: 'circle' | 'global' = 'circle'): Promise<{ entries: LeaderboardEntry[]; circle: Circle | null }> {
  const circle = await getMyCircle()
  if (scope === 'circle' && !circle) return { entries: [], circle: null }
  let query = supabase
    .from('streaks')
    .select('user_id,streak_start,best_days,volume_score,triumph_count,partnered_count,profiles(username)')

  if (scope === 'circle' && circle) {
    const ids = await getCircleMemberIds(circle.id)
    if (ids.length === 0) return { entries: [], circle }
    query = query.in('user_id', ids)
  }

  const { data, error } = await query
  if (error && error.message.includes('profiles')) {
    let legacyQuery = supabase
      .from('streaks')
      .select('user_id,streak_start,best_days,volume_score,triumph_count,partnered_count,users(username)')
    if (scope === 'circle' && circle) {
      const ids = await getCircleMemberIds(circle.id)
      if (ids.length === 0) return { entries: [], circle }
      legacyQuery = legacyQuery.in('user_id', ids)
    }
    const legacy = await legacyQuery
    if (legacy.error) throw legacy.error
    type LegacyRow = {
      user_id: string
      streak_start: string
      best_days: number
      volume_score: number
      triumph_count: number
      partnered_count: number
      users: { username: string } | null
    }
    return {
      circle,
      entries: ((legacy.data || []) as unknown as LegacyRow[]).map(r => {
        const triumphCount = r.triumph_count || 0
        const partneredCount = r.partnered_count || 0
        return {
          user_id: r.user_id,
          username: r.users?.username || 'unknown',
          current: getCurrentDays(r.streak_start),
          best: r.best_days || 0,
          liveVolume: getLiveVolume(r.volume_score || 0, r.streak_start),
          triumphCount,
          partneredCount,
          masteryPct: masteryRatio(triumphCount, partneredCount),
        }
      }),
    }
  }
  if (error) throw error

  type Row = {
    user_id: string
    streak_start: string
    best_days: number
    volume_score: number
    triumph_count: number
    partnered_count: number
    profiles: { username: string } | null
  }

  const entries = ((data || []) as unknown as Row[]).map(r => {
    const triumphCount = r.triumph_count || 0
    const partneredCount = r.partnered_count || 0
    return {
      user_id: r.user_id,
      username: r.profiles?.username || 'unknown',
      current: getCurrentDays(r.streak_start),
      best: r.best_days || 0,
      liveVolume: getLiveVolume(r.volume_score || 0, r.streak_start),
      triumphCount,
      partneredCount,
      masteryPct: masteryRatio(triumphCount, partneredCount),
    }
  })

  return { entries, circle }
}

export async function getFeedEvents(circleId: string | null): Promise<FeedEvent[]> {
  let query = supabase
    .from('events')
    .select('id,user_id,username,kind,body,cta,created_at,circle_id')
    .order('created_at', { ascending: false })
    .limit(60)

  if (circleId) query = query.eq('circle_id', circleId)

  const { data, error } = await query
  if (error) throw error
  return (data || []) as FeedEvent[]
}
