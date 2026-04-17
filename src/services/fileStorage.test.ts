import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fileStateStorage } from './fileStorage'

describe('fileStateStorage', () => {
  async function flushAsyncWork(): Promise<void> {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  }

  beforeEach(() => {
    vi.mocked(window.electron.invoke).mockReset()
    vi.mocked(window.electron.invoke).mockImplementation(async (channel: string, ...args: unknown[]) => {
      const [value] = args as [string?]
      if (channel === 'safe-storage:isAvailable') return true
      if (channel === 'safe-storage:encrypt') {
        return { data: Buffer.from(value ?? '', 'utf-8').toString('base64') }
      }
      return { success: true }
    })
  })

  it('should persist agent and skill metadata into settings.json while keeping model secrets encrypted on disk', async () => {
    fileStateStorage.setItem('suora-store', JSON.stringify({
      version: 16,
      state: {
        workspacePath: 'C:/workspace',
        providerConfigs: [{
          id: 'provider-1',
          name: 'OpenAI',
          apiKey: 'sk-provider',
          baseUrl: 'https://api.example.com/v1',
          providerType: 'openai',
          models: [{ modelId: 'gpt-4.1', name: 'GPT 4.1', enabled: true }],
        }],
        models: [{
          id: 'provider-1:gpt-4.1',
          name: 'GPT 4.1',
          provider: 'provider-1',
          providerType: 'openai',
          modelId: 'gpt-4.1',
          apiKey: 'sk-provider',
          enabled: true,
        }],
        selectedModel: {
          id: 'provider-1:gpt-4.1',
          name: 'GPT 4.1',
          provider: 'provider-1',
          providerType: 'openai',
          modelId: 'gpt-4.1',
          apiKey: 'sk-provider',
          enabled: true,
        },
        apiKeys: { 'provider-1': 'sk-user' },
        channels: [],
        channelMessages: [],
        channelTokens: {},
        channelHealth: {},
        channelUsers: {},
        agents: [],
        selectedAgent: null,
        skills: [],
        sessions: [],
        agentVersions: [{ id: 'av-1', agentId: 'agent-1', version: 1, snapshot: { name: 'Agent 1' }, createdAt: 1 }],
        agentPerformance: { 'agent-1': { agentId: 'agent-1', totalCalls: 2, totalTokens: 20, avgResponseTimeMs: 100, responseTimes: [100], lastUsed: 1, errorCount: 0 } },
        agentPipeline: [{ agentId: 'agent-1', task: 'Draft task' }],
        skillVersions: [{ id: 'sv-1', skillId: 'skill-1', version: 1, snapshot: { name: 'Skill 1' }, createdAt: 1 }],
        pluginTools: { 'plugin-1': ['tool_a'] },
      },
    }))

    await flushAsyncWork()

    const settingsWrite = vi.mocked(window.electron.invoke).mock.calls.find(
      ([channel, filePath]) => channel === 'fs:writeFile' && filePath === 'C:/workspace/settings.json',
    )
    const modelsWrite = vi.mocked(window.electron.invoke).mock.calls.find(
      ([channel, filePath]) => channel === 'fs:writeFile' && filePath === 'C:/workspace/models.json',
    )

    expect(settingsWrite).toBeDefined()
    expect(modelsWrite).toBeDefined()

    const settingsJson = settingsWrite?.[2]
    const modelsJson = modelsWrite?.[2]
    expect(typeof settingsJson).toBe('string')
    expect(typeof modelsJson).toBe('string')

    const parsed = JSON.parse(settingsJson as string) as Record<string, unknown>
    const parsedModels = JSON.parse(modelsJson as string) as Record<string, unknown>
    expect(parsed.agentVersions).toEqual([{ id: 'av-1', agentId: 'agent-1', version: 1, snapshot: { name: 'Agent 1' }, createdAt: 1 }])
    expect(parsed.agentPerformance).toEqual({ 'agent-1': { agentId: 'agent-1', totalCalls: 2, totalTokens: 20, avgResponseTimeMs: 100, responseTimes: [100], lastUsed: 1, errorCount: 0 } })
    expect(parsed.agentPipeline).toEqual([{ agentId: 'agent-1', task: 'Draft task' }])
    expect(parsed.skillVersions).toEqual([{ id: 'sv-1', skillId: 'skill-1', version: 1, snapshot: { name: 'Skill 1' }, createdAt: 1 }])
    expect(parsed.pluginTools).toEqual({ 'plugin-1': ['tool_a'] })

    expect(parsedModels.providerConfigs).toEqual([
      expect.objectContaining({ id: 'provider-1', apiKey: '' }),
    ])
    expect(parsedModels.models).toEqual([
      expect.not.objectContaining({ apiKey: 'sk-provider' }),
    ])
    expect(parsedModels.selectedModel).toEqual(
      expect.not.objectContaining({ apiKey: 'sk-provider' }),
    )
    expect(parsedModels.apiKeys).toEqual({})
    expect(parsedModels.encryptedSecrets).toEqual(expect.any(String))
  })
})