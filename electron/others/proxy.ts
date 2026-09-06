import { HttpProxyAgent } from "http-proxy-agent"
import { HttpsProxyAgent } from "https-proxy-agent"

import { appState } from "@electron/others/app-state"
import type { ProxySettings } from "@electron/types"

export function getProxySettings() {
  return appState.currentProxySettings
}

export function setProxySettings(settings: ProxySettings) {
  appState.currentProxySettings = settings
}

function getProxyUrl(settings: ProxySettings) {
  const auth = settings.username
    ? `${encodeURIComponent(settings.username)}:${encodeURIComponent(settings.password ?? "")}@`
    : ""
  return `${settings.type}://${auth}${settings.host}:${settings.port}`
}

export function getProxyAgent(targetUrl: URL, ignoreSsl = false) {
  const settings = appState.currentProxySettings
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
