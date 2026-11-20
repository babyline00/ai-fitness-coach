import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getExerciseById } from '@/lib/exercise-data'
import {
  buildFormCheckPrompt,
  parseFormCheckResponse,
  serializeFormCheckResult,
  mockFormCheck,
} from '@/lib/form-check'
import { getChatProvider } from '@/lib/ai'

/**
 * POST /api/form-check
 * multipart/form-data:
 *   - file: video/image (optional, but expected)
 *   - exerciseName: string (required)
 *   - workoutId: string (optional)
 *   - mediaDescription: string (optional)
 *
 * Mock analysis OR LLM vision call. Persist as FormCheck. Return the result.
 */
export async function POST(req: NextRequest) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const exerciseName = String(form.get('exerciseName') ?? '')
  const workoutIdRaw = form.get('workoutId')
  const workoutId = workoutIdRaw ? String(workoutIdRaw) : null
  const mediaDescriptionRaw = form.get('mediaDescription')
  const mediaDescription = mediaDescriptionRaw ? String(mediaDescriptionRaw) : undefined
  const file = form.get('file') as File | null

  if (!exerciseName) {
    return NextResponse.json({ error: 'exerciseName is required' }, { status: 400 })
  }

  // Look up the exercise by name (case-insensitive) to get its cues + common errors.
  const exercise = getExerciseById(exerciseName.toLowerCase().replace(/\s+/g, '-')) ??
    EXERCISES_BY_NAME.get(exerciseName.toLowerCase())

  if (!exercise) {
    return NextResponse.json(
      { error: `Unknown exercise "${exerciseName}" — cannot build a form-check prompt.` },
      { status: 400 },
    )
  }

  let mediaBase64: string | null = null
  let mimeType: string | undefined
  if (file && typeof file === 'object' && 'arrayBuffer' in file) {
    try {
      const buf = await file.arrayBuffer()
      const bytes = new Uint8Array(buf)
      // base64 encode
      let binary = ''
      const chunk = 0x8000
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
      }
      mediaBase64 = btoa(binary)
      mimeType = file.type || 'image/jpeg'
    } catch {
      mediaBase64 = null
    }
  }

  // Build the prompt and ask the vision provider.
  const prompt = buildFormCheckPrompt(exercise, mediaDescription)
  let result
  let analysisText: string
  try {
    const provider = getChatProvider()
    const raw = await provider.vision({ prompt, mediaBase64: mediaBase64 ?? '', mimeType })
    result = parseFormCheckResponse(raw)
    analysisText = serializeFormCheckResult(result)
  } catch {
    result = mockFormCheck(exercise)
    analysisText = serializeFormCheckResult(result)
  }

  const row = await db.formCheck.create({
    data: {
      workoutId,
      exerciseName,
      mediaPath: file?.name ?? null,
      analysis: analysisText,
      errorsDetected: result.errorsDetected.join('; '),
    },
  })

  return NextResponse.json(
    {
      formCheck: row,
      result,
    },
    { status: 201 },
  )
}

// Quick lookup table by exact lowercase name.
import { EXERCISES } from '@/lib/exercise-data'
const EXERCISES_BY_NAME = new Map(EXERCISES.map((e) => [e.name.toLowerCase(), e]))
