import { eq } from "drizzle-orm"

import { executePersistedMutation, getDatabaseContext } from "@/data/db/client"
import { appMeta } from "@/data/db/schema"

export type ChatModelConfig = {
  providerId: string
  providerType: "ollama" | "openai" | "anthropic" | "openai-compatible" | "google"
  modelId: string
  baseUrl: string
  apiKey: string
  systemPrompt: string
}

export type ProxyConfig = {
  enabled: boolean
  type: "http" | "https" | "socks5"
  host: string
  port: number
  username: string
  password: string
  rejectUnauthorized: boolean
  ignoreSslErrors: boolean
}

export type ChatRuntimeSettings = {
  model: ChatModelConfig
  proxy: ProxyConfig
}

const DEFAULT_SETTINGS: ChatRuntimeSettings = {
  model: {
    providerId: "provider-ollama",
    providerType: "ollama",
    modelId: "llama3.1",
    baseUrl: "http://localhost:11434/v1",
    apiKey: "",
    systemPrompt: "You are SUORA, a desktop AI workbench assistant. Use tools when they help answer grounded workspace questions.",
  },
  proxy: {
    enabled: false,
    type: "http",
    host: "",
    port: 0,
    username: "",
    password: "",
    rejectUnauthorized: true,
    ignoreSslErrors: false,
  },
}

function parseSettings(value?: string | null): ChatRuntimeSettings {
  if (!value) {
    return DEFAULT_SETTINGS
  }

  try {
    const parsed = JSON.parse(value) as Partial<ChatRuntimeSettings>
    return {
      model: { ...DEFAULT_SETTINGS.model, ...(parsed.model ?? {}) },
      proxy: { ...DEFAULT_SETTINGS.proxy, ...(parsed.proxy ?? {}) },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function getChatRuntimeSettings() {
  const context = await getDatabaseContext()
  const row = (await context.db.select().from(appMeta).where(eq(appMeta.key, "chat_runtime_settings")).all())[0]
  return parseSettings(row?.value)
}

export async function saveChatRuntimeSettings(settings: ChatRuntimeSettings) {
  const sanitized: ChatRuntimeSettings = {
    model: {
      ...settings.model,
      providerId: settings.model.providerId.trim() || settings.model.providerType,
      modelId: settings.model.modelId.trim(),
      baseUrl: settings.model.baseUrl.trim(),
      apiKey: settings.model.apiKey,
      systemPrompt: settings.model.systemPrompt.trim(),
    },
    proxy: {
      ...settings.proxy,
      host: settings.proxy.host.trim(),
      username: settings.proxy.username.trim(),
      password: settings.proxy.password,
      port: Number.isFinite(settings.proxy.port) ? settings.proxy.port : 0,
    },
  }

  await executePersistedMutation(async ({ db }) => {
    await db.insert(appMeta)
      .values({ key: "chat_runtime_settings", value: JSON.stringify(sanitized) })
      .onConflictDoUpdate({ target: appMeta.key, set: { value: JSON.stringify(sanitized) } })
      .run()
  })

  await window.electron?.invoke("workspace:setProxySettings", sanitized.proxy)
  return sanitized
}