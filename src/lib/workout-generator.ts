/**
 * Adaptive workout generation — pure function `generateWorkout(profile, exercises)`.
 *
 * Returns a single workout:
 *   - Warmup   (5 min mobility)
 *   - Main     (compound + accessory strength/core/cardio scaled to the user's
 *               remaining time budget)
 *   - Cooldown (5 min stretch)
 *
 * Each exercise carries: sets × reps + rest + estimated time + cues + suggested
 * starting weight (so the progression function can grow it over time).
 *
 * Equipment-aware: the caller passes the full EXERCISES array; the generator
 * filters to only what the user owns (plus bodyweight).
 *
 * Recovery-aware: the generator applies `adjustForRecovery` based on the user's
 * recoveryState. Fatigued users get 80% sets + 120% rest.
 */

import {
  ALL_EXPERIENCE_LEVELS,
  ALL_GOALS,
  ALL_RECOVERY_STATES,
  type BlockPhase,
  type Equipment,
  type Exercise,
  type ExperienceLevel,
  type Goal,
  type RecoveryState,
} from './exercise-data'
import { filterByEquipment } from './equipment-filter'
import {
  coerceGoal,
  mapGoalToFocus,
  targetRepsForGoal,
  targetRestForGoal,
  targetSetsForGoal,
  type GoalFocus,
} from './goal-mapper'
import { adjustForRecovery } from './recovery-adjuster'

export interface WorkoutProfile {
  goals: Goal
  equipment: Equipment[]
  timePerSessionMin: number
  daysPerWeek: number
  recoveryState: RecoveryState
  experienceLevel: ExperienceLevel
}

export interface WorkoutExercise {
  exerciseId: string
  name: string
  category: string
  equipment: string
  muscleGroups: string[]
  sets: number
  reps: number
  restSec: number
  weightLb: number
  estimatedTimeMin: number
  cues: string[]
  instructions: string[]
}

export interface WorkoutBlock {
  name: string
  phase: BlockPhase
  exercises: WorkoutExercise[]
  durationMin: number
}

export interface GeneratedWorkout {
  blocks: WorkoutBlock[]
  totalDurationMin: number
  totalVolumeLb: number
}

/** Approximate seconds per rep — used to estimate set duration. */
const SEC_PER_REP = 2

/** Default nominal starting weight (lb) per equipment + experience level. */
const START_WEIGHT_LB: Record<Equipment, Record<ExperienceLevel, number>> = {
  bodyweight: { beginner: 0, intermediate: 0, advanced: 0 },
  dumbbells: { beginner: 15, intermediate: 25, advanced: 40 },
  barbell: { beginner: 45, intermediate: 95, advanced: 135 },
  kettlebell: { beginner: 15, intermediate: 25, advanced: 35 },
  bands: { beginner: 10, intermediate: 20, advanced: 30 },
  machine: { beginner: 30, intermediate: 50, advanced: 80 },
}

/** Approximate how many minutes a single exercise will take. */
export function estimateExerciseMinutes(
  sets: number,
  reps: number,
  restSec: number,
  isMobility = false,
): number {
  if (isMobility) {
    // mobility: ~1 minute per exercise regardless
    return 1
  }
  const setSec = reps * SEC_PER_REP
  const totalSec = sets * setSec + Math.max(0, sets - 1) * restSec
  return Math.max(1, Math.round(totalSec / 60))
}

/** Parse the raw DB profile shape into the validated WorkoutProfile shape. */
export function parseDbProfile(raw: {
  goals: string
  equipment: string
  timePerSessionMin: number
  daysPerWeek: number
  recoveryState: string
  experienceLevel: string
}): WorkoutProfile {
  const goals = coerceGoal(raw.goals.split(',')[0].trim())
  const equipment = raw.equipment
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is Equipment =>
      ['bodyweight', 'dumbbells', 'barbell', 'kettlebell', 'bands', 'machine'].includes(s),
    )
  const recoveryState = (ALL_RECOVERY_STATES as readonly string[]).includes(raw.recoveryState)
    ? (raw.recoveryState as RecoveryState)
    : 'fresh'
  const experienceLevel = (ALL_EXPERIENCE_LEVELS as readonly string[]).includes(
    raw.experienceLevel,
  )
    ? (raw.experienceLevel as ExperienceLevel)
    : 'intermediate'
  return {
    goals,
    equipment,
    timePerSessionMin: raw.timePerSessionMin,
    daysPerWeek: raw.daysPerWeek,
    recoveryState,
    experienceLevel,
  }
}

/** Pick N distinct exercises from a pool, deterministically (by index modulo pool length). */
function pick(pool: Exercise[], n: number, seed = 0): Exercise[] {
  if (pool.length === 0) return []
  const out: Exercise[] = []
  const used = new Set<string>()
  let i = seed % pool.length
  while (out.length < n && used.size < pool.length) {
    const ex = pool[i % pool.length]
    if (!used.has(ex.id)) {
      used.add(ex.id)
      out.push(ex)
    }
    i++
  }
  return out
}

