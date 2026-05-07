'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentDays, MILESTONES, MILESTONE_TITLES, RANK_SCALE, computeRankIndex } from '@/lib/utils'

// Step order:
// 1 = title  2 = name input  3 = welcome flash  4 = choice  5 = number input
// 6 = circles  7 = rank reveal (circle only)  8 = achievement  9 = rank scale
type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

const serif = 'var(--font-cormorant)'
const sans = 'var(--font-inter)'

const fullScreen: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: '#060302',
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  padding: '48px 32px',
  textAlign: 'center',
}

function startDateFromDays(days: number): string {
  const dt = new Date()
  dt.setDate(dt.getDate() - days)
  return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function generateCircleCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const RANK_REQUIREMENTS = [
  '', '1+ days', '7 days', '14 days', '30 days',
  '60 days', '90 days', '180 days', '365 days',
  '365d · ≤2 resets/yr', '730+ days', '365d · 0 resets',
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)

  // Username step
  const [nameInput, setNameInput] = useState('')
  const [nameLocking, setNameLocking] = useState(false)
  const [nameLocked, setNameLocked] = useState(false)
  const [nameError, setNameError] = useState('')

  // Streak/choice
  const [choice, setChoice] = useState<'streak' | 'today' | null>(null)
  const [dialDays, setDialDays] = useState(0)
  const [inputVal, setInputVal] = useState('')
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState('')
  const [username, setUsername] = useState('')

  // Rank reveal (populated after circle join, then shown in step 7)
  const [rank, setRank] = useState<number | null>(null)
  const [totalUsers, setTotalUsers] = useState(1)
  const [neighbours, setNeighbours] = useState<{ above: string | null; below: string | null }>({ above: null, below: null })
  const [rankLoading, setRankLoading] = useState(false)

  // Circles
  const [circleMode, setCircleMode] = useState<'choose' | 'create' | 'join' | 'done'>('choose')
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [circleLoading, setCircleLoading] = useState(false)
  const [circleError, setCircleError] = useState('')
  const [createdCode, setCreatedCode] = useState('')
  const [joinedCircleName, setJoinedCircleName] = useState('')
  const [circleId, setCircleId] = useState('')  // set when user joins/creates a circle

  // Rank scale
  const [showGoatPopup, setShowGoatPopup] = useState(false)
  const [wizardSlide, setWizardSlide] = useState(0)  // 0=hidden, 1-3=slides
  const scrollRef = useRef<HTMLDivElement>(null)
  const goatCallbackRef = useRef<(() => void) | null>(null)

  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Derived values — before any useEffect that uses them
  const userRankIdx = computeRankIndex(choice === 'streak' ? dialDays : 0)
  const achievedMilestone = [...MILESTONES].reverse().find(m => dialDays >= m) ?? null
  const showAchievement = choice === 'streak' && achievedMilestone !== null

  useEffect(() => {
    if (localStorage.getItem('retain_onboarded') === 'true') {
      router.replace('/today')
      return
    }
    const uid = localStorage.getItem('retain_user_id') || ''
    const uname = localStorage.getItem('retain_username') || ''
    if (uid) setUserId(uid)
    if (uname) setUsername(uname)

    // Pick up deep-link pending circle code → pre-fill join input and jump to join mode
    const pendingCode = localStorage.getItem('retain_pending_circle_code')
    if (pendingCode) {
      localStorage.removeItem('retain_pending_circle_code')
      setJoinCodeInput(pendingCode)
      setCircleMode('join')
    }
  }, [router])

  // Step 3: auto-advance welcome flash
  useEffect(() => {
    if (step !== 3) return
    const t = setTimeout(() => setStep(4), 2200)
    return () => clearTimeout(t)
  }, [step])

  // Step 9: cinematic rAF — slow sweep → GOAT popup → ease back
  useEffect(() => {
    if (step !== 9 || !scrollRef.current) return
    const el = scrollRef.current
    const CARD_W = 172
    const userScroll = Math.max(0, userRankIdx * CARD_W - el.clientWidth / 2 + 80)

    el.scrollLeft = 0
    setShowGoatPopup(false)

    let raf = 0
    let p1Start = 0
    let p2Start = 0
    const P1_MS = 5000
    const P2_MS = 1800

    function easeInQuint(t: number) { return t * t * t * t * t }
    function easeOutCubic(t: number) { return 1 - (1 - t) ** 3 }

    function phase2(ts: number) {
      if (!p2Start) p2Start = ts
      const t = Math.min(1, (ts - p2Start) / P2_MS)
      const maxScroll = el.scrollWidth - el.clientWidth
      el.scrollLeft = maxScroll + (userScroll - maxScroll) * easeOutCubic(t)
      if (t < 1) raf = requestAnimationFrame(phase2)
    }

    function phase1(ts: number) {
      if (!p1Start) p1Start = ts
      const t = Math.min(1, (ts - p1Start) / P1_MS)
      const maxScroll = el.scrollWidth - el.clientWidth
      el.scrollLeft = maxScroll * easeInQuint(t)
      if (t < 1) {
        raf = requestAnimationFrame(phase1)
      } else {
        goatCallbackRef.current = () => raf = requestAnimationFrame(phase2)
        setShowGoatPopup(true)
      }
    }

    const startTimer = setTimeout(() => { raf = requestAnimationFrame(phase1) }, 400)
    return () => { clearTimeout(startTimer); cancelAnimationFrame(raf) }
  }, [step, userRankIdx])

  // ── Username creation ─────────────────────────────────────────────────
  async function handleLockName() {
    const trimmed = nameInput.trim().toLowerCase()
    if (trimmed.length < 2) { setNameError('At least 2 characters.'); return }
    if (trimmed.length > 24) { setNameError('24 characters max.'); return }
    if (!/^[a-z0-9_.]+$/.test(trimmed)) { setNameError('Letters, numbers, _ and . only.'); return }

    setNameLocking(true)
    setNameError('')

    const { data: existing } = await supabase
      .from('users').select('id').eq('username', trimmed).maybeSingle()

    if (existing) {
      setNameError('That name is taken. Try another.')
      setNameLocking(false)
      return
    }

    const { data: newUser, error: createErr } = await supabase
      .from('users').insert({ username: trimmed }).select('id').single()

    if (createErr || !newUser) {
      setNameError('Something went wrong. Try again.')
      setNameLocking(false)
      return
    }

    await supabase.from('streaks').insert({
      user_id: newUser.id,
      streak_start: new Date().toISOString().split('T')[0],
      best_days: 0,
      celebrated_milestones: [],
    })

    localStorage.setItem('retain_user_id', newUser.id)
    localStorage.setItem('retain_username', trimmed)
    setUserId(newUser.id)
    setUsername(trimmed)
    setNameLocked(true)
    setTimeout(() => setStep(3), 1400)
  }

  // ── Save streak (no rank fetch yet — that happens after circles) ───────
  const saveStreak = useCallback(async (days: number) => {
    if (!userId) return
    setSaving(true)
    const today = new Date()
    today.setDate(today.getDate() - days)
    const streakStart = today.toISOString().split('T')[0]
    // Silent milestone seeding: pre-populate milestones already achieved
    // so the feed doesn't broadcast them as new when the user first opens the app
    const silentMilestones = MILESTONES.filter(m => m <= days)
    await supabase.from('streaks')
      .update({
        streak_start: streakStart,
        best_days: days,
        celebrated_milestones: silentMilestones,
        volume_score: days,   // initialise reservoir to current streak length
      })
      .eq('user_id', userId)
    setSaving(false)
    setStep(6)  // → circles
  }, [userId])

  // ── Fetch rank within a circle, then advance to rank reveal ───────────
  async function fetchCircleRankAndAdvance(cid: string) {
    setRankLoading(true)
    const { data: members } = await supabase
      .from('circle_members').select('user_id').eq('circle_id', cid)

    if (members) {
      const ids = members.map((m: { user_id: string }) => m.user_id)
      const { data: streaks } = await supabase
        .from('streaks').select('user_id,streak_start,users(username)').in('user_id', ids)

      if (streaks) {
        type Row = { user_id: string; streak_start: string; users: { username: string } }
        const ranked = (streaks as unknown as Row[])
          .map(r => ({ uid: r.user_id, uname: r.users?.username || '??', d: getCurrentDays(r.streak_start) }))
          .sort((a, b) => b.d - a.d)
        const pos = ranked.findIndex(r => r.uid === userId) + 1
        setRank(pos)
        setTotalUsers(ranked.length)
        setNeighbours({
          above: pos > 1 ? ranked[pos - 2].uname : null,
          below: pos < ranked.length ? ranked[pos].uname : null,
        })
      }
    }
    setRankLoading(false)
    setStep(7)  // → rank reveal (circle)
  }

  function startHold(dir: 1 | -1) {
    setDialDays(d => { const n = Math.max(0, Math.min(999, d + dir)); setInputVal(String(n)); return n })
    holdTimer.current = setInterval(() => {
      setDialDays(d => { const n = Math.max(0, Math.min(999, d + dir)); setInputVal(String(n)); return n })
    }, 80)
  }
  function stopHold() {
    if (holdTimer.current) { clearInterval(holdTimer.current); holdTimer.current = null }
  }

  async function handleChoiceToday() {
    setChoice('today')
    await saveStreak(0)
  }
  async function handleDialContinue() {
    setChoice('streak')
    await saveStreak(dialDays)
  }

  // ── Circles ───────────────────────────────────────────────────────────
  async function handleCreateCircle() {
    setCircleLoading(true)
    setCircleError('')
    let code = generateCircleCode()
    setCreatedCode(code)

    const tryInsert = async (c: string) => supabase
      .from('circles')
      .insert({ name: `${username}'s circle`, invite_code: c, creator_id: userId })
      .select('id').single()

    let { data: circle, error } = await tryInsert(code)
    if (error || !circle) {
      code = generateCircleCode()
      setCreatedCode(code)
      const r2 = await tryInsert(code)
      if (r2.error || !r2.data) { setCircleError('Could not create circle. Try again.'); setCircleLoading(false); return }
      circle = r2.data
    }

    await supabase.from('circle_members').insert({ circle_id: circle.id, user_id: userId })
    setCircleId(circle.id)
    setCircleLoading(false)
    setCircleMode('done')
  }

  async function handleJoinCircle() {
    const code = joinCodeInput.trim().toUpperCase()
    if (code.length !== 6) { setCircleError('Enter the 6-character code.'); return }
    setCircleLoading(true)
    setCircleError('')

    const { data: circle } = await supabase
      .from('circles').select('id, name').eq('invite_code', code).maybeSingle()

    if (!circle) { setCircleError('No circle found with that code.'); setCircleLoading(false); return }

    await supabase.from('circle_members').upsert({ circle_id: circle.id, user_id: userId }, { onConflict: 'circle_id,user_id' })
    setJoinedCircleName(circle.name)
    setCircleId(circle.id)
    setCircleLoading(false)
    setCircleMode('done')
  }

  // After circle done — if joined a circle show rank reveal, else skip
  async function handleCircleFinish() {
    if (circleId) {
      await fetchCircleRankAndAdvance(circleId)
    } else {
      // solo — skip rank reveal, go to achievement or rank scale
      setStep(showAchievement ? 8 : 9)
    }
  }

  function finish() {
    localStorage.setItem('retain_onboarded', 'true')
    router.push('/today')
  }

  // ── Step 1: Title ─────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <button onClick={() => setStep(userId && username ? 3 : 2)} style={{ ...fullScreen, cursor: 'pointer', border: 'none' }}>
        <div style={{ animation: 'goldPulse 3s ease-in-out infinite, fadeIn 1.4s ease both' }}>
          <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 96, color: '#EFE4CF', lineHeight: 0.9, letterSpacing: -3 }}>
            retain
          </div>
        </div>
        <div style={{ marginTop: 24, fontSize: 11, color: '#4a3322', letterSpacing: 5, textTransform: 'uppercase', animation: 'fadeIn 2s ease 0.6s both' }}>
          The monastery awaits
        </div>
        <div style={{ position: 'absolute', bottom: 52, fontSize: 11, color: '#2a1a0e', letterSpacing: 2, animation: 'blink 2s steps(1) infinite' }}>
          tap to enter
        </div>
      </button>
    )
  }

  // ── Step 2: Name input ────────────────────────────────────────────────
  if (step === 2) {
    return (
      <div style={{ ...fullScreen, justifyContent: 'center' }}>
        <div style={{ animation: 'slideUp 0.6s ease both', width: '100%', maxWidth: 320 }}>
          <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 32, color: '#906e50', marginBottom: 6 }}>
            Welcome,
          </div>

          {nameLocked ? (
            <div style={{ position: 'relative', display: 'inline-block', overflow: 'hidden' }}>
              <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 72, color: '#D4A76A', lineHeight: 1, animation: 'goldPulse 2s ease-in-out infinite, scaleIn 0.5s ease both' }}>
                {username}.
              </div>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)', animation: 'shimmer 1.2s linear' }} />
            </div>
          ) : (
            <>
              <input
                type="text"
                value={nameInput}
                onChange={e => { setNameInput(e.target.value); setNameError('') }}
                onKeyDown={e => { if (e.key === 'Enter' && nameInput.trim().length >= 2) handleLockName() }}
                placeholder="your name"
                maxLength={24}
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={nameLocking}
                style={{
                  fontFamily: serif, fontStyle: 'italic', fontSize: 64,
                  color: '#EFE4CF', background: 'transparent', border: 'none',
                  borderBottom: `2px solid ${nameInput ? 'rgba(212,167,106,0.6)' : 'rgba(239,228,207,0.15)'}`,
                  outline: 'none', textAlign: 'center', width: '100%', display: 'block',
                  caretColor: '#D4A76A', padding: '4px 0 8px', transition: 'border-color 0.2s',
                }}
              />
              {nameError && (
                <div style={{ fontSize: 12, color: '#e05555', marginTop: 10, animation: 'fadeIn 0.2s ease' }}>{nameError}</div>
              )}
              <button
                onClick={handleLockName}
                disabled={nameLocking || nameInput.trim().length < 2}
                style={{
                  marginTop: 32, width: '100%', minHeight: 54,
                  background: nameInput.trim().length >= 2 && !nameLocking ? '#D4A76A' : '#1e1208',
                  color: nameInput.trim().length >= 2 && !nameLocking ? '#060302' : '#4a3322',
                  fontFamily: sans, fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 14,
                  cursor: nameInput.trim().length >= 2 && !nameLocking ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s', letterSpacing: 0.5,
                }}
              >
                {nameLocking ? 'locking in…' : 'Lock in →'}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Step 3: Welcome flash (auto-advance) ──────────────────────────────
  if (step === 3) {
    return (
      <div style={fullScreen}>
        <div style={{ animation: 'slideUp 0.7s ease both' }}>
          <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 36, color: '#906e50', lineHeight: 1.1 }}>Welcome,</div>
          <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 52, color: '#EFE4CF', fontWeight: 700, lineHeight: 1, marginTop: 4, animation: 'goldPulse 2s ease-in-out infinite' }}>
            {username}.
          </div>
        </div>
      </div>
    )
  }

  // ── Step 4: Choice ────────────────────────────────────────────────────
  if (step === 4) {
    return (
      <div style={fullScreen}>
        <div style={{ animation: 'slideUp 0.5s ease both', width: '100%', maxWidth: 340 }}>
          <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 34, color: '#EFE4CF', lineHeight: 1.2, marginBottom: 40 }}>
            Are you already<br />retaining?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => setStep(5)}
              style={{ width: '100%', minHeight: 58, background: '#D4A76A', color: '#060302', fontFamily: sans, fontSize: 16, fontWeight: 800, border: 'none', borderRadius: 16, cursor: 'pointer' }}
            >
              I&apos;m on a streak
            </button>
            <button
              onClick={handleChoiceToday}
              disabled={saving}
              style={{ width: '100%', minHeight: 58, background: 'transparent', color: '#EFE4CF', fontFamily: sans, fontSize: 16, fontWeight: 400, border: '1px solid rgba(239,228,207,0.2)', borderRadius: 16, cursor: 'pointer' }}
            >
              {saving ? 'Setting up…' : 'Starting today'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 5: Number input ──────────────────────────────────────────────
  if (step === 5) {
    return (
      <div style={{ ...fullScreen, justifyContent: 'space-between', paddingTop: 72, paddingBottom: 52 }}>
        <div style={{ animation: 'fadeIn 0.4s ease both', textAlign: 'center', width: '100%' }}>
          <div style={{ fontSize: 11, color: '#4a3322', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 28 }}>
            How many days?
          </div>

          <button
            onPointerDown={() => startHold(1)} onPointerUp={stopHold} onPointerLeave={stopHold}
            style={{ display: 'block', margin: '0 auto 12px', width: 64, height: 52, background: 'rgba(239,228,207,0.06)', border: '1px solid rgba(239,228,207,0.12)', borderRadius: 12, color: '#906e50', fontSize: 20, cursor: 'pointer', userSelect: 'none' }}
          >▲</button>

          <input
            type="number" inputMode="numeric" value={inputVal} min={0} max={999} placeholder="0"
            onChange={e => {
              const raw = e.target.value.replace(/\D/g, '')
              setInputVal(raw)
              setDialDays(Math.max(0, Math.min(999, parseInt(raw) || 0)))
            }}
            style={{
              fontFamily: serif, fontStyle: 'italic', fontSize: 96, color: '#D4A76A',
              lineHeight: 0.9, letterSpacing: -3, background: 'transparent', border: 'none',
              outline: 'none', textAlign: 'center', width: '100%', display: 'block', caretColor: '#D4A76A',
            }}
          />

          <div style={{ fontSize: 11, color: '#906e50', letterSpacing: 3, textTransform: 'uppercase', marginTop: 10 }}>days</div>
          <div style={{ fontSize: 12, color: '#4a3322', marginTop: 6, minHeight: 18 }}>
            {dialDays > 0 ? `since ${startDateFromDays(dialDays)}` : 'tap the number to type, or use arrows'}
          </div>

          <button
            onPointerDown={() => startHold(-1)} onPointerUp={stopHold} onPointerLeave={stopHold}
            style={{ display: 'block', margin: '12px auto 0', width: 64, height: 52, background: 'rgba(239,228,207,0.06)', border: '1px solid rgba(239,228,207,0.12)', borderRadius: 12, color: '#906e50', fontSize: 20, cursor: 'pointer', userSelect: 'none' }}
          >▼</button>
        </div>

        <button
          onClick={handleDialContinue}
          disabled={saving}
          style={{ width: '100%', minHeight: 54, background: '#D4A76A', color: '#060302', fontFamily: sans, fontSize: 16, fontWeight: 800, border: 'none', borderRadius: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving…' : 'Set my days'}
        </button>
      </div>
    )
  }

  // ── Step 6: Circles ───────────────────────────────────────────────────
  if (step === 6) {
    return (
      <div style={fullScreen}>
        <div style={{ animation: 'slideUp 0.5s ease both', width: '100%', maxWidth: 340 }}>

          {circleMode === 'choose' && (
            <>
              <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 36, color: '#EFE4CF', marginBottom: 8 }}>
                Your circle.
              </div>
              <div style={{ fontSize: 13, color: '#906e50', lineHeight: 1.6, marginBottom: 36 }}>
                Compete privately with friends.<br />One code. Instant rivalry.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={() => setCircleMode('create')}
                  style={{ width: '100%', minHeight: 56, background: '#D4A76A', color: '#060302', fontFamily: sans, fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 14, cursor: 'pointer' }}
                >
                  Create a circle
                </button>
                <button
                  onClick={() => setCircleMode('join')}
                  style={{ width: '100%', minHeight: 56, background: 'transparent', color: '#EFE4CF', fontFamily: sans, fontSize: 15, fontWeight: 400, border: '1px solid rgba(239,228,207,0.2)', borderRadius: 14, cursor: 'pointer' }}
                >
                  Join with a code
                </button>
                <button
                  onClick={() => setStep(showAchievement ? 8 : 9)}
                  style={{ width: '100%', minHeight: 44, background: 'none', border: 'none', color: '#4a3322', fontFamily: sans, fontSize: 13, cursor: 'pointer', marginTop: 4 }}
                >
                  Go solo for now
                </button>
              </div>
            </>
          )}

          {circleMode === 'create' && (
            <>
              <button onClick={() => setCircleMode('choose')} style={{ background: 'none', border: 'none', color: '#4a3322', fontFamily: sans, fontSize: 13, cursor: 'pointer', marginBottom: 24, padding: 0 }}>← back</button>
              <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 32, color: '#EFE4CF', marginBottom: 8 }}>Create a circle.</div>
              <div style={{ fontSize: 13, color: '#906e50', lineHeight: 1.6, marginBottom: 32 }}>
                A private code is generated. Share it — anyone who enters it joins your leaderboard.
              </div>
              {circleError && <div style={{ fontSize: 12, color: '#e05555', marginBottom: 12 }}>{circleError}</div>}
              <button
                onClick={handleCreateCircle}
                disabled={circleLoading}
                style={{ width: '100%', minHeight: 56, background: circleLoading ? '#1e1208' : '#D4A76A', color: circleLoading ? '#4a3322' : '#060302', fontFamily: sans, fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 14, cursor: circleLoading ? 'not-allowed' : 'pointer' }}
              >
                {circleLoading ? 'creating…' : 'Create my circle'}
              </button>
            </>
          )}

          {circleMode === 'join' && (
            <>
              <button onClick={() => setCircleMode('choose')} style={{ background: 'none', border: 'none', color: '#4a3322', fontFamily: sans, fontSize: 13, cursor: 'pointer', marginBottom: 24, padding: 0 }}>← back</button>
              <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 32, color: '#EFE4CF', marginBottom: 8 }}>Join a circle.</div>
              <div style={{ fontSize: 13, color: '#906e50', lineHeight: 1.6, marginBottom: 28 }}>
                Enter the 6-character code your friend shared with you.
              </div>
              <input
                type="text"
                value={joinCodeInput}
                onChange={e => { setJoinCodeInput(e.target.value.toUpperCase()); setCircleError('') }}
                // auto-fill from deep-link (checked on mount via useEffect below)
                placeholder="XXXXXX"
                maxLength={6}
                autoFocus
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                style={{
                  width: '100%', background: '#1e1208', border: '1px solid rgba(239,228,207,0.15)',
                  borderRadius: 14, padding: '18px 20px', color: '#D4A76A',
                  fontFamily: sans, fontSize: 28, fontWeight: 800, letterSpacing: 8,
                  outline: 'none', textAlign: 'center', marginBottom: 12,
                }}
              />
              {circleError && <div style={{ fontSize: 12, color: '#e05555', marginBottom: 12 }}>{circleError}</div>}
              <button
                onClick={handleJoinCircle}
                disabled={circleLoading || joinCodeInput.trim().length !== 6}
                style={{
                  width: '100%', minHeight: 56,
                  background: joinCodeInput.trim().length === 6 && !circleLoading ? '#D4A76A' : '#1e1208',
                  color: joinCodeInput.trim().length === 6 && !circleLoading ? '#060302' : '#4a3322',
                  fontFamily: sans, fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 14,
                  cursor: joinCodeInput.trim().length === 6 && !circleLoading ? 'pointer' : 'not-allowed',
                }}
              >
                {circleLoading ? 'joining…' : 'Join circle'}
              </button>
            </>
          )}

          {circleMode === 'done' && (
            <div style={{ animation: 'scaleIn 0.4s ease both', textAlign: 'center' }}>
              {createdCode ? (
                <>
                  <div style={{ fontSize: 32, marginBottom: 16 }}>⚔</div>
                  <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 28, color: '#D4A76A', marginBottom: 8 }}>Circle created.</div>
                  <div style={{ fontSize: 13, color: '#906e50', marginBottom: 24 }}>Share this code with your friends:</div>
                  <div style={{
                    fontFamily: sans, fontSize: 36, fontWeight: 800, letterSpacing: 10,
                    color: '#D4A76A', background: 'rgba(212,167,106,0.1)',
                    border: '1px solid rgba(212,167,106,0.3)',
                    borderRadius: 16, padding: '20px 24px', marginBottom: 32,
                    animation: 'goldPulse 2s ease-in-out infinite',
                  }}>
                    {createdCode}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 32, marginBottom: 16 }}>✦</div>
                  <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 28, color: '#D4A76A', marginBottom: 8 }}>Joined.</div>
                  <div style={{ fontSize: 13, color: '#906e50', marginBottom: 32 }}>You&apos;re in {joinedCircleName || 'the circle'}.</div>
                </>
              )}
              <button
                onClick={handleCircleFinish}
                disabled={rankLoading}
                style={{ width: '100%', minHeight: 54, background: rankLoading ? '#1e1208' : '#D4A76A', color: rankLoading ? '#4a3322' : '#060302', fontFamily: sans, fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 14, cursor: rankLoading ? 'not-allowed' : 'pointer' }}
              >
                {rankLoading ? 'fetching your rank…' : 'See where you stand →'}
              </button>
            </div>
          )}

        </div>
      </div>
    )
  }

  // ── Step 7: Rank reveal (within circle) ───────────────────────────────
  if (step === 7) {
    return (
      <button onClick={() => setStep(showAchievement ? 8 : 9)} style={{ ...fullScreen, cursor: 'pointer', border: 'none' }}>
        <div style={{ width: '100%', maxWidth: 320 }}>
          <div style={{ fontSize: 12, color: '#906e50', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12, animation: 'fadeIn 0.5s ease both' }}>
            In your circle, you enter at
          </div>
          <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 88, color: '#D4A76A', lineHeight: 0.9, animation: 'goldPulse 2s ease-in-out infinite, scaleIn 0.6s ease both' }}>
            #{rank}
          </div>
          <div style={{ fontSize: 14, color: '#906e50', marginTop: 12, animation: 'fadeIn 0.5s ease 0.3s both' }}>
            of {totalUsers} {totalUsers === 1 ? 'monk' : 'monks'}
          </div>

          <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {neighbours.above && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: 'rgba(239,228,207,0.04)', animation: 'staggerFade 0.4s ease 0.2s both' }}>
                <span style={{ fontSize: 13, color: '#906e50' }}>{neighbours.above}</span>
                <span style={{ fontSize: 10, color: '#4a3322', letterSpacing: 1 }}>above you</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: 'rgba(212,167,106,0.1)', border: '1px solid rgba(212,167,106,0.3)', animation: 'staggerFade 0.4s ease 0.35s both' }}>
              <span style={{ fontSize: 13, color: '#D4A76A', fontWeight: 700 }}>{username}</span>
              <span style={{ fontSize: 10, color: '#D4A76A', letterSpacing: 1 }}>you · #{rank}</span>
            </div>
            {neighbours.below && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: 'rgba(239,228,207,0.04)', animation: 'staggerFade 0.4s ease 0.5s both' }}>
                <span style={{ fontSize: 13, color: '#906e50' }}>{neighbours.below}</span>
                <span style={{ fontSize: 10, color: '#4a3322', letterSpacing: 1 }}>below you</span>
              </div>
            )}
          </div>

          <div style={{ fontSize: 11, color: '#2a1a0e', marginTop: 32, letterSpacing: 2, animation: 'blink 2s steps(1) infinite 1s' }}>
            tap to continue
          </div>
        </div>
      </button>
    )
  }

  // ── Step 8: Achievement ───────────────────────────────────────────────
  if (step === 8 && achievedMilestone) {
    const achievedTitle = MILESTONE_TITLES[achievedMilestone]
    return (
      <button onClick={() => setStep(9)} style={{ ...fullScreen, cursor: 'pointer', border: 'none' }}>
        <div style={{ animation: 'slideUp 0.6s ease both' }}>
          <div style={{ fontSize: 11, color: '#4a3322', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 }}>You are a</div>
          <div style={{ position: 'relative', display: 'inline-block', overflow: 'hidden' }}>
            <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 68, color: '#D4A76A', lineHeight: 1, animation: 'goldPulse 2.5s ease-in-out infinite' }}>
              {achievedTitle}.
            </div>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent)', animation: 'shimmer 2s linear infinite' }} />
          </div>
          <div style={{ width: 40, height: 1, background: '#4a3322', margin: '20px auto' }} />
          <div style={{ fontSize: 13, color: '#906e50', lineHeight: 1.6 }}>
            {dialDays} days of mastery.<br />
            <span style={{ color: '#4a3322' }}>The monastery recognises you.</span>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 52, fontSize: 11, color: '#2a1a0e', letterSpacing: 2, animation: 'blink 2s steps(1) infinite' }}>
          tap to continue
        </div>
      </button>
    )
  }

  // ── Step 9: Rank scale — cinematic finale ─────────────────────────────
  return (
    <div style={{ ...fullScreen, flexDirection: 'column', justifyContent: 'flex-start', padding: '56px 0 40px' }}>

      <div style={{ textAlign: 'center', padding: '0 32px 28px', animation: 'fadeIn 0.5s ease both', flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: '#4a3322', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 6 }}>
          The scale of mastery
        </div>
        <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 18, color: '#906e50' }}>
          This is where the path leads.
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', width: '100%', overflow: 'hidden' }}>
        <div
          ref={scrollRef}
          className="no-scrollbar"
          style={{ width: '100%', overflowX: 'auto', display: 'flex', alignItems: 'stretch', gap: 12, padding: '4px 32px', scrollBehavior: 'auto' }}
        >
          {RANK_SCALE.map((rank, i) => {
            const isCurrent = i === userRankIdx
            const isPast = i < userRankIdx
            const r = parseInt(rank.color.slice(1, 3), 16)
            const g = parseInt(rank.color.slice(3, 5), 16)
            const b = parseInt(rank.color.slice(5, 7), 16)
            const colorBg = `rgba(${r},${g},${b},${isCurrent ? 0.14 : isPast ? 0.04 : 0.07})`
            const borderColor = isCurrent ? `rgba(${r},${g},${b},0.55)` : isPast ? `rgba(${r},${g},${b},0.08)` : `rgba(${r},${g},${b},0.18)`
            const textColor = isCurrent ? rank.color : isPast ? `rgba(${r},${g},${b},0.25)` : `rgba(${r},${g},${b},0.55)`
            const descColor = isCurrent ? '#906e50' : isPast ? '#2a1608' : '#3d2e1e'

            return (
              <div key={rank.title} style={{
                flexShrink: 0, width: 160, minHeight: 260, padding: '20px 16px 16px',
                background: colorBg, border: `1px solid ${borderColor}`, borderRadius: 18,
                textAlign: 'left', position: 'relative',
                boxShadow: isCurrent ? `0 0 48px rgba(${r},${g},${b},0.25), 0 0 16px rgba(${r},${g},${b},0.15)` : 'none',
                display: 'flex', flexDirection: 'column',
              }}>
                {isCurrent && (
                  <div style={{ position: 'absolute', top: 11, right: 12, fontSize: 8, color: rank.color, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>you</div>
                )}
                <div style={{ fontSize: 26, color: textColor, marginBottom: 12, lineHeight: 1, filter: isCurrent ? `drop-shadow(0 0 8px rgba(${r},${g},${b},0.6))` : 'none' }}>
                  {rank.icon}
                </div>
                <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: isCurrent ? 28 : 21, color: textColor, lineHeight: 1.05, marginBottom: 8, textShadow: isCurrent ? `0 0 20px rgba(${r},${g},${b},0.4)` : 'none' }}>
                  {rank.title}
                </div>
                <div style={{ fontSize: 10.5, color: descColor, lineHeight: 1.6, flex: 1 }}>{rank.desc}</div>
                {RANK_REQUIREMENTS[i] && (
                  <div style={{ fontSize: 9, color: isCurrent ? `rgba(${r},${g},${b},0.6)` : '#1a0c04', letterSpacing: 0.5, marginTop: 12, paddingTop: 10, borderTop: `1px solid rgba(${r},${g},${b},${isCurrent ? 0.25 : 0.08})` }}>
                    {RANK_REQUIREMENTS[i]}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ padding: '28px 32px 0', width: '100%', flexShrink: 0, animation: 'fadeIn 0.6s ease 0.8s both' }}>
        <button
          onClick={() => setWizardSlide(1)}
          style={{ width: '100%', minHeight: 54, background: '#D4A76A', color: '#060302', fontFamily: sans, fontSize: 16, fontWeight: 800, border: 'none', borderRadius: 14, cursor: 'pointer' }}
        >
          Enter the monastery
        </button>
      </div>

      {/* Philosophy wizard — 3 slides before entering the monastery */}
      {wizardSlide > 0 && (() => {
        const slides = [
          {
            icon: '⚔',
            label: 'The Blade',
            heading: 'The streak is the blade.',
            body: 'One slip and it shatters. But the sharpness you built — the discipline, the clarity, the identity — that never leaves. The blade can be reforged. The man who forged it once can forge it faster.',
          },
          {
            icon: '◎',
            label: 'The Reservoir',
            heading: 'Volume is truth.',
            body: 'Every day retained fills the Reservoir. It never resets to zero. It drains when you fall — but it never disappears. A man of 400 days who lapses is still richer than a man of 30 who holds. The Reservoir remembers everything.',
          },
          {
            icon: '∞',
            label: 'The Exponential Cost',
            heading: 'The cost compounds.',
            body: 'Each fall within a 14-day window drains more than the last. First event: −15%. Second in a week: −30%. Third: −45%. The monastery does not forgive binge behaviour. Hold for 14 clean days — and the penalty clock resets.',
          },
        ]
        const slide = slides[wizardSlide - 1]
        const isLast = wizardSlide === slides.length

        return (
          <div
            key={wizardSlide}
            onClick={() => isLast ? finish() : setWizardSlide(s => (s + 1) as 1 | 2 | 3)}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(6,3,2,0.96)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '52px 36px', textAlign: 'center',
              animation: 'fadeIn 0.4s ease both',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
            }}
          >
            {/* Progress dots */}
            <div style={{ position: 'absolute', top: 52, display: 'flex', gap: 8 }}>
              {slides.map((_, i) => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i < wizardSlide ? '#D4A76A' : 'rgba(212,167,106,0.2)', transition: 'background 0.3s' }} />
              ))}
            </div>

            <div style={{ fontSize: 44, marginBottom: 20, animation: 'scaleIn 0.5s ease both' }}>
              {slide.icon}
            </div>
            <div style={{ fontSize: 9, letterSpacing: 4, color: '#4a3322', textTransform: 'uppercase', marginBottom: 16 }}>
              {slide.label}
            </div>
            <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 28, color: '#D4A76A', lineHeight: 1.25, marginBottom: 24, animation: 'goldPulse 3s ease-in-out infinite' }}>
              {slide.heading}
            </div>
            <div style={{ fontSize: 14, color: '#906e50', lineHeight: 1.8, maxWidth: 280 }}>
              {slide.body}
            </div>

            <div style={{ position: 'absolute', bottom: 52, fontSize: 11, color: '#2a1a0e', letterSpacing: 2, animation: 'blink 1.5s steps(1) infinite' }}>
              {isLast ? 'tap to enter' : 'tap to continue'}
            </div>
          </div>
        )
      })()}

      {/* GOAT popup */}
      {showGoatPopup && (
        <div
          onClick={() => {
            setShowGoatPopup(false)
            goatCallbackRef.current?.()
            goatCallbackRef.current = null
          }}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(6,3,2,0.92)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '48px 36px', textAlign: 'center',
            animation: 'fadeIn 0.5s ease both',
            cursor: 'pointer',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div style={{ fontSize: 52, marginBottom: 20, animation: 'goldPulse 2s ease-in-out infinite, scaleIn 0.6s ease both', filter: 'drop-shadow(0 0 32px rgba(212,167,106,0.8))' }}>
            ♛
          </div>
          <div style={{ fontSize: 10, color: '#4a3322', letterSpacing: 5, textTransform: 'uppercase', marginBottom: 18 }}>
            The GOAT
          </div>
          <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 28, color: '#D4A76A', lineHeight: 1.3, marginBottom: 16, animation: 'goldPulse 3s ease-in-out infinite' }}>
            Two years. Zero resets.<br />The monastery bows.
          </div>
          <div style={{ fontSize: 13, color: '#906e50', lineHeight: 1.7, maxWidth: 260, marginBottom: 40 }}>
            Few men ever see this far. This is not a destination — it is a way of being. The path behind you is longer than most men&apos;s entire journey.
          </div>
          <div style={{ fontSize: 11, color: '#2a1a0e', letterSpacing: 2, animation: 'blink 1.5s steps(1) infinite' }}>
            tap to return to your rank
          </div>
        </div>
      )}
    </div>
  )
}
