/**
 * Form check (mocked). For MVP we don't run real MediaPipe pose estimation —
 * the user uploads a short video or image, and we ask the LLM vision endpoint
 * (`zai.chat.completions.createVision`) to describe the form and flag common
 * errors from the exercise's `commonFormErrors` list.
 *
 * If the LLM is unavailable (no SDK config, or `PKC_DISABLE_LLM=1`), we fall
 * back to a deterministic mock that returns "looks good, keep chest tall".
 *
 * The real MediaPipe path is documented in the README (stretch goal):
 *   1. Capture a short video in-browser.
 *   2. Run @tensorflow-models/pose-detection (MoveNet) or MediaPipe Pose on
 *      each frame to extract joint landmarks.
 *   3. Project landmarks against a per-exercise "form rule set" (e.g. for a
 *      squat: knee-over-toe angle, hip-crease-below-knee, neutral spine).
 *   4. Emit concrete violations + a corrected-rep animation.
 *
 * This file keeps the LLM-prompt parsing and the mock fallback in one place
 * so the API route can call `runFormCheck(exercise, mediaBase64?, mediaDescription?)`
 * and get a structured result back.
 */

import type { Exercise } from './exercise-data'

export interface FormCheckResult {
  formDescription: string
  errorsDetected: string[]
  cues: string[]
  rating: 'good' | 'needs_work' | 'poor'
}

/** Build the system+user prompt that asks the vision LLM to analyze the form. */
export function buildFormCheckPrompt(
  exercise: Exercise,
  mediaDescription?: string,
): string {
  const errorList = exercise.commonFormErrors.length
    ? exercise.commonFormErrors.map((e) => `- ${e}`).join('\n')
    : '- (no specific common errors documented for this exercise)'
  const cuesList = exercise.cues.map((c) => `- ${c}`).join('\n')
  const steps = exercise.instructions.map((s, i) => `${i + 1}. ${s}`).join('\n')

  return [
    `You are an expert strength coach reviewing a video or image of the exercise "${exercise.name}".`,
    `Category: ${exercise.category}. Target muscles: ${exercise.muscleGroups.join(', ')}.`,
    `Equipment: ${exercise.equipment}. Difficulty: ${exercise.difficulty}.`,
    '',
    'Proper execution steps:',
    steps,
    '',
    'Common form errors to look for:',
    errorList,
    '',
    'Coaching cues the user should focus on:',
    cuesList,
    '',
    mediaDescription
      ? `Viewer-provided description of the media: "${mediaDescription}"`
      : 'No additional description was provided — analyze what is visible.',
    '',
    'Respond ONLY with a single JSON object (no markdown, no prose) with this exact shape:',
    '{ "formDescription": string, "errorsDetected": string[], "cues": string[], "rating": "good" | "needs_work" | "poor" }',
    'Where "rating" is "good" if no errors, "needs_work" if 1-2 minor errors, "poor" if 3+ errors or a safety issue.',
  ].join('\n')
}

/**
 * Parse the LLM response text into a FormCheckResult. Tolerates JSON wrapped
 * in ```json fences, or with extra prose around the JSON object.
 */
export function parseFormCheckResponse(text: string): FormCheckResult {
  const fallback: FormCheckResult = {
    formDescription: text.trim().slice(0, 500),
    errorsDetected: [],
    cues: [],
    rating: 'needs_work',
  }

  if (!text || typeof text !== 'string') return fallback

  // Strip ```json ... ``` fences if present.
  let cleaned = text.trim()
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence && fence[1]) {
    cleaned = fence[1].trim()
  }

  // Find the first { ... } block.
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return fallback
  const jsonStr = cleaned.slice(start, end + 1)

  try {
    const obj = JSON.parse(jsonStr)
    return {
      formDescription: typeof obj.formDescription === 'string' ? obj.formDescription : '',
      errorsDetected: Array.isArray(obj.errorsDetected)
        ? obj.errorsDetected.filter((s: unknown) => typeof s === 'string')
        : [],
      cues: Array.isArray(obj.cues)
        ? obj.cues.filter((s: unknown) => typeof s === 'string')
        : [],
      rating:
        obj.rating === 'good' || obj.rating === 'needs_work' || obj.rating === 'poor'
          ? obj.rating
          : 'needs_work',
    }
  } catch {
    return fallback
  }
}

/**
 * Deterministic mock used when no LLM is configured. Returns the canonical
 * "looks good" string the spec calls out.
 */
export function mockFormCheck(exercise: Exercise): FormCheckResult {
  return {
    formDescription: `Form analysis available with a real vision model — this is a mock that returns 'looks good, keep ${exercise.cues[0]?.replace(/^keep\s+/, '').split(/\s+/)[0] ?? 'chest'} tall'.`,
    errorsDetected: [],
    cues: exercise.cues,
    rating: 'good',
  }
}

/**
 * Build a serialized "analysis" string for the FormCheck row. This is what
 * gets stored in DB and shown to the user as the assistant's verdict.
 */
export function serializeFormCheckResult(r: FormCheckResult): string {
  return [
    `Rating: ${r.rating}`,
    `Description: ${r.formDescription}`,
    r.errorsDetected.length ? `Errors: ${r.errorsDetected.join('; ')}` : 'Errors: none',
    r.cues.length ? `Cues: ${r.cues.join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Run the full form-check pipeline. If `mediaBase64` is provided AND the LLM
 * is available, we call the vision endpoint. Otherwise we fall back to mock.
 *
 * `mediaDescription` is optional plain text the user typed (e.g. "I'm doing
 *  the third set, feeling a bit wobbly"). It's appended to the prompt.
 */
export async function runFormCheck(args: {
  exercise: Exercise
  mediaBase64?: string | null
  mediaDescription?: string
  /** Injected for tests — defaults to the global ChatProvider. */
  callVision?: (prompt: string, mediaBase64: string) => Promise<string>
}): Promise<FormCheckResult> {
  const { exercise, mediaBase64 = null, mediaDescription } = args
  // If no media AND no description, we can only mock.
  if (!mediaBase64 && !mediaDescription) {
    return mockFormCheck(exercise)
  }

  const callVision =
    args.callVision ??
    (async (prompt: string, _media: string) => {
      // Fall back to mock — the real vision call is wired in the API route
      // where we have access to the SDK. Keeping this pure here keeps the
      // unit tests offline.
      void prompt
      void _media
      return JSON.stringify(mockFormCheck(exercise))
    })

  const prompt = buildFormCheckPrompt(exercise, mediaDescription)
  try {
    const raw = await callVision(prompt, mediaBase64 ?? '')
    if (!raw) return mockFormCheck(exercise)
    return parseFormCheckResponse(raw)
  } catch {
    return mockFormCheck(exercise)
  }
}
