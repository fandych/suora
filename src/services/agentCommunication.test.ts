import { beforeEach, describe, expect, it, vi } from 'vitest'
import { delegateToAgent } from './agentCommunication'
import { generateResponse, initializeProvider, streamResponseWithTools } from './aiService'
import { buildSystemPrompt, getSkillSystemPrompts, getToolsForAgent, mergeSkillsWithBuiltins, readLiveStoreState } from './tools'

vi.mock('./aiService', () => ({
  initializeProvider: vi.fn(),
  generateResponse: vi.fn(),
  streamResponseWithTools: vi.fn(),
}))

vi.mock('./tools', () => ({
  getToolsForAgent: vi.fn(),
  getSkillSystemPrompts: vi.fn(),
  mergeSkillsWithBuiltins: vi.fn((skills) => skills),
  readLiveStoreState: vi.fn(),
  buildSystemPrompt: vi.fn(() => 'delegation system prompt'),
}))

describe('agentCommunication', () => {
  beforeEach(() => {
    vi.mocked(initializeProvider).mockReset()
    vi.mocked(generateResponse).mockReset()
    vi.mocked(streamResponseWithTools).mockReset()
    vi.mocked(getToolsForAgent).mockReset()
    vi.mocked(getSkillSystemPrompts).mockReset()
    vi.mocked(mergeSkillsWithBuiltins).mockClear()
    vi.mocked(readLiveStoreState).mockReset()
    vi.mocked(buildSystemPrompt).mockClear()
  })

  it('rethrows aborts from delegated model calls and forwards the abort signal', async () => {
    const controller = new AbortController()
    const abortError = new DOMException('The operation was aborted.', 'AbortError')

    vi.mocked(readLiveStoreState).mockReturnValue({
      agents: [
        {
          id: 'agent-source',
          name: 'Source Agent',
          systemPrompt: 'Source prompt',
          modelId: 'openai:test-model',
          skills: [],
          enabled: true,
        },
        {
          id: 'agent-target',
          name: 'Target Agent',
          systemPrompt: 'Target prompt',
          modelId: 'openai:test-model',
          skills: [],
          enabled: true,
        },
      ],
      models: [
        {
          id: 'openai:test-model',
          name: 'GPT Test',
          provider: 'openai',
          providerType: 'openai',
          modelId: 'test-model',
          apiKey: 'sk-test',
          enabled: true,
        },
      ],
      selectedModel: null,
      skills: [],
      providerConfigs: [],
    })
    vi.mocked(getToolsForAgent).mockReturnValue({})
    vi.mocked(getSkillSystemPrompts).mockResolvedValue('')
    vi.mocked(generateResponse).mockRejectedValueOnce(abortError)

    await expect(delegateToAgent(
      'agent-source',
      'agent-target',
      'Summarize the release notes',
      'Focus on breaking changes',
      { abortSignal: controller.signal },
    )).rejects.toMatchObject({ name: 'AbortError' })

    expect(generateResponse).toHaveBeenCalledWith(
      'openai:test-model',
      [{ role: 'user', content: 'Context: Focus on breaking changes\n\nTask: Summarize the release notes' }],
      'delegation system prompt',
      undefined,
      undefined,
      undefined,
      undefined,
      controller.signal,
    )
  })
})