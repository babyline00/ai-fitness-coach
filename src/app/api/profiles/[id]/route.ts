import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'

/** PATCH /api/profiles/[id] — update a profile. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const existing = await db.userProfile.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  for (const key of ['name', 'goals', 'equipment', 'recoveryState', 'experienceLevel']) {
    if (typeof body[key] === 'string') data[key] = body[key]
  }
  for (const key of ['timePerSessionMin', 'daysPerWeek']) {
    if (body[key] != null) {
      const n = Number(body[key])
      if (Number.isFinite(n)) data[key] = n
    }
  }

  const profile = await db.userProfile.update({ where: { id }, data })
  return NextResponse.json({ profile })
}

/** GET /api/profiles/[id] — fetch a single profile. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await db.userProfile.findUnique({ where: { id } })
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }
  return NextResponse.json({ profile })
}
