import { HttpProxyAgent } from "http-proxy-agent"
import { HttpsProxyAgent } from "https-proxy-agent"

import { appState } from "@/electron/infrastructure/app-state"
import type { ProxySettings } from "@/types/electron"

function normalizeProxyHost(host?: string) {
  const normalized = typeof host === "string" ? host.trim() : ""
  if (!normalized || normalized === "undefined" || normalized === "null") {
    return ""
  }
  return normalized
}

export function normalizeProxySettings(settings?: Partial<ProxySettings> | null): ProxySettings {
  const host = normalizeProxyHost(settings?.host)
  const port =
    typeof settings?.port === "number" && Number.isFinite(settings.port) ? Math.max(0, Math.trunc(settings.port)) : 0
  const type = settings?.type === "https" || settings?.type === "socks5" ? settings.type : "http"

  return {
    enabled: Boolean(settings?.enabled) && host.length > 0 && port > 0,
    type,
    host,
    port,
    username: typeof settings?.username === "string" ? settings.username.trim() : "",
    password: typeof settings?.password === "string" ? settings.password : "",
    rejectUnauthorized: settings?.rejectUnauthorized ?? true,
    ignoreSslErrors: settings?.ignoreSslErrors ?? false,
  }
}

export function getProxySettings() {
  return normalizeProxySettings(appState.currentProxySettings)
}

export type ProxyAgentConfig = {
  type: "http" | "https"
  host: string
  port: number
  username?: string
  password?: string
}

export function setProxySettings(settings: ProxySettings) {
  appState.currentProxySettings = normalizeProxySettings(settings)
}

export function getProxyUrl(settings: ProxySettings) {
  const normalized = normalizeProxySettings(settings)
  const auth = normalized.username
    ? `${encodeURIComponent(normalized.username)}:${encodeURIComponent(normalized.password ?? "")}@`
    : ""
  return `${normalized.type}://${auth}${normalized.host}:${normalized.port}`
}

export function getProxyDisplayUrl(settings: ProxySettings) {
  const normalized = normalizeProxySettings(settings)
  const auth = normalized.username ? `${encodeURIComponent(normalized.username)}:***@` : ""
  return `${normalized.type}://${auth}${normalized.host}:${normalized.port}`
}

export function toProxyAgentConfig(settings: ProxySettings): ProxyAgentConfig | null {
  const normalized = normalizeProxySettings(settings)
  if (!normalized.enabled || !normalized.host || !normalized.port || normalized.type === "socks5") {
    return null
  }
  return {
    type: normalized.type,
    host: normalized.host,
    port: normalized.port,
    ...(normalized.username ? { username: normalized.username } : {}),
    ...(normalized.password ? { password: normalized.password } : {}),
  }
}

export function getProxyAgent(targetUrl: URL, ignoreSsl = false) {
  const settings = normalizeProxySettings(appState.currentProxySettings)
  if (!settings.enabled || !settings.host || !settings.port) {
    return undefined
  }

  if (settings.type === "socks5") {
    throw new Error("SOCKS5 proxy is not wired yet in this desktop shell.")
  }

  const proxyUrl = getProxyUrl(settings)
  return targetUrl.protocol === "https:"
    ? new HttpsProxyAgent(proxyUrl, { keepAlive: false, rejectUnauthorized: !ignoreSsl })
    : new HttpProxyAgent(proxyUrl)
}
