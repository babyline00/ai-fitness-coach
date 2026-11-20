/**
 * Adjust a generated workout for the user's recovery state.
 *
 *   fresh    -> unchanged
 *   moderate -> unchanged (already in normal range)
 *   fatigued -> 80% of normal volume: fewer sets (rounded, min 2) AND 120% rest
 *
 * Volume here means "sets per exercise" — total reps per set stay the same so
 * the relative intensity the user trains at is preserved (just less of it).
 */

import type { RecoveryState } from './exercise-data'
import type { WorkoutBlock, WorkoutExercise } from './workout-generator'

export function adjustForRecovery<T extends WorkoutBlock>(
  workout: { blocks: T[]; totalDurationMin: number; totalVolumeLb: number },
  recoveryState: RecoveryState,
): { blocks: T[]; totalDurationMin: number; totalVolumeLb: number } {
  if (recoveryState === 'fresh' || recoveryState === 'moderate') {
    return {
      blocks: workout.blocks.map((b) => ({ ...b, exercises: b.exercises.map((e) => ({ ...e })) })),
      totalDurationMin: workout.totalDurationMin,
      totalVolumeLb: workout.totalVolumeLb,
    }
  }

  // fatigued
  const adjusted = workout.blocks.map((block) => ({
    ...block,
    exercises: block.exercises.map((ex): WorkoutExercise => ({
      ...ex,
      // 80% sets, min 2
      sets: Math.max(2, Math.round(ex.sets * 0.8)),
      // 120% rest, rounded to nearest 5s
      restSec: Math.round((ex.restSec * 1.2) / 5) * 5,
    })),
  }))

  // Recompute totals: total volume is sets × reps × weight (we don't know weight
  // here — we just keep the original totalVolumeLb and scale it 80% because we
  // removed 20% of the sets).
  const totalVolumeLb = Math.round(workout.totalVolumeLb * 0.8)

  // Recompute duration: rest time goes up ~20%, set time goes down ~20% (fewer sets).
  // Approximate: duration = sum(ex.sets * setSec + restSec * (sets-1)) + 5min warmup + 5min cooldown
  const computeDuration = (blocks: T[]) => {
    let sec = 0
    for (const block of blocks) {
      for (const ex of block.exercises) {
        const setSec = ex.category === 'mobility' ? 30 : 40
        sec += ex.sets * setSec
        sec += Math.max(0, ex.sets - 1) * ex.restSec
      }
    }
    return Math.max(10, Math.round(sec / 60))
  }

  return {
    blocks: adjusted,
    totalDurationMin: computeDuration(adjusted),
    totalVolumeLb,
  }
}
