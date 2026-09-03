import { hasSuoraBridge, suoraIpc } from "@/lib/ipc"

export type SystemInfoSnapshot = {
  isDev: boolean
  platform: string
  version: string
  productName: string
  electronVersion: string
  chromeVersion: string
  nodeVersion: string
}

export type EnvironmentToolStatus = {
  id: "nodejs" | "npm" | "python"
  label: string
  command: string
  installed: boolean
  version: string | null
  path: string | null
  error: string | null
}

export type SystemDiagnosticsSnapshot = {
  environment: EnvironmentToolStatus[]
  runtime: {
    timestamp: number
    processMemoryMb: number
    heapUsedMb: number
    totalMemoryGb: number
    freeMemoryGb: number
    uptimeSeconds: number
    cpuCount: number
    loadAverage: [number, number, number]
    pid: number
  }
}

export type UpdaterStateSnapshot = {
  enabled: boolean
  channel: string
}

export type UpdateCheckResult = unknown

const BROWSER_FALLBACK_INFO: SystemInfoSnapshot = {
  isDev: true,
  platform: typeof navigator === "undefined" ? "unknown" : navigator.platform,
  version: "web-preview",
  productName: "SUORA",
  electronVersion: "n/a",
  chromeVersion: typeof navigator === "undefined" ? "n/a" : navigator.userAgent,
  nodeVersion: "n/a",
}

const BROWSER_FALLBACK_DIAGNOSTICS: SystemDiagnosticsSnapshot = {
  environment: [
    { id: "nodejs", label: "Node.js", command: "node", installed: false, version: null, path: null, error: "Desktop runtime required." },
    { id: "npm", label: "npm", command: "npm", installed: false, version: null, path: null, error: "Desktop runtime required." },
    { id: "python", label: "Python", command: "python", installed: false, version: null, path: null, error: "Desktop runtime required." },
  ],
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

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function sanitizeEnvironmentTool(value: unknown): EnvironmentToolStatus {
  if (!isObject(value)) {
    return { id: "nodejs", label: "Unknown", command: "unknown", installed: false, version: null, path: null, error: "Invalid diagnostic payload." }
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
  if (!isObject(value)) {
    return BROWSER_FALLBACK_DIAGNOSTICS
  }

  const runtime = isObject(value.runtime) ? value.runtime : {}
  const environment = Array.isArray(value.environment) ? value.environment.map(sanitizeEnvironmentTool) : BROWSER_FALLBACK_DIAGNOSTICS.environment

  return {
    environment,
    runtime: {
      timestamp: asNumber(runtime.timestamp, Date.now()),
      processMemoryMb: asNumber(runtime.processMemoryMb),
      heapUsedMb: asNumber(runtime.heapUsedMb),
      totalMemoryGb: asNumber(runtime.totalMemoryGb),
      freeMemoryGb: asNumber(runtime.freeMemoryGb),
      uptimeSeconds: asNumber(runtime.uptimeSeconds),
      cpuCount: asNumber(runtime.cpuCount),
      loadAverage: Array.isArray(runtime.loadAverage)
        ? [asNumber(runtime.loadAverage[0]), asNumber(runtime.loadAverage[1]), asNumber(runtime.loadAverage[2])] as [number, number, number]
        : [0, 0, 0],
      pid: asNumber(runtime.pid),
    },
  }
}

export async function getSystemInfo(): Promise<SystemInfoSnapshot> {
  if (!hasSuoraBridge()) {
    return BROWSER_FALLBACK_INFO
  }

  const value = await suoraIpc.system.info()
  if (!isObject(value)) {
    return BROWSER_FALLBACK_INFO
  }

  return {
    isDev: Boolean(value.isDev),
    platform: asString(value.platform, BROWSER_FALLBACK_INFO.platform),
    version: asString(value.version, BROWSER_FALLBACK_INFO.version),
    productName: asString(value.productName, BROWSER_FALLBACK_INFO.productName),
    electronVersion: asString(value.electronVersion, BROWSER_FALLBACK_INFO.electronVersion),
    chromeVersion: asString(value.chromeVersion, BROWSER_FALLBACK_INFO.chromeVersion),
    nodeVersion: asString(value.nodeVersion, BROWSER_FALLBACK_INFO.nodeVersion),
  }
}

export async function getSystemDiagnostics(): Promise<SystemDiagnosticsSnapshot> {
  if (!hasSuoraBridge()) {
    return BROWSER_FALLBACK_DIAGNOSTICS
  }

  return sanitizeDiagnostics(await suoraIpc.system.diagnostics())
}

export async function getUpdaterState(): Promise<UpdaterStateSnapshot> {
  if (!hasSuoraBridge()) {
    return { enabled: false, channel: "latest" }
  }

  const value = await suoraIpc.updater.getState()
  if (!isObject(value)) {
    return { enabled: false, channel: "latest" }
  }

  return {
    enabled: Boolean(value.enabled),
    channel: asString(value.channel, "latest"),
  }
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  if (!hasSuoraBridge()) {
    return { skipped: true, reason: "bridge-unavailable" }
  }

  return suoraIpc.updater.check()
}