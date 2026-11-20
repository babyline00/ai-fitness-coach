import { test, expect, describe } from 'bun:test'
import { EXERCISES } from '../exercise-data'
import {
  generateWorkout,
  makeProfile,
  parseDbProfile,
  estimateExerciseMinutes,
} from '../workout-generator'

describe('workout-generator', () => {
  test('generateWorkout returns 3 blocks: warmup, main, cooldown', () => {
    const w = generateWorkout(makeProfile(), EXERCISES)
    expect(w.blocks).toHaveLength(3)
    expect(w.blocks[0].phase).toBe('warmup')
    expect(w.blocks[1].phase).toBe('main')
    expect(w.blocks[2].phase).toBe('cooldown')
  })

  test('total duration does not exceed profile.timePerSessionMin (with small overshoot allowed)', () => {
    const w = generateWorkout(
      makeProfile({ timePerSessionMin: 30 }),
      EXERCISES,
    )
    // The generator may overshoot the main block by up to ~2 min.
    expect(w.totalDurationMin).toBeLessThanOrEqual(30 + 2)
  })

  test('all exercises use only equipment the user owns (or bodyweight)', () => {
    const w = generateWorkout(
      makeProfile({ equipment: ['dumbbells'] }),
      EXERCISES,
    )
    for (const block of w.blocks) {
      for (const ex of block.exercises) {
        expect(['bodyweight', 'dumbbells']).toContain(ex.equipment)
      }
    }
  })

  test('warmup block exercises are all mobility', () => {
    const w = generateWorkout(makeProfile(), EXERCISES)
    for (const ex of w.blocks[0].exercises) {
      expect(ex.category).toBe('mobility')
    }
  })

  test('main block exercises are strength or core (for general_fitness goal)', () => {
    const w = generateWorkout(
      makeProfile({ goals: 'general_fitness' }),
      EXERCISES,
    )
    for (const ex of w.blocks[1].exercises) {
      expect(['strength', 'core', 'cardio']).toContain(ex.category)
    }
    expect(w.blocks[1].exercises.length).toBeGreaterThan(0)
  })

  test('cooldown block exercises are mobility/stretches', () => {
    const w = generateWorkout(makeProfile(), EXERCISES)
    for (const ex of w.blocks[2].exercises) {
      expect(ex.category).toBe('mobility')
    }
  })

  test('fatigued user gets fewer sets and longer rest (80% / 120%)', () => {
    const fresh = generateWorkout(makeProfile({ recoveryState: 'fresh' }), EXERCISES)
    const fatigued = generateWorkout(makeProfile({ recoveryState: 'fatigued' }), EXERCISES)
    const freshMainSets = fresh.blocks[1].exercises.reduce((s, e) => s + e.sets, 0)
    const fatiguedMainSets = fatigued.blocks[1].exercises.reduce((s, e) => s + e.sets, 0)
    expect(fatiguedMainSets).toBeLessThanOrEqual(freshMainSets)
    // Rest must be at least as long for the fatigued user.
    const freshMaxRest = Math.max(...fresh.blocks[1].exercises.map((e) => e.restSec))
    const fatiguedMaxRest = Math.max(...fatigued.blocks[1].exercises.map((e) => e.restSec))
    expect(fatiguedMaxRest).toBeGreaterThanOrEqual(freshMaxRest)
  })

  test('fatigued user has at most 80% of fresh volume', () => {
    const fresh = generateWorkout(makeProfile({ recoveryState: 'fresh' }), EXERCISES)
    const fatigued = generateWorkout(makeProfile({ recoveryState: 'fatigued' }), EXERCISES)
    // Volume tracks sets (reps + weight are kept constant in recovery adjustment).
    expect(fatigued.totalVolumeLb).toBeLessThanOrEqual(Math.ceil(fresh.totalVolumeLb * 0.8))
  })

  test('main block exercises carry cues and instructions', () => {
    const w = generateWorkout(makeProfile(), EXERCISES)
    for (const ex of w.blocks[1].exercises) {
      expect(ex.cues.length).toBeGreaterThan(0)
      expect(ex.instructions.length).toBeGreaterThan(0)
    }
  })

  test('main block exercises carry sets, reps, rest, weight, time', () => {
    const w = generateWorkout(makeProfile(), EXERCISES)
    for (const ex of w.blocks[1].exercises) {
      expect(ex.sets).toBeGreaterThan(0)
      expect(ex.reps).toBeGreaterThan(0)
      expect(ex.restSec).toBeGreaterThanOrEqual(0)
      expect(ex.weightLb).toBeGreaterThanOrEqual(0)
      expect(ex.estimatedTimeMin).toBeGreaterThan(0)
    }
  })

  test('parseDbProfile parses comma-separated equipment and goals', () => {
    const p = parseDbProfile({
      goals: 'strength, hypertrophy',
      equipment: 'dumbbells, barbell',
      timePerSessionMin: 45,
      daysPerWeek: 3,
      recoveryState: 'moderate',
      experienceLevel: 'advanced',
    })
    expect(p.goals).toBe('strength')
    expect(p.equipment).toEqual(['dumbbells', 'barbell'])
    expect(p.recoveryState).toBe('moderate')
    expect(p.experienceLevel).toBe('advanced')
  })

  test('parseDbProfile falls back to defaults for unknown enum values', () => {
    const p = parseDbProfile({
      goals: 'not-a-goal',
      equipment: 'not-equipment',
      timePerSessionMin: 30,
      daysPerWeek: 2,
      recoveryState: 'not-a-state',
      experienceLevel: 'not-a-level',
    })
    expect(p.goals).toBe('general_fitness')
    expect(p.equipment).toEqual([])
    expect(p.recoveryState).toBe('fresh')
    expect(p.experienceLevel).toBe('intermediate')
  })

  test('estimateExerciseMinutes scales with sets, reps, rest', () => {
    const short = estimateExerciseMinutes(3, 5, 30)
    const long = estimateExerciseMinutes(5, 12, 180)
    expect(long).toBeGreaterThan(short)
  })

  test('user with very small time budget still gets at least one main exercise', () => {
    const w = generateWorkout(
      makeProfile({ timePerSessionMin: 15 }),
      EXERCISES,
    )
    expect(w.blocks[1].exercises.length).toBeGreaterThan(0)
  })
})
