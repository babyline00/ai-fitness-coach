import { test, expect, describe, beforeEach } from 'bun:test'
import { EXERCISES } from '../exercise-data'
import {
  MockProvider,
  __setChatProviderForTest,
  getChatProvider,
} from '../ai'
import { buildFormCheckPrompt, parseFormCheckResponse } from '../form-check'

const squat = EXERCISES.find((e) => e.id === 'back-squat')!

describe('ai MockProvider', () => {
  beforeEach(() => {
    __setChatProviderForTest(new MockProvider())
  })

  test('chat() returns deterministic workout suggestion that includes the goal', async () => {
    const p = getChatProvider()
    const out = await p.chat({
      systemPrompt: 'You are a fitness coach.',
      messages: [{ role: 'user', content: 'Suggest a workout for goal: strength' }],
    })
    const obj = JSON.parse(out)
    expect(obj.focus).toBe('strength')
    expect(obj.suggestion).toContain('Mock workout suggestion')
  })

  test('chat() returns different focus when goal changes', async () => {
    const p = getChatProvider()
    const out = await p.chat({
      systemPrompt: 'You are a fitness coach.',
      messages: [{ role: 'user', content: 'Suggest a workout for goal: endurance' }],
    })
    const obj = JSON.parse(out)
    expect(obj.focus).toBe('endurance')
  })

  test('vision() returns a deterministic form-check JSON with rating "good"', async () => {
    const p = getChatProvider()
    const prompt = buildFormCheckPrompt(squat, 'rep 3 of 5')
    const out = await p.vision({ prompt, mediaBase64: 'data:image/jpeg;base64,xxx' })
    const obj = JSON.parse(out)
    expect(obj.rating).toBe('good')
    expect(obj.errorsDetected).toEqual([])
    expect(obj.formDescription).toMatch(/looks good/i)
  })

  test('vision() formDescription mentions the exercise name', async () => {
    const p = getChatProvider()
    const prompt = buildFormCheckPrompt(squat)
    const out = await p.vision({ prompt, mediaBase64: 'data:image/jpeg;base64,xxx' })
    const obj = JSON.parse(out)
    expect(obj.formDescription).toContain('Back Squat')
  })

  test('vision() output is parseable by parseFormCheckResponse', async () => {
    const p = getChatProvider()
    const prompt = buildFormCheckPrompt(squat)
    const out = await p.vision({ prompt, mediaBase64: 'data:image/jpeg;base64,xxx' })
    const r = parseFormCheckResponse(out)
    expect(['good', 'needs_work', 'poor']).toContain(r.rating)
    expect(r.errorsDetected).toEqual([])
  })

  test('chat() output is stable across two calls with the same input', async () => {
    const p = getChatProvider()
    const args = {
      systemPrompt: 'You are a fitness coach.',
      messages: [{ role: 'user', content: 'Suggest a workout for goal: hypertrophy' }],
    }
    const a = await p.chat(args)
    const b = await p.chat(args)
    expect(a).toBe(b)
  })

  test('vision() output is stable across two calls with the same input', async () => {
    const p = getChatProvider()
    const args = {
      prompt: buildFormCheckPrompt(squat),
      mediaBase64: 'data:image/jpeg;base64,xxx',
    }
    const a = await p.vision(args)
    const b = await p.vision(args)
    expect(a).toBe(b)
  })

  test('PKC_DISABLE_LLM=1 makes getChatProvider return a MockProvider', () => {
    const prev = process.env.PKC_DISABLE_LLM
    process.env.PKC_DISABLE_LLM = '1'
    __setChatProviderForTest(null)
    const p = getChatProvider()
    expect(p).toBeInstanceOf(MockProvider)
    process.env.PKC_DISABLE_LLM = prev
    __setChatProviderForTest(null)
  })

  test('vision() handles exercises with no cues gracefully', async () => {
    const bench = EXERCISES.find((e) => e.id === 'bench-press')!
    const p = getChatProvider()
    const prompt = buildFormCheckPrompt(bench)
    const out = await p.vision({ prompt, mediaBase64: 'data:image/jpeg;base64,xxx' })
    const obj = JSON.parse(out)
    expect(obj.rating).toBe('good')
    expect(Array.isArray(obj.cues)).toBe(true)
  })
})
