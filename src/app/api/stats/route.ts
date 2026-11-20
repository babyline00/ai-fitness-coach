import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/** GET /api/stats — { profiles, workouts, completed, formChecks } */
export async function GET() {
  const [profiles, workouts, completed, formChecks] = await Promise.all([
    db.userProfile.count(),
    db.workout.count(),
    db.workout.count({ where: { completed: true } }),
    db.formCheck.count(),
  ])
  return NextResponse.json({ profiles, workouts, completed, formChecks })
}
