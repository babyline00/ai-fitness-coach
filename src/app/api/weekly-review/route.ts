import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { generateWeeklyReview, type WeeklyWorkout } from '@/lib/weekly-review'

/**
 * POST /api/weekly-review
 * Body: { profileId: string, weekStart: string (ISO date) }
 * Generates a review from the past 7 days of workouts (weekStart..weekStart+7d).
 */
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { profileId, weekStart } = body ?? {}
  if (!profileId || typeof profileId !== 'string') {
    return NextResponse.json({ error: 'profileId is required' }, { status: 400 })
  }
  if (!weekStart || typeof weekStart !== 'string') {
    return NextResponse.json({ error: 'weekStart is required (ISO date)' }, { status: 400 })
  }

  const start = new Date(weekStart)
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: 'weekStart is not a valid date' }, { status: 400 })
  }
  const end = new Date(start)
  end.setDate(end.getDate() + 7)

  const rows = await db.workout.findMany({
    where: {
      profileId,
      date: { gte: start, lt: end },
    },
    orderBy: { date: 'asc' },
  })

  const workouts: WeeklyWorkout[] = rows.map((w) => ({
    id: w.id,
    date: w.date,
    totalVolumeLb: w.totalVolumeLb,
    totalDurationMin: w.totalDurationMin,
    completed: w.completed,
    rpe: w.rpe,
  }))

  const review = generateWeeklyReview(workouts)
  return NextResponse.json({ review, workouts: workouts.length })
}
