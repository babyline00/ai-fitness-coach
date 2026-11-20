import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'

/** GET /api/workouts — list workouts. Filters: ?profileId=&completed= */
export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const profileId = url.searchParams.get('profileId') ?? undefined
  const completedParam = url.searchParams.get('completed')
  let completed: boolean | undefined
  if (completedParam === 'true') completed = true
  if (completedParam === 'false') completed = false

  const workouts = await db.workout.findMany({
    where: {
      ...(profileId ? { profileId } : {}),
      ...(completed !== undefined ? { completed } : {}),
    },
    orderBy: { date: 'desc' },
  })

  // Hydrate blocksJson back into objects for the frontend.
  const hydrated = workouts.map((w) => ({
    ...w,
    blocks: safeParse(w.blocksJson),
  }))

  return NextResponse.json({ workouts: hydrated })
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return []
  }
}
