import type { Model, ProviderConfig } from '@/types'

export type ElectronBridge = {
  invoke: (ch: string, ...args: unknown[]) => Promise<unknown>
}

interface SecureModelsSecrets {
  version: number
  providerApiKeys: Record<string, string>
  apiKeys: Record<string, string>
}

const SECURE_MODELS_VERSION = 1

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  return Object.values(value).every((entry) => typeof entry === 'string')
}

function cloneProviderConfigs(providerConfigs: ProviderConfig[]): ProviderConfig[] {
  return providerConfigs.map((providerConfig) => ({
    ...providerConfig,
    models: providerConfig.models.map((model) => ({ ...model })),
  }))
}

function readProviderConfigs(parsed: Record<string, unknown>): ProviderConfig[] {
  if (Array.isArray(parsed.providerConfigs)) return cloneProviderConfigs(parsed.providerConfigs as ProviderConfig[])
  if (Array.isArray(parsed.providers)) return cloneProviderConfigs(parsed.providers as ProviderConfig[])
  return []
}

function stripModelApiKey(model: Model): Model {
  if (!model.apiKey) return { ...model }

  const { apiKey: _apiKey, ...rest } = model
  return { ...rest }
}

function restoreModelApiKey(
  model: Model,
  providerConfigs: ProviderConfig[],
  apiKeys: Record<string, string>,
): Model {
  const providerApiKey = providerConfigs.find((providerConfig) => providerConfig.id === model.provider)?.apiKey
  const apiKey = providerApiKey || apiKeys[model.provider]

  return apiKey ? { ...model, apiKey } : { ...model }
}

async function isSecureStorageAvailable(electron: ElectronBridge): Promise<boolean> {
  try {
    return (await electron.invoke('safe-storage:isAvailable')) === true
  } catch {
    return false
  }
}

async function encryptSecrets(
  electron: ElectronBridge,
  secrets: SecureModelsSecrets,
): Promise<string | null> {
  const result = (await electron.invoke(
    'safe-storage:encrypt',
    JSON.stringify(secrets),
  )) as { data?: string; error?: string }

  return typeof result.data === 'string' && !result.error ? result.data : null
}

async function decryptSecrets(
  electron: ElectronBridge,
  encryptedSecrets: string,
): Promise<SecureModelsSecrets | null> {
  const result = (await electron.invoke('safe-storage:decrypt', encryptedSecrets)) as {
    data?: string
    error?: string
  }

  if (typeof result.data !== 'string' || result.error) return null

  try {
    const parsed = JSON.parse(result.data) as Partial<SecureModelsSecrets>
    return {
      version: typeof parsed.version === 'number' ? parsed.version : SECURE_MODELS_VERSION,
      providerApiKeys: isStringRecord(parsed.providerApiKeys) ? parsed.providerApiKeys : {},
      apiKeys: isStringRecord(parsed.apiKeys) ? parsed.apiKeys : {},
    }
  } catch {
    return null
  }
}

/**
 * Emit a user-visible warning that secure storage is unavailable.
 * Components can listen for this event to render a banner / toast.
 */
function emitSecureStorageWarning(reason: 'unavailable' | 'encryption-failed'): void {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('suora:secure-storage-warning', { detail: { reason } }),
      )
    }
  } catch {
    // best-effort only
  }
}

export async function prepareModelsDataForSave(
  electron: ElectronBridge,
  parsed: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const providerConfigs = readProviderConfigs(parsed)
  const apiKeys = isStringRecord(parsed.apiKeys) ? parsed.apiKeys : {}
  const providerApiKeys = Object.fromEntries(
    providerConfigs
      .filter((providerConfig) => providerConfig.apiKey.trim().length > 0)
      .map((providerConfig) => [providerConfig.id, providerConfig.apiKey]),
  )

  const hasSecrets = Object.keys(providerApiKeys).length > 0 || Object.keys(apiKeys).length > 0

  // Always strip apiKey fields before any possible persistence path.
  // This guarantees that even if encryption fails / is unavailable, the
  // resulting JSON never contains plaintext API keys.
  const nextParsed: Record<string, unknown> = {
    ...parsed,
    providerConfigs: providerConfigs.map((providerConfig) => ({ ...providerConfig, apiKey: '' })),
    apiKeys: {},
  }

  if (Array.isArray(parsed.providers)) {
    nextParsed.providers = nextParsed.providerConfigs
  }

  if (Array.isArray(parsed.models)) {
    nextParsed.models = (parsed.models as Model[]).map(stripModelApiKey)
  }

  if (parsed.selectedModel && typeof parsed.selectedModel === 'object') {
    nextParsed.selectedModel = stripModelApiKey(parsed.selectedModel as Model)
  }

  delete nextParsed.encryptedSecrets
  delete nextParsed.encryptionVersion

  // No secrets to persist — return stripped copy.
  if (!hasSecrets) {
    return nextParsed
  }

  // Secrets present: require safeStorage. If unavailable, REFUSE to persist
  // the plaintext — emit a warning and return the stripped object so keys
  // remain in memory only for this session.
  if (!(await isSecureStorageAvailable(electron))) {
    emitSecureStorageWarning('unavailable')
    return nextParsed
  }

  const encryptedSecrets = await encryptSecrets(electron, {
    version: SECURE_MODELS_VERSION,
    providerApiKeys,
    apiKeys,
  })

  if (!encryptedSecrets) {
    // Encryption itself failed — still refuse plaintext persistence.
    emitSecureStorageWarning('encryption-failed')
    return nextParsed
  }

  nextParsed.encryptedSecrets = encryptedSecrets
  nextParsed.encryptionVersion = SECURE_MODELS_VERSION
  return nextParsed
}

export async function restoreModelsDataAfterLoad(
  electron: ElectronBridge,
  parsed: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const providerConfigs = readProviderConfigs(parsed)
  let restoredProviderConfigs = providerConfigs
  let restoredApiKeys = isStringRecord(parsed.apiKeys) ? parsed.apiKeys : {}

  if (typeof parsed.encryptedSecrets === 'string' && parsed.encryptedSecrets.length > 0) {
    const decryptedSecrets = await decryptSecrets(electron, parsed.encryptedSecrets)

    if (decryptedSecrets) {
      restoredProviderConfigs = providerConfigs.map((providerConfig) => ({
        ...providerConfig,
        apiKey: decryptedSecrets.providerApiKeys[providerConfig.id] ?? providerConfig.apiKey,
      }))
      restoredApiKeys = {
        ...restoredApiKeys,
        ...decryptedSecrets.apiKeys,
      }
    }
  }

  const nextParsed: Record<string, unknown> = {
    ...parsed,
    providerConfigs: restoredProviderConfigs,
    apiKeys: restoredApiKeys,
  }

  if (Array.isArray(parsed.providers)) {
    nextParsed.providers = restoredProviderConfigs
  }

  if (Array.isArray(parsed.models)) {
    nextParsed.models = (parsed.models as Model[]).map((model) => restoreModelApiKey(model, restoredProviderConfigs, restoredApiKeys))
  }

  if (parsed.selectedModel && typeof parsed.selectedModel === 'object') {
    nextParsed.selectedModel = restoreModelApiKey(
      parsed.selectedModel as Model,
      restoredProviderConfigs,
      restoredApiKeys,
    )
  }

  delete nextParsed.encryptedSecrets
  delete nextParsed.encryptionVersion

  return nextParsed
}
