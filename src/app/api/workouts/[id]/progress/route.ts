import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import {
  applyProgressionToWorkoutExercises,
  nextWorkoutProgression,
  type CurrentWorkout,
  type CurrentWorkoutExercise,
  type HistoryWorkout,
} from '@/lib/progression'
import { computeTotalVolume } from '@/lib/workout-generator'

function safeParseBlocks(s: string): any[] {
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

/**
 * POST /api/workouts/[id]/progress
 * Given the just-completed workout (id) plus the history of prior completed
 * workouts for the same profile, compute the next workout's progression
 * suggestions and persist the new workout as a new Workout row (not yet
 * completed).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const currentRow = await db.workout.findUnique({ where: { id } })
  if (!currentRow) {
    return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
  }

  // Pull history: all earlier completed workouts for the same profile.
  const historyRows = await db.workout.findMany({
    where: {
      profileId: currentRow.profileId,
      completed: true,
      date: { lt: currentRow.date },
    },
    orderBy: { date: 'asc' },
  })

  // Build the history shape the progression function expects.
  const history: HistoryWorkout[] = historyRows.map((w) => ({
    date: w.date,
    rpe: w.rpe,
    exercises: collectExercises(safeParseBlocks(w.blocksJson), w.completed),
  }))

  const currentExercises = collectExercises(
    safeParseBlocks(currentRow.blocksJson),
    currentRow.completed,
  )
  const current: CurrentWorkout = {
    rpe: currentRow.rpe,
    exercises: currentExercises,
  }

  const suggestions = nextWorkoutProgression(history, current)
  const nextExercises = applyProgressionToWorkoutExercises(currentExercises, suggestions)

  // Build the new workout: keep the same block structure but replace main block
  // exercises with the progressed versions.
  const oldBlocks = safeParseBlocks(currentRow.blocksJson)
  const newBlocks = oldBlocks.map((block: any) => {
    if (block.phase !== 'main') return block
    return {
      ...block,
      exercises: nextExercises.map((e) => ({
        exerciseId: e.exerciseId,
        name: e.exerciseName,
        category: block.exercises.find((x: any) => x.exerciseId === e.exerciseId)?.category ?? 'strength',
        equipment: block.exercises.find((x: any) => x.exerciseId === e.exerciseId)?.equipment ?? 'bodyweight',
        muscleGroups: block.exercises.find((x: any) => x.exerciseId === e.exerciseId)?.muscleGroups ?? [],
        sets: e.sets,
        reps: e.reps,
        restSec: block.exercises.find((x: any) => x.exerciseId === e.exerciseId)?.restSec ?? 60,
        weightLb: e.weightLb,
        estimatedTimeMin: block.exercises.find((x: any) => x.exerciseId === e.exerciseId)?.estimatedTimeMin ?? 5,
        cues: block.exercises.find((x: any) => x.exerciseId === e.exerciseId)?.cues ?? [],
        instructions: block.exercises.find((x: any) => x.exerciseId === e.exerciseId)?.instructions ?? [],
      })),
    }
  })

  const totalVolumeLb = computeTotalVolume(newBlocks)
  const totalDurationMin = newBlocks.reduce(
    (sum: number, b: any) => sum + (b.durationMin ?? 0),
    0,
  )

  const newWorkout = await db.workout.create({
    data: {
      profileId: currentRow.profileId,
      blocksJson: JSON.stringify(newBlocks),
      totalVolumeLb,
      totalDurationMin,
      completed: false,
    },
  })

  return NextResponse.json(
    {
      newWorkout,
      suggestions,
    },
    { status: 201 },
  )
}

/** Flatten main-block exercises from the persisted blocks JSON. */
function collectExercises(
  blocks: any[],
  completed: boolean,
): CurrentWorkoutExercise[] {
  const out: CurrentWorkoutExercise[] = []
  for (const block of blocks) {
    if (block.phase !== 'main') continue
    for (const ex of block.exercises ?? []) {
      out.push({
        exerciseId: ex.exerciseId,
        exerciseName: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        weightLb: ex.weightLb ?? 0,
        // If the workout is marked completed, assume all sets were completed.
        completedSets: completed ? ex.sets : (ex.completedSets ?? 0),
      })
    }
  }
  return out
}
