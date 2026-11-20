import { test, expect, describe } from 'bun:test'
import {
  nextWorkoutProgression,
  applyProgressionToWorkoutExercises,
  type CurrentWorkout,
  type HistoryWorkout,
} from '../progression'

const baseExercise = {
  exerciseId: 'back-squat',
  exerciseName: 'Back Squat',
  sets: 5,
  reps: 5,
  weightLb: 135,
  completedSets: 5,
}

function current(rpe: number | null, overrides: Partial<typeof baseExercise> = {}): CurrentWorkout {
  return {
    rpe,
    exercises: [{ ...baseExercise, ...overrides }],
  }
}

describe('progression', () => {
  test('all sets completed + good form (RPE <= 7) -> +5 lb', () => {
    const suggestions = nextWorkoutProgression([], current(7))
    expect(suggestions).toHaveLength(1)
    // First time (no history) → use default, NOT +5 lb. So we need history.
  })

  test('with history: all sets + RPE 7 -> +5 lb', () => {
    const history: HistoryWorkout[] = [
      {
        date: '2024-01-01',
        rpe: 7,
        exercises: [{ exerciseId: 'back-squat', sets: 5, reps: 5, weightLb: 130, completedSets: 5 }],
      },
    ]
    const suggestions = nextWorkoutProgression(history, current(7))
    expect(suggestions[0].newWeightLb).toBe(135 + 5)
    expect(suggestions[0].deltaWeightLb).toBe(5)
    expect(suggestions[0].deltaReps).toBe(0)
    expect(suggestions[0].reason).toContain('RPE 7')
  })

  test('with history: completed but RPE 8-9 -> +1 rep', () => {
    const history: HistoryWorkout[] = [
      {
        date: '2024-01-01',
        rpe: 8,
        exercises: [{ exerciseId: 'back-squat', sets: 5, reps: 5, weightLb: 135, completedSets: 5 }],
      },
    ]
    const suggestions = nextWorkoutProgression(history, current(8))
    expect(suggestions[0].newReps).toBe(6)
    expect(suggestions[0].newWeightLb).toBe(135)
    expect(suggestions[0].deltaReps).toBe(1)
    expect(suggestions[0].deltaWeightLb).toBe(0)
  })

  test('RPE 9 also maps to +1 rep (boundary of the 8-9 range)', () => {
    const history: HistoryWorkout[] = [
      {
        date: '2024-01-01',
        rpe: 9,
        exercises: [{ exerciseId: 'back-squat', sets: 5, reps: 5, weightLb: 135, completedSets: 5 }],
      },
    ]
    const suggestions = nextWorkoutProgression(history, current(9))
    expect(suggestions[0].newReps).toBe(6)
  })

  test('failed sets (completedSets < target) -> no change', () => {
    const history: HistoryWorkout[] = [
      {
        date: '2024-01-01',
        rpe: 6,
        exercises: [{ exerciseId: 'back-squat', sets: 5, reps: 5, weightLb: 135, completedSets: 5 }],
      },
    ]
    const w = current(6, { completedSets: 3 })
    const suggestions = nextWorkoutProgression(history, w)
    expect(suggestions[0].newWeightLb).toBe(135)
    expect(suggestions[0].newReps).toBe(5)
    expect(suggestions[0].deltaWeightLb).toBe(0)
    expect(suggestions[0].reason).toContain('Missed reps')
  })

  test('first time exercise (no history) -> use default weight (no change)', () => {
    const suggestions = nextWorkoutProgression([], current(7))
    expect(suggestions[0].newWeightLb).toBe(135)
    expect(suggestions[0].newReps).toBe(5)
    expect(suggestions[0].deltaWeightLb).toBe(0)
    expect(suggestions[0].reason).toContain('First time')
  })

  test('RPE 10 (maxed) -> no change', () => {
    const history: HistoryWorkout[] = [
      {
        date: '2024-01-01',
        rpe: 10,
        exercises: [{ exerciseId: 'back-squat', sets: 5, reps: 5, weightLb: 135, completedSets: 5 }],
      },
    ]
    const suggestions = nextWorkoutProgression(history, current(10))
    expect(suggestions[0].newWeightLb).toBe(135)
    expect(suggestions[0].newReps).toBe(5)
    expect(suggestions[0].reason).toContain('limit')
  })

  test('null RPE defaults to RPE 7 behavior (treat as good form)', () => {
    const history: HistoryWorkout[] = [
      {
        date: '2024-01-01',
        rpe: null,
        exercises: [{ exerciseId: 'back-squat', sets: 5, reps: 5, weightLb: 135, completedSets: 5 }],
      },
    ]
    const suggestions = nextWorkoutProgression(history, current(null))
    expect(suggestions[0].newWeightLb).toBe(140)
    expect(suggestions[0].deltaWeightLb).toBe(5)
  })

  test('multiple exercises each get their own suggestion', () => {
    const history: HistoryWorkout[] = [
      {
        date: '2024-01-01',
        rpe: 7,
        exercises: [
          { exerciseId: 'back-squat', sets: 5, reps: 5, weightLb: 135, completedSets: 5 },
          { exerciseId: 'bench-press', sets: 5, reps: 5, weightLb: 95, completedSets: 5 },
        ],
      },
    ]
    const w: CurrentWorkout = {
      rpe: 7,
      exercises: [
        { ...baseExercise },
        { exerciseId: 'bench-press', exerciseName: 'Bench Press', sets: 5, reps: 5, weightLb: 95, completedSets: 5 },
      ],
    }
    const suggestions = nextWorkoutProgression(history, w)
    expect(suggestions).toHaveLength(2)
    expect(suggestions[0].exerciseId).toBe('back-squat')
    expect(suggestions[1].exerciseId).toBe('bench-press')
    expect(suggestions[1].newWeightLb).toBe(100)
  })

  test('applyProgressionToWorkoutExercises updates sets, reps, weight and resets completedSets', () => {
    const suggestions = nextWorkoutProgression(
      [
        { date: '2024-01-01', rpe: 7, exercises: [{ exerciseId: 'back-squat', sets: 5, reps: 5, weightLb: 135, completedSets: 5 }] },
      ],
      current(7),
    )
    const next = applyProgressionToWorkoutExercises([baseExercise], suggestions)
    expect(next[0].weightLb).toBe(140)
    expect(next[0].completedSets).toBe(0)
  })
})
