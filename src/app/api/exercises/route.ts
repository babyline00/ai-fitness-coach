import { NextResponse, type NextRequest } from 'next/server'
import { EXERCISES } from '@/lib/exercise-data'

/**
 * GET /api/exercises — list exercises.
 * Filters: ?category=&equipment=&muscleGroup=&difficulty=
 * (multiple values can be passed as repeated params or comma-separated)
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const categories = parseMulti(url.searchParams.get('category'))
  const equipment = parseMulti(url.searchParams.get('equipment'))
  const muscleGroups = parseMulti(url.searchParams.get('muscleGroup'))
  const difficulties = parseMulti(url.searchParams.get('difficulty'))

  let filtered = EXERCISES.slice()
  if (categories.length) {
    filtered = filtered.filter((e) => categories.includes(e.category))
  }
  if (equipment.length) {
    filtered = filtered.filter((e) => equipment.includes(e.equipment))
  }
  if (muscleGroups.length) {
    filtered = filtered.filter((e) =>
      e.muscleGroups.some((mg) => muscleGroups.some((q) => mg.toLowerCase().includes(q.toLowerCase()))),
    )
  }
  if (difficulties.length) {
    filtered = filtered.filter((e) => difficulties.includes(e.difficulty))
  }

  return NextResponse.json({ exercises: filtered, count: filtered.length })
}

function parseMulti(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}
