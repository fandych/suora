import type { ChannelDetail, ChannelRuntimeState } from "@/data/domain/channel-models"

export function appendChannelDebug(detail: ChannelDetail, tone: "info" | "success" | "error", text: string, timestamp: number) {
  return [{ id: crypto.randomUUID(), timestamp, tone, text }, ...detail.runtime.debugLog].slice(0, 300)
}

export function mergeChannelDebugLogEntries(current: ChannelRuntimeState["debugLog"], incoming: ChannelRuntimeState["debugLog"]) {
  const merged = [...incoming, ...current]
  const seen = new Set<string>()
  return merged.filter((entry) => {
    if (seen.has(entry.id)) return false
    seen.add(entry.id)
    return true
  }).slice(0, 300)
}

export function formatWeChatPersonalDiagnostic(result: {
  status?: string
  upstreamStatus?: string
  diagnosticEvent?: string
  diagnosticMessage?: string
  pollBaseUrl?: string
  pollEndpoint?: string
}) {
  return [
    `status=${result.status || "unknown"}`,
    `upstreamStatus=${result.upstreamStatus || "unknown"}`,
    `event=${result.diagnosticEvent || "unknown"}`,
    `baseUrl=${result.pollBaseUrl || "unknown"}`,
    `endpoint=${result.pollEndpoint || "unknown"}`,
    `message=${result.diagnosticMessage || "none"}`,
  ].join(" | ")
}