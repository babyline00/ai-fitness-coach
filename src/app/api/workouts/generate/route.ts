import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { EXERCISES } from '@/lib/exercise-data'
import { generateWorkout, parseDbProfile } from '@/lib/workout-generator'

/**
 * POST /api/workouts/generate
 * Body: { profileId: string }
 * Generates a workout for the profile, persists it as a Workout row, and
 * returns the generated workout.
 */
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { profileId } = body ?? {}
  if (!profileId || typeof profileId !== 'string') {
    return NextResponse.json({ error: 'profileId is required' }, { status: 400 })
  }

  const profile = await db.userProfile.findUnique({ where: { id: profileId } })
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const parsed = parseDbProfile(profile)
  const generated = generateWorkout(parsed, EXERCISES)

  const workout = await db.workout.create({
    data: {
      profileId: profile.id,
      blocksJson: JSON.stringify(generated.blocks),
      totalVolumeLb: generated.totalVolumeLb,
      totalDurationMin: generated.totalDurationMin,
      completed: false,
    },
  })

  return NextResponse.json(
    {
      workout,
      generated,
    },
    { status: 201 },
  )
}
