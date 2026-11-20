import { test, expect, describe } from 'bun:test'
import { EXERCISES } from '../exercise-data'
import {
  buildFormCheckPrompt,
  parseFormCheckResponse,
  mockFormCheck,
  serializeFormCheckResult,
  runFormCheck,
} from '../form-check'

const squat = EXERCISES.find((e) => e.id === 'back-squat')!

describe('form-check', () => {
  test('buildFormCheckPrompt includes the exercise name', () => {
    const p = buildFormCheckPrompt(squat)
    expect(p).toContain('Back Squat')
  })

  test('buildFormCheckPrompt includes the common form errors', () => {
    const p = buildFormCheckPrompt(squat)
    expect(p).toContain('knees caving in')
  })

  test('buildFormCheckPrompt includes the coaching cues', () => {
    const p = buildFormCheckPrompt(squat)
    expect(p).toContain('keep chest tall')
  })

  test('buildFormCheckPrompt includes the step-by-step instructions', () => {
    const p = buildFormCheckPrompt(squat)
    expect(p).toContain('1.')
    expect(p).toContain('Unrack')
  })

  test('buildFormCheckPrompt requests a JSON response with the exact shape', () => {
    const p = buildFormCheckPrompt(squat)
    expect(p).toContain('"formDescription"')
    expect(p).toContain('"errorsDetected"')
    expect(p).toContain('"cues"')
    expect(p).toContain('"rating"')
  })

  test('buildFormCheckPrompt includes an optional media description when provided', () => {
    const p = buildFormCheckPrompt(squat, 'User is on rep 3 of 5, knees wobble on the way up.')
    expect(p).toContain('knees wobble')
  })

  test('parseFormCheckResponse extracts a clean JSON object', () => {
    const text = JSON.stringify({
      formDescription: 'Good depth, chest tall.',
      errorsDetected: ['slight knee cave'],
      cues: ['drive knees out'],
      rating: 'needs_work',
    })
    const r = parseFormCheckResponse(text)
    expect(r.rating).toBe('needs_work')
    expect(r.errorsDetected).toEqual(['slight knee cave'])
    expect(r.formDescription).toBe('Good depth, chest tall.')
  })

  test('parseFormCheckResponse handles ```json fenced blocks', () => {
    const text = '```json\n{"formDescription":"ok","errorsDetected":[],"cues":[],"rating":"good"}\n```'
    const r = parseFormCheckResponse(text)
    expect(r.rating).toBe('good')
    expect(r.errorsDetected).toEqual([])
  })

  test('parseFormCheckResponse tolerates extra prose around JSON', () => {
    const text = 'Sure! Here is the analysis:\n{"formDescription":"ok","errorsDetected":["x"],"cues":["y"],"rating":"poor"}\nHope this helps!'
    const r = parseFormCheckResponse(text)
    expect(r.rating).toBe('poor')
    expect(r.errorsDetected).toEqual(['x'])
  })

  test('parseFormCheckResponse falls back gracefully on invalid JSON', () => {
    const r = parseFormCheckResponse('not json at all')
    expect(r.rating).toBe('needs_work')
    expect(r.errorsDetected).toEqual([])
  })

  test('parseFormCheckResponse clamps unknown ratings to needs_work', () => {
    const text = JSON.stringify({
      formDescription: 'ok',
      errorsDetected: [],
      cues: [],
      rating: 'excellent',
    })
    const r = parseFormCheckResponse(text)
    expect(r.rating).toBe('needs_work')
  })

  test('mockFormCheck returns the canonical "looks good" string', () => {
    const r = mockFormCheck(squat)
    expect(r.rating).toBe('good')
    expect(r.formDescription).toMatch(/looks good/i)
  })

  test('serializeFormCheckResult builds a human-readable block', () => {
    const r = mockFormCheck(squat)
    const s = serializeFormCheckResult(r)
    expect(s).toContain('Rating: good')
    expect(s).toContain('Errors: none')
  })

  test('runFormCheck falls back to mock when no media and no description', async () => {
    const r = await runFormCheck({ exercise: squat })
    expect(r.rating).toBe('good')
  })

  test('runFormCheck uses the injected callVision when provided', async () => {
    const r = await runFormCheck({
      exercise: squat,
      mediaBase64: 'data:image/jpeg;base64,xxx',
      mediaDescription: 'rep 3 of 5',
      callVision: async (prompt) => {
        expect(prompt).toContain('Back Squat')
        return JSON.stringify({
          formDescription: 'Knees tracking well.',
          errorsDetected: [],
          cues: ['keep chest tall'],
          rating: 'good',
        })
      },
    })
    expect(r.rating).toBe('good')
    expect(r.formDescription).toBe('Knees tracking well.')
  })

  test('runFormCheck falls back to mock when the vision call throws', async () => {
    const r = await runFormCheck({
      exercise: squat,
      mediaBase64: 'data:image/jpeg;base64,xxx',
      callVision: async () => {
        throw new Error('network down')
      },
    })
    expect(r.rating).toBe('good')
    expect(r.formDescription).toMatch(/looks good/i)
  })
})
