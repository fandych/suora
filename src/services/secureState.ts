import type { Model, ProviderConfig } from '@/types'
import { safeParse, safeStringify } from '@/utils/safeJson'

export type ElectronBridge = {
  invoke: (ch: string, ...args: unknown[]) => Promise<unknown>
}

interface SecureModelsSecrets {
  version: number
  providerApiKeys: Record<string, string>
  apiKeys: Record<string, string>
}

interface SecurePathSecrets {
  version: number
  values: Record<string, string>
}

const SECURE_MODELS_VERSION = 1
const SECURE_PATH_SECRETS_VERSION = 1
const SENSITIVE_KEY_PATTERN = /(?:api[-_]?key|password|passphrase|token|secret|access[-_]?token|refresh[-_]?token|client[-_]?secret|app[-_]?secret|bot[-_]?token|webhook[-_]?secret|signing[-_]?secret|auth[-_]?token)$/i
const ENCRYPTION_METADATA_KEYS = new Set(['encryptedSecrets', 'encryptionVersion', '_encryptedSecrets', '_encryptionVersion'])

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
    safeStringify(secrets),
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
    const parsed = safeParse<Partial<SecureModelsSecrets>>(result.data)
    return {
      version: typeof parsed.version === 'number' ? parsed.version : SECURE_MODELS_VERSION,
      providerApiKeys: isStringRecord(parsed.providerApiKeys) ? parsed.providerApiKeys : {},
      apiKeys: isStringRecord(parsed.apiKeys) ? parsed.apiKeys : {},
    }
  } catch {
    return null
  }
}

async function encryptPathSecrets(
  electron: ElectronBridge,
  secrets: SecurePathSecrets,
): Promise<string | null> {
  const result = (await electron.invoke(
    'safe-storage:encrypt',
    safeStringify(secrets),
  )) as { data?: string; error?: string }

  return typeof result.data === 'string' && !result.error ? result.data : null
}

async function decryptPathSecrets(
  electron: ElectronBridge,
  encryptedSecrets: string,
): Promise<SecurePathSecrets | null> {
  const result = (await electron.invoke('safe-storage:decrypt', encryptedSecrets)) as {
    data?: string
    error?: string
  }

  if (typeof result.data !== 'string' || result.error) return null

  try {
    const parsed = safeParse<Partial<SecurePathSecrets>>(result.data)
    return {
      version: typeof parsed.version === 'number' ? parsed.version : SECURE_PATH_SECRETS_VERSION,
      values: isStringRecord(parsed.values) ? parsed.values : {},
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

function shouldProtectValue(key: string, value: unknown, parent: Record<string, unknown> | null): value is string {
  if (typeof value !== 'string' || value.length === 0) return false
  if (ENCRYPTION_METADATA_KEYS.has(key)) return false
  if (SENSITIVE_KEY_PATTERN.test(key)) return true
  return key === 'value' && parent?.secret === true
}

function stripSensitiveValues(
  value: unknown,
  path: string,
  secrets: Record<string, string>,
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry, index) => stripSensitiveValues(entry, `${path}/${index}`, secrets))
  }

  if (!value || typeof value !== 'object') return value

  const source = value as Record<string, unknown>
  const copy: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(source)) {
    const entryPath = `${path}/${key}`
    if (shouldProtectValue(key, entry, source)) {
      secrets[entryPath] = entry
      copy[key] = ''
      continue
    }
    copy[key] = stripSensitiveValues(entry, entryPath, secrets)
  }
  return copy
}

function restoreSensitiveValues(value: unknown, path: string, secrets: Record<string, string>): unknown {
  if (Array.isArray(value)) {
    return value.map((entry, index) => restoreSensitiveValues(entry, `${path}/${index}`, secrets))
  }

  if (!value || typeof value !== 'object') return value

  const copy: Record<string, unknown> = { ...(value as Record<string, unknown>) }
  for (const key of Object.keys(copy)) {
    const entryPath = `${path}/${key}`
    if (Object.prototype.hasOwnProperty.call(secrets, entryPath)) {
      copy[key] = secrets[entryPath]
    } else {
      copy[key] = restoreSensitiveValues(copy[key], entryPath, secrets)
    }
  }
  return copy
}

export async function prepareSensitiveDataForSave(
  electron: ElectronBridge,
  parsed: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const secrets: Record<string, string> = {}
  const stripped = stripSensitiveValues(parsed, '', secrets) as Record<string, unknown>
  delete stripped._encryptedSecrets
  delete stripped._encryptionVersion

  if (Object.keys(secrets).length === 0) return stripped

  if (!(await isSecureStorageAvailable(electron))) {
    emitSecureStorageWarning('unavailable')
    return stripped
  }

  const encryptedSecrets = await encryptPathSecrets(electron, {
    version: SECURE_PATH_SECRETS_VERSION,
    values: secrets,
  })

  if (!encryptedSecrets) {
    emitSecureStorageWarning('encryption-failed')
    return stripped
  }

  stripped._encryptedSecrets = encryptedSecrets
  stripped._encryptionVersion = SECURE_PATH_SECRETS_VERSION
  return stripped
}

export async function restoreSensitiveDataAfterLoad(
  electron: ElectronBridge,
  parsed: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (typeof parsed._encryptedSecrets !== 'string' || parsed._encryptedSecrets.length === 0) {
    const copy = { ...parsed }
    delete copy._encryptedSecrets
    delete copy._encryptionVersion
    return copy
  }

  const decrypted = await decryptPathSecrets(electron, parsed._encryptedSecrets)
  const copy = { ...parsed }
  delete copy._encryptedSecrets
  delete copy._encryptionVersion
  if (!decrypted) return copy
  return restoreSensitiveValues(copy, '', decrypted.values) as Record<string, unknown>
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
