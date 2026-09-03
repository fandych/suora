import os from "node:os"
import { exec } from "node:child_process"
import { promisify } from "node:util"

const execAsync = promisify(exec)

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

type ProbeDefinition = {
  id: EnvironmentToolStatus["id"]
  label: string
  command: string
  versionArgs: string[]
}

const PROBES: ProbeDefinition[] = [
  { id: "nodejs", label: "Node.js", command: "node", versionArgs: ["-v"] },
  { id: "npm", label: "npm", command: "npm", versionArgs: ["-v"] },
  { id: "python", label: "Python", command: "python", versionArgs: ["--version"] },
]

function round(value: number, precision = 1) {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

async function runTextCommand(command: string) {
  return execAsync(command, { timeout: 5_000, windowsHide: true })
}

async function resolveCommandPath(command: string) {
  try {
    const lookup = process.platform === "win32" ? `where ${command}` : `command -v ${command}`
    const { stdout } = await runTextCommand(lookup)
    const firstLine = stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean)
    return firstLine ?? null
  } catch {
    return null
  }
}

async function probeEnvironmentTool(definition: ProbeDefinition): Promise<EnvironmentToolStatus> {
  const resolvedPath = await resolveCommandPath(definition.command)

  if (!resolvedPath) {
    return {
      id: definition.id,
      label: definition.label,
      command: definition.command,
      installed: false,
      version: null,
      path: null,
      error: "Command not found in PATH.",
    }
  }

  try {
    const { stdout, stderr } = await runTextCommand(`${definition.command} ${definition.versionArgs.join(" ")}`)
    const versionOutput = `${stdout}\n${stderr}`.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null

    return {
      id: definition.id,
      label: definition.label,
      command: definition.command,
      installed: true,
      version: versionOutput,
      path: resolvedPath,
      error: null,
    }
  } catch (error) {
    return {
      id: definition.id,
      label: definition.label,
      command: definition.command,
      installed: true,
      version: null,
      path: resolvedPath,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function getSystemDiagnostics(): Promise<SystemDiagnosticsSnapshot> {
  const environment = await Promise.all(PROBES.map((probe) => probeEnvironmentTool(probe)))
  const memoryUsage = process.memoryUsage()

  return {
    environment,
    runtime: {
      timestamp: Date.now(),
      processMemoryMb: round(memoryUsage.rss / 1024 / 1024),
      heapUsedMb: round(memoryUsage.heapUsed / 1024 / 1024),
      totalMemoryGb: round(os.totalmem() / 1024 / 1024 / 1024, 2),
      freeMemoryGb: round(os.freemem() / 1024 / 1024 / 1024, 2),
      uptimeSeconds: Math.round(process.uptime()),
      cpuCount: os.cpus().length,
      loadAverage: os.loadavg().slice(0, 3) as [number, number, number],
      pid: process.pid,
    },
  }
}