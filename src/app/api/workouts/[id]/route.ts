import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return []
  }
}

/** GET /api/workouts/[id] — fetch a single workout. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workout = await db.workout.findUnique({ where: { id }, include: { profile: true } })
  if (!workout) {
    return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
  }
  return NextResponse.json({
    workout: { ...workout, blocks: safeParse(workout.blocksJson) },
  })
}

/**
 * PATCH /api/workouts/[id] — mark completed, set RPE.
 * Body: { completed?: boolean, rpe?: number }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const existing = await db.workout.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (typeof body.completed === 'boolean') data.completed = body.completed
  if (body.rpe != null) {
    const n = Number(body.rpe)
    if (Number.isFinite(n) && n >= 1 && n <= 10) data.rpe = Math.round(n)
  }

  const workout = await db.workout.update({ where: { id }, data })
  return NextResponse.json({
    workout: { ...workout, blocks: safeParse(workout.blocksJson) },
  })
}
