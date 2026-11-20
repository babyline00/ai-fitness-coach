/**
 * Map a training goal to a focus "prescription": the primary rep range, number
 * of sets, and rest between sets. The workout-generator uses this to scale the
 * default exercise parameters up or down toward the user's goal.
 *
 *   strength      -> 5 reps × 5 sets × 180s rest
 *   hypertrophy   -> 8-12 reps × 4 sets × 90s rest
 *   endurance     -> 15+ reps × 3 sets × 30s rest
 *   weight_loss   -> 12-15 reps × 4 sets × 45s rest (high volume, short rest)
 *   general_fitness -> 10 reps × 3 sets × 60s rest (balanced default)
 */

import { ALL_GOALS, type Goal } from './exercise-data'

export interface GoalFocus {
  goal: Goal
  primaryRepRange: { min: number; max: number }
  primarySets: number
  restSec: number
  /** Used by the workout generator to pick main-block exercise categories. */
  preferredCategories: ('strength' | 'cardio' | 'core')[]
}

export function mapGoalToFocus(goal: Goal): GoalFocus {
  switch (goal) {
    case 'strength':
      return {
        goal,
        primaryRepRange: { min: 3, max: 6 },
        primarySets: 5,
        restSec: 180,
        preferredCategories: ['strength'],
      }
    case 'hypertrophy':
      return {
        goal,
        primaryRepRange: { min: 8, max: 12 },
        primarySets: 4,
        restSec: 90,
        preferredCategories: ['strength', 'core'],
      }
    case 'endurance':
      return {
        goal,
        primaryRepRange: { min: 15, max: 25 },
        primarySets: 3,
        restSec: 30,
        preferredCategories: ['cardio', 'strength'],
      }
    case 'weight_loss':
      return {
        goal,
        primaryRepRange: { min: 12, max: 15 },
        primarySets: 4,
        restSec: 45,
        preferredCategories: ['cardio', 'strength'],
      }
    case 'general_fitness':
      return {
        goal,
        primaryRepRange: { min: 8, max: 12 },
        primarySets: 3,
        restSec: 60,
        preferredCategories: ['strength', 'core'],
      }
    default: {
      // Exhaustiveness guard — if a new goal is added this will complain at compile time.
      const _exhaustive: never = goal
      void _exhaustive
      return {
        goal: 'general_fitness',
        primaryRepRange: { min: 8, max: 12 },
        primarySets: 3,
        restSec: 60,
        preferredCategories: ['strength', 'core'],
      }
    }
  }
}

/** Map a single goal string (from API/DB) to a validated Goal. Falls back to general_fitness. */
export function coerceGoal(value: string): Goal {
  return (ALL_GOALS as readonly string[]).includes(value)
    ? (value as Goal)
    : 'general_fitness'
}

/** Pick the "target reps" for a single exercise given the goal focus.
 *  Cardio / mobility exercises are NOT remapped — they keep their default reps. */
export function targetRepsForGoal(
  ex: { category: string; defaultReps: number },
  focus: GoalFocus,
): number {
  if (ex.category === 'cardio' || ex.category === 'mobility') {
    return ex.defaultReps
  }
  // For strength / core, use the midpoint of the goal's rep range.
  const mid = Math.round((focus.primaryRepRange.min + focus.primaryRepRange.max) / 2)
  return mid
}

/** Pick the "target sets" for a single exercise given the goal focus.
 *  Mobility exercises always use their default (typically 1 set). */
export function targetSetsForGoal(
  ex: { category: string; defaultSets: number },
  focus: GoalFocus,
): number {
  if (ex.category === 'mobility') {
    return ex.defaultSets
  }
  return focus.primarySets
}

/** Pick the "target rest" for a single exercise given the goal focus.
 *  Mobility exercises always have 0 rest. */
export function targetRestForGoal(
  ex: { category: string; defaultRestSec: number },
  focus: GoalFocus,
): number {
  if (ex.category === 'mobility') {
    return ex.defaultRestSec
  }
  return focus.restSec
}
