import { test, expect, describe } from 'bun:test'
import { EXERCISES, getExerciseById, getExercisesByPhase } from '../exercise-data'

const REQUIRED_FIELDS = [
  'id',
  'name',
  'category',
  'muscleGroups',
  'equipment',
  'difficulty',
  'defaultSets',
  'defaultReps',
  'defaultRestSec',
  'instructions',
  'commonFormErrors',
  'cues',
] as const

describe('exercise-data', () => {
  test('library has between 30 and 40 exercises', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(30)
    expect(EXERCISES.length).toBeLessThanOrEqual(40)
  })

  test('every exercise has all required fields', () => {
    for (const ex of EXERCISES) {
      for (const field of REQUIRED_FIELDS) {
        expect(ex).toHaveProperty(field)
        // biome-ignore lint/suspicious/noExplicitAny: test-only
        const value = (ex as any)[field]
        expect(value, `${ex.id}.${field} should be non-null`).not.toBeNull()
        expect(value, `${ex.id}.${field} should not be undefined`).not.toBeUndefined()
      }
    }
  })

  test('every exercise has a unique id', () => {
    const ids = EXERCISES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('every exercise has a unique name', () => {
    const names = EXERCISES.map((e) => e.name)
    expect(new Set(names).size).toBe(names.length)
  })

  test('every exercise has a valid category', () => {
    const valid = ['strength', 'cardio', 'mobility', 'core']
    for (const ex of EXERCISES) {
      expect(valid).toContain(ex.category)
    }
  })

  test('every exercise has a valid equipment value', () => {
    const valid = ['bodyweight', 'dumbbells', 'barbell', 'kettlebell', 'bands', 'machine']
    for (const ex of EXERCISES) {
      expect(valid).toContain(ex.equipment)
    }
  })

  test('every exercise has a valid difficulty', () => {
    const valid = ['beginner', 'intermediate', 'advanced']
    for (const ex of EXERCISES) {
      expect(valid).toContain(ex.difficulty)
    }
  })

  test('muscleGroups is a non-empty array of strings for every exercise', () => {
    for (const ex of EXERCISES) {
      expect(Array.isArray(ex.muscleGroups)).toBe(true)
      expect(ex.muscleGroups.length).toBeGreaterThan(0)
      for (const mg of ex.muscleGroups) {
        expect(typeof mg).toBe('string')
      }
    }
  })

  test('instructions is a non-empty array of strings for every exercise', () => {
    for (const ex of EXERCISES) {
      expect(Array.isArray(ex.instructions)).toBe(true)
      expect(ex.instructions.length).toBeGreaterThan(0)
      for (const s of ex.instructions) {
        expect(typeof s).toBe('string')
        expect(s.length).toBeGreaterThan(0)
      }
    }
  })

  test('commonFormErrors is an array (possibly empty) of strings', () => {
    for (const ex of EXERCISES) {
      expect(Array.isArray(ex.commonFormErrors)).toBe(true)
      for (const e of ex.commonFormErrors) {
        expect(typeof e).toBe('string')
      }
    }
  })

  test('cues is an array of strings', () => {
    for (const ex of EXERCISES) {
      expect(Array.isArray(ex.cues)).toBe(true)
      for (const c of ex.cues) {
        expect(typeof c).toBe('string')
      }
    }
  })

  test('numeric fields have sensible values', () => {
    for (const ex of EXERCISES) {
      expect(ex.defaultSets, `${ex.id} defaultSets`).toBeGreaterThan(0)
      expect(ex.defaultReps, `${ex.id} defaultReps`).toBeGreaterThan(0)
      expect(ex.defaultRestSec, `${ex.id} defaultRestSec`).toBeGreaterThanOrEqual(0)
    }
  })

  test('getExerciseById returns the exercise by id', () => {
    const first = EXERCISES[0]
    expect(getExerciseById(first.id)).toBe(first)
  })

  test('getExerciseById returns undefined for unknown id', () => {
    expect(getExerciseById('does-not-exist')).toBeUndefined()
  })

  test('getExercisesByPhase partitions correctly', () => {
    const warmup = getExercisesByPhase('warmup')
    const main = getExercisesByPhase('main')
    const cooldown = getExercisesByPhase('cooldown')
    expect(warmup.length).toBeGreaterThan(0)
    expect(main.length).toBeGreaterThan(0)
    expect(cooldown.length).toBeGreaterThan(0)
    for (const ex of warmup) expect(ex.phase).toBe('warmup')
    for (const ex of main) expect(ex.phase).toBe('main')
    for (const ex of cooldown) expect(ex.phase).toBe('cooldown')
  })
})
