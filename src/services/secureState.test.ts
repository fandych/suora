import { describe, expect, it, vi } from 'vitest'
import type { ElectronBridge } from './secureState'
import {
  prepareModelsDataForSave,
  prepareSensitiveDataForSave,
  restoreModelsDataAfterLoad,
  restoreSensitiveDataAfterLoad,
} from './secureState'

describe('secureState', () => {
  it('encrypts provider and model secrets before writing and restores them on read', async () => {
    const invoke = vi.fn(async (channel: string, ...args: unknown[]) => {
      const [value] = args as [string?]
      if (channel === 'safe-storage:isAvailable') return true
      if (channel === 'safe-storage:encrypt') {
        return { data: Buffer.from(value ?? '', 'utf-8').toString('base64') }
      }
      if (channel === 'safe-storage:decrypt') {
        return { data: Buffer.from(value ?? '', 'base64').toString('utf-8') }
      }
      return undefined
    })

    const electron = { invoke } satisfies ElectronBridge
    const rawModelsData = {
      providerConfigs: [
        {
          id: 'openai',
          name: 'OpenAI',
          apiKey: 'sk-provider',
          baseUrl: 'https://api.example.com/v1',
          providerType: 'openai',
          models: [{ modelId: 'gpt-4.1', name: 'GPT-4.1', enabled: true }],
        },
      ],
      models: [
        {
          id: 'openai:gpt-4.1',
          name: 'GPT-4.1',
          provider: 'openai',
          providerType: 'openai',
          modelId: 'gpt-4.1',
          apiKey: 'sk-provider',
          enabled: true,
        },
      ],
      selectedModel: {
        id: 'openai:gpt-4.1',
        name: 'GPT-4.1',
        provider: 'openai',
        providerType: 'openai',
        modelId: 'gpt-4.1',
        apiKey: 'sk-provider',
        enabled: true,
      },
      apiKeys: { openai: 'sk-user' },
    }

    const encryptedModelsData = await prepareModelsDataForSave(electron, rawModelsData)

    expect(encryptedModelsData.providerConfigs).toEqual([
      expect.objectContaining({ id: 'openai', apiKey: '' }),
    ])
    expect(encryptedModelsData.models).toEqual([
      expect.not.objectContaining({ apiKey: 'sk-provider' }),
    ])
    expect(encryptedModelsData.selectedModel).toEqual(
      expect.not.objectContaining({ apiKey: 'sk-provider' }),
    )
    expect(encryptedModelsData.apiKeys).toEqual({})
    expect(encryptedModelsData.encryptedSecrets).toEqual(expect.any(String))

    const restoredModelsData = await restoreModelsDataAfterLoad(
      electron,
      encryptedModelsData,
    )

    expect(restoredModelsData.providerConfigs).toEqual(rawModelsData.providerConfigs)
    expect(restoredModelsData.models).toEqual(rawModelsData.models)
    expect(restoredModelsData.selectedModel).toEqual(rawModelsData.selectedModel)
    expect(restoredModelsData.apiKeys).toEqual(rawModelsData.apiKeys)
  })

  it('refuses to persist plaintext secrets when safe storage is unavailable', async () => {
    // Security guarantee: even if the platform cannot encrypt, we must NEVER
    // write plaintext API keys to disk. prepareModelsDataForSave should strip
    // the keys and emit a warning so callers know secrets stayed in memory.
    const warnings: unknown[] = []
    const originalAddEventListener = window.addEventListener
    const listener = (event: Event) => warnings.push((event as CustomEvent).detail)
    window.addEventListener('suora:secure-storage-warning', listener)

    const electron = {
      invoke: vi.fn(async (channel: string) => channel === 'safe-storage:isAvailable' ? false : undefined),
    } satisfies ElectronBridge

    const rawModelsData = {
      providerConfigs: [
        {
          id: 'openai',
          name: 'OpenAI',
          apiKey: 'sk-provider',
          baseUrl: '',
          providerType: 'openai',
          models: [],
        },
      ],
      apiKeys: { openai: 'sk-user' },
    }

    const result = await prepareModelsDataForSave(electron, rawModelsData)

    // Keys stripped from the object about to be written.
    expect((result.providerConfigs as Array<{ apiKey: string }>)[0].apiKey).toBe('')
    expect(result.apiKeys).toEqual({})
    // No encrypted blob written either (secure storage was unavailable).
    expect(result.encryptedSecrets).toBeUndefined()
    // A warning was emitted so the UI can surface the problem.
    expect(warnings).toContainEqual({ reason: 'unavailable' })

    window.removeEventListener('suora:secure-storage-warning', listener)
    // Guard against leaking our test listener if the suite grows.
    void originalAddEventListener
  })

  it('encrypts generic sensitive settings and restores them on load', async () => {
    const invoke = vi.fn(async (channel: string, ...args: unknown[]) => {
      const [value] = args as [string?]
      if (channel === 'safe-storage:isAvailable') return true
      if (channel === 'safe-storage:encrypt') {
        return { data: Buffer.from(value ?? '', 'utf-8').toString('base64') }
      }
      if (channel === 'safe-storage:decrypt') {
        return { data: Buffer.from(value ?? '', 'base64').toString('utf-8') }
      }
      return undefined
    })

    const electron = { invoke } satisfies ElectronBridge
    const rawSettings = {
      emailConfig: {
        smtpHost: 'smtp.example.com',
        username: 'user@example.com',
        password: 'smtp-password',
      },
      envVariables: [
        { key: 'DB_PASSWORD', value: 'secret-db-pass', secret: true },
        { key: 'APP_MODE', value: 'development', secret: false },
      ],
    }

    const encryptedSettings = await prepareSensitiveDataForSave(electron, rawSettings)

    expect((encryptedSettings.emailConfig as { password: string }).password).toBe('')
    expect((encryptedSettings.envVariables as Array<{ value: string }>)[0].value).toBe('')
    expect((encryptedSettings.envVariables as Array<{ value: string }>)[1].value).toBe('development')
    expect(encryptedSettings._encryptedSecrets).toEqual(expect.any(String))

    const restoredSettings = await restoreSensitiveDataAfterLoad(electron, encryptedSettings)
    expect(restoredSettings).toMatchObject(rawSettings)
  })
})
