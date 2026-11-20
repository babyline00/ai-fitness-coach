/**
 * Weekly review — pure function `generateWeeklyReview(workouts)`.
 *
 * Input: the list of workouts completed in the past 7 days (the API route is
 * responsible for filtering by weekStart + 7 days).
 *
 * Output: aggregate volume + average RPE + a "deload week suggested" flag.
 *
 *   - avgRPE > 8.5 → suggestedDeload = true (the user has been grinding).
 *   - avgRPE < 7.5 → suggestedDeload = false (lots in the tank).
 *   - otherwise   → suggestedDeload = false (a borderline week, keep going).
 *
 * If no workouts were recorded or none had RPE set, suggestedDeload is false
 * and avgRpe is 0 (we don't speculate from a single workout).
 */

export interface WeeklyWorkout {
  id: string
  date: Date | string
  totalVolumeLb: number
  totalDurationMin: number
  completed: boolean
  rpe: number | null
}

export interface WeeklyReview {
  workoutCount: number
  completedCount: number
  totalVolumeLb: number
  totalDurationMin: number
  avgRpe: number
  suggestedDeload: boolean
  /** Human-friendly summary for the UI. */
  summary: string
}

const DELOAD_THRESHOLD = 8.5
const EASY_THRESHOLD = 7.5

export function generateWeeklyReview(workouts: WeeklyWorkout[]): WeeklyReview {
  const completed = workouts.filter((w) => w.completed)

  const totalVolumeLb = completed.reduce((sum, w) => sum + w.totalVolumeLb, 0)
  const totalDurationMin = completed.reduce((sum, w) => sum + w.totalDurationMin, 0)

  const rpes = completed
    .map((w) => w.rpe)
    .filter((r): r is number => typeof r === 'number' && !Number.isNaN(r))
  const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : 0

  const suggestedDeload = avgRpe > DELOAD_THRESHOLD

  let summary: string
  if (completed.length === 0) {
    summary = 'No workouts completed this week — rest is fine, but log your sessions!'
  } else if (suggestedDeload) {
    summary = `Average RPE ${avgRpe.toFixed(1)} is high — schedule a deload week (40-60% volume) next week.`
  } else if (avgRpe > 0 && avgRpe < EASY_THRESHOLD) {
    summary = `Average RPE ${avgRpe.toFixed(1)} is low — you have room to push harder next week.`
  } else if (avgRpe > 0) {
    summary = `Average RPE ${avgRpe.toFixed(1)} is in the sweet spot — keep the same plan.`
  } else {
    summary = `Completed ${completed.length} workout(s) — start logging RPE to unlock deload suggestions.`
  }

  return {
    workoutCount: workouts.length,
    completedCount: completed.length,
    totalVolumeLb,
    totalDurationMin,
    avgRpe: Math.round(avgRpe * 10) / 10,
    suggestedDeload,
    summary,
  }
}
