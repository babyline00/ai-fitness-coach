import { test, expect, describe } from 'bun:test'
import { mapGoalToFocus, coerceGoal, targetRepsForGoal, targetSetsForGoal, targetRestForGoal } from '../goal-mapper'

describe('goal-mapper', () => {
  test('strength -> 5 reps × 5 sets × 180s rest', () => {
    const f = mapGoalToFocus('strength')
    expect(f.primarySets).toBe(5)
    expect(f.restSec).toBe(180)
    // 5 reps is the midpoint of (3,6).
    const mid = Math.round((f.primaryRepRange.min + f.primaryRepRange.max) / 2)
    expect(mid).toBe(5)
  })

  test('hypertrophy -> 8-12 reps × 4 sets × 90s rest', () => {
    const f = mapGoalToFocus('hypertrophy')
    expect(f.primaryRepRange).toEqual({ min: 8, max: 12 })
    expect(f.primarySets).toBe(4)
    expect(f.restSec).toBe(90)
  })

  test('endurance -> 15+ reps × 3 sets × 30s rest', () => {
    const f = mapGoalToFocus('endurance')
    expect(f.primaryRepRange.min).toBeGreaterThanOrEqual(15)
    expect(f.primarySets).toBe(3)
    expect(f.restSec).toBe(30)
  })

  test('weight_loss -> 12-15 reps × 4 sets × short rest', () => {
    const f = mapGoalToFocus('weight_loss')
    expect(f.primaryRepRange).toEqual({ min: 12, max: 15 })
    expect(f.primarySets).toBe(4)
    expect(f.restSec).toBeLessThan(60)
  })

  test('general_fitness -> balanced defaults', () => {
    const f = mapGoalToFocus('general_fitness')
    expect(f.primarySets).toBe(3)
    expect(f.restSec).toBe(60)
  })

  test('mapGoalToFocus returns the goal in the focus object', () => {
    for (const goal of ['strength', 'hypertrophy', 'endurance', 'weight_loss', 'general_fitness'] as const) {
      expect(mapGoalToFocus(goal).goal).toBe(goal)
    }
  })

  test('coerceGoal returns the goal when valid, falls back to general_fitness otherwise', () => {
    expect(coerceGoal('strength')).toBe('strength')
    expect(coerceGoal('garbage')).toBe('general_fitness')
    expect(coerceGoal('')).toBe('general_fitness')
  })

  test('targetRepsForGoal leaves cardio/mobility reps untouched', () => {
    const f = mapGoalToFocus('strength')
    expect(targetRepsForGoal({ category: 'cardio', defaultReps: 30 }, f)).toBe(30)
    expect(targetRepsForGoal({ category: 'mobility', defaultReps: 10 }, f)).toBe(10)
    expect(targetRepsForGoal({ category: 'strength', defaultReps: 8 }, f)).toBe(5)
  })

  test('targetSetsForGoal leaves mobility sets untouched', () => {
    const f = mapGoalToFocus('hypertrophy')
    expect(targetSetsForGoal({ category: 'mobility', defaultSets: 1 }, f)).toBe(1)
    expect(targetSetsForGoal({ category: 'strength', defaultSets: 4 }, f)).toBe(4)
  })

  test('targetRestForGoal leaves mobility rest at 0', () => {
    const f = mapGoalToFocus('strength')
    expect(targetRestForGoal({ category: 'mobility', defaultRestSec: 0 }, f)).toBe(0)
    expect(targetRestForGoal({ category: 'strength', defaultRestSec: 999 }, f)).toBe(180)
  })
})