/** Build a WorkoutExercise from an Exercise + a goal focus. */
function toWorkoutExercise(
  ex: Exercise,
  focus: GoalFocus,
  experience: ExperienceLevel,
): WorkoutExercise {
  const sets = targetSetsForGoal(ex, focus)
  const reps = targetRepsForGoal(ex, focus)
  const restSec = targetRestForGoal(ex, focus)
  const weightLb = START_WEIGHT_LB[ex.equipment][experience]
  const estimatedTimeMin = estimateExerciseMinutes(
    sets,
    reps,
    restSec,
    ex.category === 'mobility',
  )
  return {
    exerciseId: ex.id,
    name: ex.name,
    category: ex.category,
    equipment: ex.equipment,
    muscleGroups: ex.muscleGroups,
    sets,
    reps,
    restSec,
    weightLb,
    estimatedTimeMin,
    cues: ex.cues,
    instructions: ex.instructions,
  }
}

/** Main generator. */
export function generateWorkout(
  profile: WorkoutProfile,
  exercises: Exercise[],
): GeneratedWorkout {
  const focus = mapGoalToFocus(profile.goals)
  const usable = filterByEquipment(exercises, profile.equipment)

  const warmupPool = usable.filter((e) => e.phase === 'warmup')
  const cooldownPool = usable.filter((e) => e.phase === 'cooldown')
  const mainPool = usable.filter(
    (e) =>
      e.phase === 'main' &&
      focus.preferredCategories.includes(e.category as 'strength' | 'cardio' | 'core'),
  )
  // Fallback: if the goal pool is empty (e.g. user has very limited equipment),
  // fall back to all main-phase exercises.
  const mainPoolFinal = mainPool.length > 0 ? mainPool : usable.filter((e) => e.phase === 'main')

  // ─── Warmup (5 min) ──────────────────────────────────────────────────────
  const warmupExercises = pick(warmupPool, 4).map((ex) =>
    toWorkoutExercise(ex, focus, profile.experienceLevel),
  )
  const warmupBlock: WorkoutBlock = {
    name: 'Warmup',
    phase: 'warmup',
    exercises: warmupExercises,
    durationMin: 5,
  }

  // ─── Cooldown (5 min) ─────────────────────────────────────────────────────
  const cooldownExercises = pick(cooldownPool, 3).map((ex) =>
    toWorkoutExercise(ex, focus, profile.experienceLevel),
  )
  const cooldownBlock: WorkoutBlock = {
    name: 'Cooldown',
    phase: 'cooldown',
    exercises: cooldownExercises,
    durationMin: 5,
  }

  // ─── Main (scaled to remaining time) ──────────────────────────────────────
  const timeBudgetMin = Math.max(10, profile.timePerSessionMin - 10) // subtract warmup + cooldown
  const mainExercises: WorkoutExercise[] = []
  let mainTimeMin = 0
  // Pick a compound (multi-muscle) exercise first if available, then accessories.
  const sorted = [...mainPoolFinal].sort((a, b) => {
    const aCompound = a.muscleGroups.length >= 3 ? 0 : 1
    const bCompound = b.muscleGroups.length >= 3 ? 0 : 1
    return aCompound - bCompound
  })
  for (const ex of sorted) {
    if (mainTimeMin >= timeBudgetMin) break
    const we = toWorkoutExercise(ex, focus, profile.experienceLevel)
    if (mainTimeMin + we.estimatedTimeMin > timeBudgetMin + 2) {
      // Allow small overshoot but not more than +2 min.
      continue
    }
    mainExercises.push(we)
    mainTimeMin += we.estimatedTimeMin
  }
  // Guarantee at least one main exercise even if budget is tiny.
  if (mainExercises.length === 0 && sorted.length > 0) {
    const we = toWorkoutExercise(sorted[0], focus, profile.experienceLevel)
    mainExercises.push(we)
    mainTimeMin = we.estimatedTimeMin
  }

  const mainBlock: WorkoutBlock = {
    name: 'Main',
    phase: 'main',
    exercises: mainExercises,
    durationMin: mainTimeMin,
  }

  let blocks: WorkoutBlock[] = [warmupBlock, mainBlock, cooldownBlock]
  let totalVolumeLb = computeTotalVolume(blocks)
  let totalDurationMin = warmupBlock.durationMin + mainBlock.durationMin + cooldownBlock.durationMin

  // ─── Recovery adjustment ─────────────────────────────────────────────────
  const adjusted = adjustForRecovery(
    { blocks, totalDurationMin, totalVolumeLb },
    profile.recoveryState,
  )
  blocks = adjusted.blocks
  totalVolumeLb = adjusted.totalVolumeLb
  totalDurationMin = adjusted.totalDurationMin

  return { blocks, totalDurationMin, totalVolumeLb }
}

/** Sum sets × reps × weight across all blocks. */
export function computeTotalVolume(blocks: WorkoutBlock[]): number {
  let vol = 0
  for (const block of blocks) {
    for (const ex of block.exercises) {
      vol += ex.sets * ex.reps * ex.weightLb
    }
  }
  return vol
}

/** Helper for tests: build a minimal valid WorkoutProfile. */
export function makeProfile(partial: Partial<WorkoutProfile> = {}): WorkoutProfile {
  return {
    goals: 'general_fitness',
    equipment: ['bodyweight', 'dumbbells'],
    timePerSessionMin: 45,
    daysPerWeek: 3,
    recoveryState: 'fresh',
    experienceLevel: 'intermediate',
    ...partial,
  }
}

// Re-export so consumers can import everything from one place.
export { ALL_GOALS, ALL_RECOVERY_STATES, ALL_EXPERIENCE_LEVELS }
