import { test, expect, describe } from 'bun:test'
import { EXERCISES } from '../exercise-data'
import { filterByEquipment, canPerform } from '../equipment-filter'

describe('equipment-filter', () => {
  test('user with no equipment gets only bodyweight exercises', () => {
    const result = filterByEquipment(EXERCISES, [])
    expect(result.length).toBeGreaterThan(0)
    for (const ex of result) {
      expect(ex.equipment).toBe('bodyweight')
    }
  })

  test('user with [dumbbells] gets dumbbell + bodyweight exercises only', () => {
    const result = filterByEquipment(EXERCISES, ['dumbbells'])
    for (const ex of result) {
      expect(['bodyweight', 'dumbbells']).toContain(ex.equipment)
    }
    // Should include at least one dumbbell exercise.
    expect(result.some((e) => e.equipment === 'dumbbells')).toBe(true)
    // Should include at least one bodyweight exercise.
    expect(result.some((e) => e.equipment === 'bodyweight')).toBe(true)
    // Should NOT include barbell, kettlebell, bands, or machine.
    expect(result.some((e) => e.equipment === 'barbell')).toBe(false)
    expect(result.some((e) => e.equipment === 'kettlebell')).toBe(false)
    expect(result.some((e) => e.equipment === 'bands')).toBe(false)
    expect(result.some((e) => e.equipment === 'machine')).toBe(false)
  })

  test('user with full equipment gets every exercise back', () => {
    const result = filterByEquipment(EXERCISES, [
      'dumbbells',
      'barbell',
      'kettlebell',
      'bands',
      'machine',
    ])
    expect(result.length).toBe(EXERCISES.length)
  })

  test('bodyweight is implicitly owned even if not listed', () => {
    const result = filterByEquipment(EXERCISES, ['barbell'])
    // Should include bodyweight exercises even though not explicitly listed.
    expect(result.some((e) => e.equipment === 'bodyweight')).toBe(true)
    expect(result.some((e) => e.equipment === 'barbell')).toBe(true)
    // Should NOT include dumbbell exercises.
    expect(result.some((e) => e.equipment === 'dumbbells')).toBe(false)
  })

  test('canPerform returns true for bodyweight always', () => {
    const bodyweight = EXERCISES.find((e) => e.equipment === 'bodyweight')!
    expect(canPerform(bodyweight, [])).toBe(true)
    expect(canPerform(bodyweight, ['dumbbells'])).toBe(true)
  })

  test('canPerform returns true only when equipment is owned', () => {
    const barbell = EXERCISES.find((e) => e.equipment === 'barbell')!
    expect(canPerform(barbell, [])).toBe(false)
    expect(canPerform(barbell, ['barbell'])).toBe(true)
    expect(canPerform(barbell, ['dumbbells'])).toBe(false)
  })
})
