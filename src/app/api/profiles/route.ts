import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'

/** GET /api/profiles — list all profiles. */
export async function GET() {
  const profiles = await db.userProfile.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ profiles })
}

/** POST /api/profiles — create a profile. */
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    name,
    goals,
    equipment,
    timePerSessionMin,
    daysPerWeek,
    recoveryState,
    experienceLevel,
  } = body ?? {}

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (!goals || typeof goals !== 'string') {
    return NextResponse.json({ error: 'goals is required' }, { status: 400 })
  }
  if (!equipment || typeof equipment !== 'string') {
    return NextResponse.json({ error: 'equipment is required' }, { status: 400 })
  }
  const tpsm = Number(timePerSessionMin)
  if (!Number.isFinite(tpsm) || tpsm < 10 || tpsm > 240) {
    return NextResponse.json({ error: 'timePerSessionMin must be 10-240' }, { status: 400 })
  }
  const dpw = Number(daysPerWeek)
  if (!Number.isFinite(dpw) || dpw < 1 || dpw > 7) {
    return NextResponse.json({ error: 'daysPerWeek must be 1-7' }, { status: 400 })
  }

  const profile = await db.userProfile.create({
    data: {
      name,
      goals,
      equipment,
      timePerSessionMin: tpsm,
      daysPerWeek: dpw,
      recoveryState: recoveryState ?? 'fresh',
      experienceLevel: experienceLevel ?? 'intermediate',
    },
  })
  return NextResponse.json({ profile }, { status: 201 })
}
