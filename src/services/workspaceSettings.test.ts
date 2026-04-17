import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProviderConfig } from '@/types'
import { loadWorkspaceSettings, saveWorkspaceSettings } from './workspaceSettings'

const providerConfigs: ProviderConfig[] = [
  {
    id: 'provider-1',
    name: 'OpenAI',
    apiKey: 'sk-test',
    baseUrl: 'https://api.example.com/v1',
    providerType: 'openai',
    models: [{ modelId: 'gpt-test', name: 'GPT Test', enabled: true }],
  },
]

describe('workspaceSettings', () => {
  const invoke = vi.fn()

  function encodeSecrets(payload: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64')
  }

  function getWritePayload(filePath: string): Record<string, unknown> {
    const call = invoke.mock.calls.find(
      ([channel, targetPath]) => channel === 'fs:writeFile' && targetPath === filePath,
    )
    expect(call).toBeDefined()
    return JSON.parse(call?.[2] as string) as Record<string, unknown>
  }

  beforeEach(() => {
    invoke.mockReset()
    global.window.electron.invoke = invoke
  })

  it('should load provider configs from encrypted models.json', async () => {
    invoke.mockImplementation(async (channel: string, filePath: string) => {
      if (channel === 'fs:readFile' && filePath === 'C:/workspace/models.json') {
        return JSON.stringify({
          providerConfigs: [{ ...providerConfigs[0], apiKey: '' }],
          encryptedSecrets: encodeSecrets({
            version: 1,
            providerApiKeys: { 'provider-1': 'sk-test' },
            apiKeys: {},
          }),
        })
      }
      if (channel === 'fs:readFile' && filePath === 'C:/workspace/settings.json') {
        return JSON.stringify({ externalDirectories: [{ path: '~/.claude/skills', enabled: true, type: 'skills' }] })
      }
      if (channel === 'safe-storage:decrypt') {
        return { data: Buffer.from(String(filePath), 'base64').toString('utf-8') }
      }
      return undefined
    })

    const result = await loadWorkspaceSettings('C:/workspace')

    expect(result.providers).toEqual(providerConfigs)
    expect(result.externalDirectories).toEqual([{ path: '~/.claude/skills', enabled: true, type: 'skills' }])
  })

  it('should migrate legacy providers from settings.json when models.json is missing', async () => {
    invoke.mockImplementation(async (channel: string, filePath: string) => {
      if (channel === 'fs:readFile' && filePath === 'C:/workspace/models.json') {
        return { error: 'ENOENT' }
      }
      if (channel === 'fs:readFile' && filePath === 'C:/workspace/settings.json') {
        return JSON.stringify({
          providers: providerConfigs,
          externalDirectories: [{ path: '~/.claude/skills', enabled: true, type: 'skills' }],
        })
      }
      if (channel === 'safe-storage:isAvailable') {
        return true
      }
      if (channel === 'safe-storage:encrypt') {
        return { data: Buffer.from(String(filePath ?? ''), 'utf-8').toString('base64') }
      }
      if (channel === 'fs:writeFile') {
        return { filePath }
      }
      return undefined
    })

    const result = await loadWorkspaceSettings('C:/workspace')

    expect(result.providers).toEqual(providerConfigs)
    const modelsPayload = getWritePayload('C:/workspace/models.json')
    expect(modelsPayload.providerConfigs).toEqual([{ ...providerConfigs[0], apiKey: '' }])
    expect(modelsPayload.encryptedSecrets).toEqual(expect.any(String))
    expect(invoke).toHaveBeenCalledWith(
      'fs:writeFile',
      'C:/workspace/settings.json',
      JSON.stringify({ externalDirectories: [{ path: '~/.claude/skills', enabled: true, type: 'skills' }] }, null, 2),
    )
  })

  it('should migrate legacy providers from store data when workspace files do not contain them', async () => {
    invoke.mockImplementation(async (channel: string, firstArg: string) => {
      if (channel === 'fs:readFile' && firstArg === 'C:/workspace/models.json') {
        return JSON.stringify({ providerConfigs: [] })
      }
      if (channel === 'fs:readFile' && firstArg === 'C:/workspace/settings.json') {
        return JSON.stringify({ externalDirectories: [{ path: '~/.claude/skills', enabled: true, type: 'skills' }] })
      }
      if (channel === 'store:load' && firstArg === 'providers') {
        return JSON.stringify({ providerConfigs })
      }
      if (channel === 'safe-storage:isAvailable') {
        return true
      }
      if (channel === 'safe-storage:encrypt') {
        return { data: Buffer.from(String(firstArg ?? ''), 'utf-8').toString('base64') }
      }
      if (channel === 'fs:writeFile') {
        return { firstArg }
      }
      return undefined
    })

    const result = await loadWorkspaceSettings('C:/workspace')

    expect(result.providers).toEqual(providerConfigs)
    expect(result.externalDirectories).toEqual([{ path: '~/.claude/skills', enabled: true, type: 'skills' }])
    const modelsPayload = getWritePayload('C:/workspace/models.json')
    expect(modelsPayload.providerConfigs).toEqual([{ ...providerConfigs[0], apiKey: '' }])
    expect(modelsPayload.encryptedSecrets).toEqual(expect.any(String))
  })

  it('should remove legacy provider keys when saving settings.json', async () => {
    invoke.mockImplementation(async (channel: string, filePath: string) => {
      if (channel === 'fs:readFile' && filePath === 'C:/workspace/models.json') {
        return JSON.stringify({ selectedModel: null })
      }
      if (channel === 'fs:readFile' && filePath === 'C:/workspace/settings.json') {
        return JSON.stringify({
          providers: providerConfigs,
          providerConfigs,
          externalDirectories: [{ path: '~/.old', enabled: false, type: 'skills' }],
          theme: 'dark',
        })
      }
      if (channel === 'safe-storage:isAvailable') {
        return true
      }
      if (channel === 'safe-storage:encrypt') {
        return { data: Buffer.from(String(filePath ?? ''), 'utf-8').toString('base64') }
      }
      return { success: true }
    })

    const result = await saveWorkspaceSettings('C:/workspace', {
      providers: providerConfigs,
      externalDirectories: [{ path: '~/.claude/skills', enabled: true, type: 'skills' }],
    })

    expect(result).toBe(true)
    const modelsPayload = getWritePayload('C:/workspace/models.json')
    expect(modelsPayload.providerConfigs).toEqual([{ ...providerConfigs[0], apiKey: '' }])
    expect(modelsPayload.encryptedSecrets).toEqual(expect.any(String))
    expect(invoke).toHaveBeenCalledWith(
      'fs:writeFile',
      'C:/workspace/settings.json',
      JSON.stringify({
        externalDirectories: [{ path: '~/.claude/skills', enabled: true, type: 'skills' }],
        theme: 'dark',
      }, null, 2),
    )
  })
})