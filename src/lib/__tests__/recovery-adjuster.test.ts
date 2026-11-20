import { test, expect, describe } from 'bun:test'
import { adjustForRecovery } from '../recovery-adjuster'
import type { WorkoutBlock } from '../workout-generator'

function makeWorkout(sets: number, restSec: number): {
  blocks: WorkoutBlock[]
  totalDurationMin: number
  totalVolumeLb: number
} {
  const ex = {
    exerciseId: 'back-squat',
    name: 'Back Squat',
    category: 'strength',
    equipment: 'barbell',
    muscleGroups: ['quads'],
    sets,
    reps: 5,
    restSec,
    weightLb: 135,
    estimatedTimeMin: 8,
    cues: ['keep chest tall'],
    instructions: ['unrack', 'squat', 'stand'],
  }
  const block: WorkoutBlock = {
    name: 'Main',
    phase: 'main',
    exercises: [ex],
    durationMin: 8,
  }
  return {
    blocks: [block],
    totalDurationMin: 8,
    totalVolumeLb: sets * 5 * 135,
  }
}

describe('recovery-adjuster', () => {
  test('fresh -> unchanged', () => {
    const original = makeWorkout(5, 120)
    const out = adjustForRecovery(original, 'fresh')
    expect(out.blocks[0].exercises[0].sets).toBe(5)
    expect(out.blocks[0].exercises[0].restSec).toBe(120)
    expect(out.totalVolumeLb).toBe(original.totalVolumeLb)
  })

  test('moderate -> unchanged (same as fresh)', () => {
    const original = makeWorkout(5, 120)
    const out = adjustForRecovery(original, 'moderate')
    expect(out.blocks[0].exercises[0].sets).toBe(5)
    expect(out.blocks[0].exercises[0].restSec).toBe(120)
  })

  test('fatigued -> 80% sets (rounded, min 2)', () => {
    const original = makeWorkout(5, 120)
    const out = adjustForRecovery(original, 'fatigued')
    // round(5 * 0.8) = round(4) = 4
    expect(out.blocks[0].exercises[0].sets).toBe(4)
  })

  test('fatigued -> 120% rest (rounded to nearest 5s)', () => {
    const original = makeWorkout(5, 120)
    const out = adjustForRecovery(original, 'fatigued')
    // round(120 * 1.2 / 5) * 5 = round(28.8) * 5 = 29 * 5 = 145
    expect(out.blocks[0].exercises[0].restSec).toBe(145)
  })

  test('fatigued -> at least 2 sets minimum', () => {
    const original = makeWorkout(2, 60)
    const out = adjustForRecovery(original, 'fatigued')
    // round(2 * 0.8) = round(1.6) = 2 (clamped to min 2)
    expect(out.blocks[0].exercises[0].sets).toBeGreaterThanOrEqual(2)
  })

  test('fatigued -> total volume scales to ~80%', () => {
    const original = makeWorkout(5, 120)
    const out = adjustForRecovery(original, 'fatigued')
    expect(out.totalVolumeLb).toBe(Math.round(original.totalVolumeLb * 0.8))
  })

  test('adjustment does not mutate the original input', () => {
    const original = makeWorkout(5, 120)
    const originalSets = original.blocks[0].exercises[0].sets
    adjustForRecovery(original, 'fatigued')
    expect(original.blocks[0].exercises[0].sets).toBe(originalSets)
  })
})
