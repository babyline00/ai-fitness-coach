import { test, expect, describe } from 'bun:test'
import { generateWeeklyReview, type WeeklyWorkout } from '../weekly-review'

function w(
  overrides: Partial<WeeklyWorkout> = {},
): WeeklyWorkout {
  return {
    id: 'w-' + Math.random().toString(36).slice(2),
    date: '2024-01-01',
    totalVolumeLb: 5000,
    totalDurationMin: 45,
    completed: true,
    rpe: 7,
    ...overrides,
  }
}

describe('weekly-review', () => {
  test('empty week -> zero totals, no deload', () => {
    const r = generateWeeklyReview([])
    expect(r.totalVolumeLb).toBe(0)
    expect(r.avgRpe).toBe(0)
    expect(r.suggestedDeload).toBe(false)
    expect(r.workoutCount).toBe(0)
  })

  test('avgRPE > 8.5 -> suggestedDeload true', () => {
    const workouts = [w({ rpe: 9 }), w({ rpe: 9 })]
    const r = generateWeeklyReview(workouts)
    expect(r.avgRpe).toBeGreaterThan(8.5)
    expect(r.suggestedDeload).toBe(true)
  })

  test('avgRPE < 7.5 -> suggestedDeload false', () => {
    const workouts = [w({ rpe: 6 }), w({ rpe: 7 })]
    const r = generateWeeklyReview(workouts)
    expect(r.avgRpe).toBeLessThan(7.5)
    expect(r.suggestedDeload).toBe(false)
  })

  test('avgRPE in the 7.5-8.5 band -> no deload', () => {
    const workouts = [w({ rpe: 8 }), w({ rpe: 8 })]
    const r = generateWeeklyReview(workouts)
    expect(r.avgRpe).toBeGreaterThanOrEqual(7.5)
    expect(r.avgRpe).toBeLessThanOrEqual(8.5)
    expect(r.suggestedDeload).toBe(false)
  })

  test('totalVolumeLb sums completed workouts only', () => {
    const workouts = [w({ totalVolumeLb: 1000, completed: true }), w({ totalVolumeLb: 500, completed: false })]
    const r = generateWeeklyReview(workouts)
    expect(r.totalVolumeLb).toBe(1000)
    expect(r.completedCount).toBe(1)
    expect(r.workoutCount).toBe(2)
  })

  test('avgRpe ignores null RPE entries', () => {
    const workouts = [w({ rpe: 9 }), w({ rpe: null })]
    const r = generateWeeklyReview(workouts)
    expect(r.avgRpe).toBe(9)
  })

  test('summary text mentions deload when suggestedDeload is true', () => {
    const r = generateWeeklyReview([w({ rpe: 9 }), w({ rpe: 9 })])
    expect(r.summary.toLowerCase()).toContain('deload')
  })

  test('summary text mentions "push harder" when avgRpe is low', () => {
    const r = generateWeeklyReview([w({ rpe: 5 })])
    expect(r.summary.toLowerCase()).toContain('push harder')
  })

  test('summary text prompts to log RPE when no RPE was recorded', () => {
    const r = generateWeeklyReview([w({ rpe: null })])
    expect(r.summary.toLowerCase()).toContain('rpe')
  })

  test('totalDurationMin sums completed workouts', () => {
    const workouts = [w({ totalDurationMin: 45, completed: true }), w({ totalDurationMin: 30, completed: true })]
    const r = generateWeeklyReview(workouts)
    expect(r.totalDurationMin).toBe(75)
  })
})
