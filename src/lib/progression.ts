/**
 * Adaptive progression — pure function `nextWorkoutProgression(history, currentWorkout)`.
 *
 * Rules (documented + tested):
 *   - First time an exercise shows up in history → keep the current (default)
 *     weight, no rep increase. Reason: "first time, use default weight".
 *   - All target sets completed AND workout RPE ≤ 7  → +5 lb next session.
 *   - All target sets completed AND RPE 8–9          → +1 rep next session.
 *   - Failed sets (completedSets < target)            → no change.
 *   - RPE ≥ 10 (maxed out)                            → no change (deload territory).
 *
 * The function is pure: it never touches the database. The API route is
 * responsible for persisting the resulting "next workout" if it wants to.
 */

export interface HistoryExercise {
  exerciseId: string
  sets: number
  reps: number
  weightLb: number
  completedSets: number
}

export interface HistoryWorkout {
  date: Date | string
  rpe: number | null
  exercises: HistoryExercise[]
}

export interface CurrentWorkoutExercise {
  exerciseId: string
  exerciseName: string
  sets: number
  reps: number
  weightLb: number
  completedSets: number
}

export interface CurrentWorkout {
  rpe: number | null
  exercises: CurrentWorkoutExercise[]
}

export interface ProgressionSuggestion {
  exerciseId: string
  exerciseName: string
  newSets: number
  newReps: number
  newWeightLb: number
  reason: string
  /** Convenience: the absolute change in weight vs. the current workout. */
  deltaWeightLb: number
  /** Convenience: the absolute change in reps vs. the current workout. */
  deltaReps: number
}

const LB_STEP = 5
const RPE_GOOD = 7
const RPE_HARD = 8
const RPE_MAX = 10

function clampRpe(rpe: number | null): number {
  if (rpe == null) return RPE_GOOD
  if (Number.isNaN(rpe)) return RPE_GOOD
  return Math.max(1, Math.min(10, Math.round(rpe)))
}

export function nextWorkoutProgression(
  history: HistoryWorkout[],
  currentWorkout: CurrentWorkout,
): ProgressionSuggestion[] {
  const knownIds = new Set<string>()
  for (const w of history) {
    for (const ex of w.exercises) knownIds.add(ex.exerciseId)
  }
  const rpe = clampRpe(currentWorkout.rpe)

  return currentWorkout.exercises.map((ex): ProgressionSuggestion => {
    const hasHistory = knownIds.has(ex.exerciseId)
    const allSetsCompleted = ex.completedSets >= ex.sets

    if (!hasHistory) {
      return {
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        newSets: ex.sets,
        newReps: ex.reps,
        newWeightLb: ex.weightLb,
        reason: 'First time on this exercise — using the default starting weight.',
        deltaWeightLb: 0,
        deltaReps: 0,
      }
    }

    if (!allSetsCompleted) {
      return {
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        newSets: ex.sets,
        newReps: ex.reps,
        newWeightLb: ex.weightLb,
        reason: 'Missed reps last session — keeping the same load to consolidate.',
        deltaWeightLb: 0,
        deltaReps: 0,
      }
    }

    if (rpe <= RPE_GOOD) {
      const newWeight = ex.weightLb + LB_STEP
      return {
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        newSets: ex.sets,
        newReps: ex.reps,
        newWeightLb: newWeight,
        reason: `All sets completed with RPE ${rpe} (good form) — adding ${LB_STEP} lb.`,
        deltaWeightLb: LB_STEP,
        deltaReps: 0,
      }
    }

    if (rpe >= RPE_HARD && rpe < RPE_MAX) {
      const newReps = ex.reps + 1
      return {
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        newSets: ex.sets,
        newReps,
        newWeightLb: ex.weightLb,
        reason: `All sets completed but RPE ${rpe} is high — adding 1 rep instead of weight.`,
        deltaWeightLb: 0,
        deltaReps: 1,
      }
    }

    // rpe === 10 (or anything else weird) — no change.
    return {
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      newSets: ex.sets,
      newReps: ex.reps,
      newWeightLb: ex.weightLb,
      reason: `RPE ${rpe} is at the limit — keep load the same and recover.`,
      deltaWeightLb: 0,
      deltaReps: 0,
    }
  })
}

/**
 * Convenience: turn a list of progression suggestions into a "next workout"
 * exercise list, ready to be persisted as a new Workout. Pure function.
 */
export function applyProgressionToWorkoutExercises(
  current: CurrentWorkoutExercise[],
  suggestions: ProgressionSuggestion[],
): CurrentWorkoutExercise[] {
  const byId = new Map(suggestions.map((s) => [s.exerciseId, s]))
  return current.map((ex) => {
    const s = byId.get(ex.exerciseId)
    if (!s) return ex
    return {
      ...ex,
      sets: s.newSets,
      reps: s.newReps,
      weightLb: s.newWeightLb,
      // Reset completedSets for the new session.
      completedSets: 0,
    }
  })
}
