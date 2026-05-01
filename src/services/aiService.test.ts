import { beforeEach, describe, it, expect, vi } from 'vitest'
import { streamText, stepCountIs } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { validateModelConfig, initializeProvider, streamResponseWithTools } from './aiService'

// Mock AI SDK modules
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => vi.fn()),
}))
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn()),
}))
vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: vi.fn(() => vi.fn()),
}))
vi.mock('ai', () => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
  stepCountIs: vi.fn(() => ({})),
}))

describe('aiService', () => {
  beforeEach(() => {
    vi.mocked(streamText).mockReset()
    vi.mocked(stepCountIs).mockClear()
    vi.mocked(createAnthropic).mockClear()
    vi.mocked(createOpenAI).mockClear()
    vi.mocked(createOpenAICompatible).mockClear()
    vi.mocked(window.electron.invoke).mockClear()
    vi.mocked(window.electron.on).mockClear()
    vi.mocked(window.electron.off).mockClear()
  })

  describe('validateModelConfig', () => {
    it('should validate complete config', () => {
      const result = validateModelConfig({
        provider: 'anthropic',
        providerType: 'anthropic',
        modelId: 'claude-3-opus',
        apiKey: 'sk-test',
      })
      expect(result.valid).toBe(true)
    })

    it('should reject missing provider', () => {
      const result = validateModelConfig({ providerType: 'anthropic', modelId: 'model', apiKey: 'key' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Provider')
    })

    it('should reject missing providerType', () => {
      const result = validateModelConfig({ provider: 'p', modelId: 'model', apiKey: 'key' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Provider type')
    })

    it('should reject missing modelId', () => {
      const result = validateModelConfig({ provider: 'p', providerType: 'openai', apiKey: 'key' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Model ID')
    })

    it('should reject missing API key for non-ollama', () => {
      const result = validateModelConfig({ provider: 'p', providerType: 'openai', modelId: 'gpt-4' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('API key')
    })

    it('should allow missing API key for ollama', () => {
      const result = validateModelConfig({ provider: 'p', providerType: 'ollama', modelId: 'llama3' })
      expect(result.valid).toBe(true)
    })
  })

  describe('initializeProvider', () => {
    it('should initialize anthropic provider', () => {
      expect(() => initializeProvider('anthropic', 'sk-test')).not.toThrow()
    })

    it('should initialize openai provider', () => {
      expect(() => initializeProvider('openai', 'sk-test')).not.toThrow()
    })

    it('should initialize ollama without API key', () => {
      expect(() => initializeProvider('ollama', '')).not.toThrow()
    })

    it('should throw for non-ollama without API key', () => {
      expect(() => initializeProvider('anthropic', '')).toThrow(/API key is required/)
    })

    it('should initialize all supported provider types', () => {
      const providers = ['deepseek', 'zhipu', 'minimax', 'groq', 'together', 'fireworks', 'perplexity', 'cohere']
      for (const p of providers) {
        expect(() => initializeProvider(p, 'test-key', undefined, `test-${p}`)).not.toThrow()
      }
    })

    it('should initialize google provider', () => {
      expect(() => initializeProvider('google', 'test-key')).not.toThrow()
    })

    it('should initialize openai-compatible provider', () => {
      expect(() => initializeProvider('openai-compatible', 'test-key', 'https://api.example.com')).not.toThrow()

      expect(createOpenAICompatible).toHaveBeenLastCalledWith(expect.objectContaining({
        baseURL: 'https://api.example.com',
        includeUsage: true,
      }))
    })

    it('injects the Electron AI fetch bridge into provider instances when available', async () => {
      const listeners = new Set<(...args: unknown[]) => void>()

      vi.mocked(window.electron.on).mockImplementation((_channel, listener) => {
        listeners.add(listener)
      })
      vi.mocked(window.electron.off).mockImplementation((_channel, listener) => {
        listeners.delete(listener)
      })
      vi.mocked(window.electron.invoke).mockImplementation(async (channel, ...args) => {
        if (channel === 'ai:fetch:start') {
          const payload = args[0] as { method?: string; url?: string; bodyText?: string }
          expect(payload.method).toBe('POST')
          expect(payload.url).toBe('https://api.example.com/chat/completions')
          expect(payload.bodyText).toContain('"model":"qwen-test"')

          setTimeout(() => {
            for (const listener of listeners) {
              listener({}, {
                requestId: 'req-1',
                type: 'response',
                status: 200,
                statusText: 'OK',
                headers: { 'content-type': 'application/json' },
              })
              listener({}, {
                requestId: 'req-1',
                type: 'data',
                chunkBase64: btoa('{"ok":true}'),
              })
              listener({}, {
                requestId: 'req-1',
                type: 'end',
              })
            }
          }, 0)

          return { requestId: 'req-1' }
        }

        if (channel === 'ai:fetch:abort') {
          return { success: true }
        }

        return undefined
      })

      initializeProvider('openai-compatible', 'test-key', 'https://api.example.com', 'provider-fetch-test')

      const options = vi.mocked(createOpenAICompatible).mock.calls.at(-1)?.[0] as { fetch?: typeof fetch; includeUsage?: boolean }
      expect(options.fetch).toBeTypeOf('function')
      expect(options.includeUsage).toBe(true)

      const response = await options.fetch?.('https://api.example.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'qwen-test' }),
      })

      expect(await response?.json()).toEqual({ ok: true })
      expect(window.electron.invoke).toHaveBeenCalledWith('ai:fetch:start', expect.objectContaining({
        url: 'https://api.example.com/chat/completions',
        method: 'POST',
      }))
    })
  })

  describe('streamResponseWithTools', () => {
    it('resolves Ollama providers initialized without an API key', async () => {
      vi.mocked(streamText).mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: 'text-delta' as const, text: 'local' }
        })(),
      } as never)

      initializeProvider('ollama', '', undefined, 'ollama')

      const events = []
      for await (const event of streamResponseWithTools(
        'ollama:llama3',
        [{ role: 'user', content: 'hello' }],
        { providerType: 'ollama' },
      )) {
        events.push(event)
      }

      expect(events).toContainEqual({ type: 'text-delta', text: 'local' })
    })

    it('should clamp tool-enabled maxSteps to at least 2', async () => {
      vi.mocked(streamText).mockReturnValueOnce({
        fullStream: (async function* () {
          yield {
            type: 'text-delta' as const,
            text: 'done',
          }
          yield {
            type: 'finish-step' as const,
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 1 },
          }
        })(),
      } as never)

      initializeProvider('openai', 'sk-test')

      for await (const _event of streamResponseWithTools(
        'openai:test-model',
        [{ role: 'user', content: 'hello' }],
        {
          tools: { inspect: {} } as never,
          maxSteps: 1,
        }
      )) {
        // drain stream
      }

      expect(stepCountIs).toHaveBeenCalledWith(2)
    })

    it('should safely serialize circular tool results', async () => {
      const circular: Record<string, unknown> = { ok: true }
      circular.self = circular

      vi.mocked(streamText).mockReturnValueOnce({
        fullStream: (async function* () {
          yield {
            type: 'tool-call' as const,
            toolCallId: 'tool-1',
            toolName: 'inspect',
            input: { target: 'value' },
          }
          yield {
            type: 'tool-result' as const,
            toolCallId: 'tool-1',
            toolName: 'inspect',
            output: circular,
          }
          yield {
            type: 'finish-step' as const,
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 2 },
          }
        })(),
      } as never)

      initializeProvider('openai', 'sk-test')

      const events = []
      for await (const event of streamResponseWithTools('openai:test-model', [{ role: 'user', content: 'hello' }])) {
        events.push(event)
      }

      const toolResult = events.find((event) => event.type === 'tool-result')
      expect(toolResult && toolResult.type === 'tool-result' ? toolResult.output : '').toContain('[Circular]')
    })

    it('uses provider-reported total token counts when they differ from input plus output', async () => {
      vi.mocked(streamText).mockReturnValueOnce({
        fullStream: (async function* () {
          yield { type: 'text-delta' as const, text: 'done' }
          yield {
            type: 'finish-step' as const,
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 99, raw: { total_tokens: 77 } },
          }
        })(),
        totalUsage: Promise.resolve({ inputTokens: 10, outputTokens: 5, totalTokens: 99, raw: { total_tokens: 77 } }),
      } as never)

      initializeProvider('openai', 'sk-test')

      const events = []
      for await (const event of streamResponseWithTools('openai:usage-model', [{ role: 'user', content: 'hello' }])) {
        events.push(event)
      }

      expect(events).toContainEqual({ type: 'usage', promptTokens: 10, completionTokens: 5, totalTokens: 77 })
    })

    it('should surface thrown stream failures as error events', async () => {
      vi.mocked(streamText).mockReturnValueOnce({
        fullStream: (async function* () {
          yield {
            type: 'text-delta' as const,
            text: 'partial',
          }
          throw new Error('network dropped')
        })(),
        totalUsage: Promise.reject(new Error('usage unavailable')),
        text: Promise.resolve('partial'),
      } as never)

      initializeProvider('openai', 'sk-test')

      const events = []
      for await (const event of streamResponseWithTools('openai:test-model', [{ role: 'user', content: 'hello' }])) {
        events.push(event)
      }

      expect(events).toContainEqual({ type: 'text-delta', text: 'partial' })
      expect(events).toContainEqual({ type: 'error', error: 'network dropped' })
    })
  })
})
