import { hasAppBridge } from "@/services/bridge"
import type {
  EnvironmentToolStatus,
  SystemDiagnosticsSnapshot,
  SystemInfoSnapshot,
  UpdateCheckResult,
  UpdaterStateSnapshot,
} from "@/types/preference"

const fallbackInfo: SystemInfoSnapshot = {
  isDev: true,
  platform: typeof navigator === "undefined" ? "unknown" : navigator.platform,
  version: "web-preview",
  productName: "SUORA",
  electronVersion: "n/a",
  chromeVersion: typeof navigator === "undefined" ? "n/a" : navigator.userAgent,
  nodeVersion: "n/a",
}
const fallbackDiagnostics: SystemDiagnosticsSnapshot = {
  environment: (["nodejs", "npm", "python"] as const).map(
    (id) =>
      ({
        id,
        label: id === "nodejs" ? "Node.js" : id,
        command: id === "nodejs" ? "node" : id,
        installed: false,
        version: null,
        path: null,
        error: "Desktop runtime required.",
      }) satisfies EnvironmentToolStatus,
  ),
  runtime: {
    timestamp: Date.now(),
    processMemoryMb: 0,
    heapUsedMb: 0,
    totalMemoryGb: 0,
    freeMemoryGb: 0,
    uptimeSeconds: 0,
    cpuCount: 0,
    loadAverage: [0, 0, 0],
    pid: 0,
  },
}
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object"
const asString = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback)
const asNumber = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback

function sanitizeTool(value: unknown): EnvironmentToolStatus {
  if (!isObject(value))
    return {
      id: "nodejs",
      label: "Unknown",
      command: "unknown",
      installed: false,
      version: null,
      path: null,
      error: "Invalid diagnostic payload.",
    }
  const id = value.id === "npm" || value.id === "python" ? value.id : "nodejs"
  return {
    id,
    label: asString(value.label, id),
    command: asString(value.command, id),
    installed: Boolean(value.installed),
    version: typeof value.version === "string" ? value.version : null,
    path: typeof value.path === "string" ? value.path : null,
    error: typeof value.error === "string" ? value.error : null,
  }
}

function sanitizeDiagnostics(value: unknown): SystemDiagnosticsSnapshot {
  if (!isObject(value)) return fallbackDiagnostics
  const runtime = isObject(value.runtime) ? value.runtime : {}
  const loadAverage = Array.isArray(runtime.loadAverage)
    ? ([asNumber(runtime.loadAverage[0]), asNumber(runtime.loadAverage[1]), asNumber(runtime.loadAverage[2])] as [
        number,
        number,
        number,
      ])
    : ([0, 0, 0] as [number, number, number])
  return {
    environment: Array.isArray(value.environment)
      ? value.environment.map(sanitizeTool)
      : fallbackDiagnostics.environment,
    runtime: {
      timestamp: asNumber(runtime.timestamp, Date.now()),
      processMemoryMb: asNumber(runtime.processMemoryMb),
      heapUsedMb: asNumber(runtime.heapUsedMb),
      totalMemoryGb: asNumber(runtime.totalMemoryGb),
      freeMemoryGb: asNumber(runtime.freeMemoryGb),
      uptimeSeconds: asNumber(runtime.uptimeSeconds),
      cpuCount: asNumber(runtime.cpuCount),
      loadAverage,
      pid: asNumber(runtime.pid),
    },
  }
}

export async function getSystemInfo(): Promise<SystemInfoSnapshot> {
  if (!hasAppBridge()) return fallbackInfo
  const value = await window.app!.system.info()
  if (!isObject(value)) return fallbackInfo
  return {
    isDev: Boolean(value.isDev),
    platform: asString(value.platform, fallbackInfo.platform),
    version: asString(value.version, fallbackInfo.version),
    productName: asString(value.productName, fallbackInfo.productName),
    electronVersion: asString(value.electronVersion, fallbackInfo.electronVersion),
    chromeVersion: asString(value.chromeVersion, fallbackInfo.chromeVersion),
    nodeVersion: asString(value.nodeVersion, fallbackInfo.nodeVersion),
  }
}

export const getSystemDiagnostics = async () =>
  hasAppBridge() ? sanitizeDiagnostics(await window.app!.system.diagnostics()) : fallbackDiagnostics
export async function getUpdaterState(): Promise<UpdaterStateSnapshot> {
  const value = hasAppBridge() ? await window.app!.updater.getState() : null
  return isObject(value)
    ? { enabled: Boolean(value.enabled), channel: asString(value.channel, "latest") }
    : { enabled: false, channel: "latest" }
}
export const checkForUpdates = async (): Promise<UpdateCheckResult> =>
  hasAppBridge() ? window.app!.updater.check() : { skipped: true, reason: "bridge-unavailable" }
