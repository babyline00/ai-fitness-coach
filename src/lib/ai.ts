/**
 * AI providers for the AI-Powered Fitness Coach. Adapted from the parent
 * project's `ai.ts` ChatProvider pattern — extended with a `vision` method
 * for the form-check feature.
 *
 * Two implementations:
 *   - ZaiProvider  — uses `zai.chat.completions.create` and `createVision`.
 *   - MockProvider — deterministic offline fallback used in tests and when no
 *                    SDK config is available (PKC_DISABLE_LLM=1).
 *
 * The unit tests in `ai.test.ts` drive the MockProvider end-to-end and assert
 * that form-check + workout-suggestion outputs are deterministic.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatProvider {
  /** Non-streaming chat completion. Returns the assistant message text. */
  chat(args: { systemPrompt: string; messages: ChatMessage[] }): Promise<string>
  /**
   * Vision completion for the form-check feature. `prompt` is the textual
   * form-check prompt; `mediaBase64` is the base64-encoded video/image; the
   * provider decides whether to actually wire the media into the request.
   */
  vision(args: { prompt: string; mediaBase64: string; mimeType?: string }): Promise<string>
}

let cachedProvider: ChatProvider | null = null

class ZaiProvider implements ChatProvider {
  async chat(args: { systemPrompt: string; messages: ChatMessage[] }): Promise<string> {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: args.systemPrompt },
        ...args.messages,
      ],
      stream: false,
      thinking: { type: 'disabled' },
    })
    if (typeof completion === 'string') return completion
    const content = (completion as any)?.choices?.[0]?.message?.content
    return typeof content === 'string' ? content : ''
  }

  async vision(args: { prompt: string; mediaBase64: string; mimeType?: string }): Promise<string> {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()
    const dataUrl = args.mediaBase64
      ? args.mediaBase64.startsWith('data:')
        ? args.mediaBase64
        : `data:${args.mimeType ?? 'image/jpeg'};base64,${args.mediaBase64}`
      : ''
    const userContent = dataUrl
      ? [
          { type: 'text', text: args.prompt },
          { type: 'image_url', image_url: { url: dataUrl } },
        ]
      : args.prompt
    try {
      const completion = await (zai as any).chat.completions.createVision({
        messages: [
          {
            role: 'user',
            content: userContent,
          },
        ],
      })
      if (typeof completion === 'string') return completion
      const content = (completion as any)?.choices?.[0]?.message?.content
      return typeof content === 'string' ? content : ''
    } catch {
      // createVision may not be available on every model — fall through to chat.
      return this.chat({
        systemPrompt: 'You are an expert strength coach.',
        messages: [{ role: 'user', content: args.prompt }],
      })
    }
  }
}

class MockProvider implements ChatProvider {
  async chat(args: { systemPrompt: string; messages: ChatMessage[] }): Promise<string> {
    const lastUser = [...args.messages].reverse().find((m) => m.role === 'user')
    const text = (lastUser?.content ?? '').trim()
    // Deterministic workout suggestion: extract the goal from the prompt.
    const goalMatch = text.match(/goal[:\s]+(strength|hypertrophy|endurance|weight_loss|general_fitness)/i)
    const goal = goalMatch ? goalMatch[1].toLowerCase() : 'general_fitness'
    return JSON.stringify({
      suggestion: `Mock workout suggestion for goal="${goal}"`,
      focus: goal,
      notes: 'No live LLM configured — this is a deterministic mock used by tests.',
    })
  }

  async vision(args: { prompt: string; mediaBase64: string; mimeType?: string }): Promise<string> {
    // Try to detect the exercise name in the prompt and pick its first cue.
    const nameMatch = args.prompt.match(/the exercise "([^"]+)"/i)
    const name = nameMatch ? nameMatch[1] : 'the exercise'
    const cueMatch = args.prompt.match(/Coaching cues the user should focus on:\s*([\s\S]*?)\n\n/i)
    const firstCue = cueMatch
      ? cueMatch[1].split('\n').map((s) => s.replace(/^-\s*/, '').trim())[0] ?? 'keep chest tall'
      : 'keep chest tall'
    // Deterministic mock form-check verdict.
    return JSON.stringify({
      formDescription: `Mock vision analysis for ${name}. Form looks good — ${firstCue}.`,
      errorsDetected: [],
      cues: [firstCue],
      rating: 'good',
    })
  }
}

export function getChatProvider(): ChatProvider {
  if (cachedProvider) return cachedProvider
  if (process.env.PKC_DISABLE_LLM === '1') {
    cachedProvider = new MockProvider()
    return cachedProvider
  }
  try {
    cachedProvider = new ZaiProvider()
  } catch (e) {
    console.warn('[ai] ZaiProvider unavailable, using MockProvider:', (e as Error).message)
    cachedProvider = new MockProvider()
  }
  return cachedProvider
}

/** Test-only: inject a custom provider (e.g. MockProvider) for unit tests. */
export function __setChatProviderForTest(p: ChatProvider | null) {
  cachedProvider = p
}

export { MockProvider, ZaiProvider }
