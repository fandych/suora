import fs from "node:fs/promises"
import path from "node:path"
import { getAppMetaValue } from "@/electron/app/system/system-repository"
import { ensureWorkspace } from "@/electron/infrastructure/workspace-service"
import { getWorkspacePath } from "@/electron/infrastructure/workspace-paths"

type ToolPreferenceSettings = {
  fileAccessPolicy?: "allowlist" | "denylist"
  fileAccessDirectories?: string[]
  commandAllowlist?: string[]
  commandBlacklist?: string[]
  globalEnvironmentVariables?: Array<{ key?: string; value?: string }>
}

function normalizePathForComparison(value: string) {
  const normalized = path.normalize(path.resolve(value))
  return process.platform === "win32" ? normalized.toLowerCase() : normalized
}

function isPathWithinRoot(root: string, target: string) {
  const normalizedRoot = normalizePathForComparison(root)
  const normalizedTarget = normalizePathForComparison(target)
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`)
}

async function resolvePathForPolicy(target: string) {
  try {
    return await fs.realpath(target)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== "ENOENT") throw error
    const parent = path.dirname(target)
    const resolvedParent = await fs.realpath(parent)
    return path.join(resolvedParent, path.basename(target))
  }
}

export async function resolveWorkspacePolicyTarget(target: string) {
  const root = path.resolve(getWorkspacePath())
  const [resolvedRoot, resolvedTarget] = await Promise.all([fs.realpath(root), resolvePathForPolicy(target)])
  if (!isPathWithinRoot(resolvedRoot, resolvedTarget)) {
    throw new Error("Path must stay within the workspace root.")
  }
  return resolvedTarget
}

export async function readToolPreferences(): Promise<ToolPreferenceSettings> {
  const value = await getAppMetaValue("preference_settings")
  try {
    return value ? (JSON.parse(value) as ToolPreferenceSettings) : {}
  } catch {
    return {}
  }
}
export function normalizeRuleList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    : []
}
export function resolveWorkspaceTarget(relativePath = ".") {
  const root = path.resolve(getWorkspacePath())
  const target = path.resolve(root, relativePath)
  if (!isPathWithinRoot(root, target))
    throw new Error("Path must stay within the workspace root.")
  return target
}
export async function enforceRelativePathPolicy(relativePath: string | undefined, target: string) {
  const preferences = await readToolPreferences()
  const resolvedRoot = await fs.realpath(path.resolve(getWorkspacePath()))
  const resolvedTarget = await resolveWorkspacePolicyTarget(target)
  if (!isPathWithinRoot(resolvedRoot, resolvedTarget)) throw new Error("Path must stay within the workspace root.")
  const relative = path.relative(resolvedRoot, resolvedTarget).replace(/\\/g, "/").toLowerCase()
  const rules = normalizeRuleList(preferences.fileAccessDirectories)
  if (!rules.length) return
  const matches = rules.some((rule) => {
    const normalized = rule.replace(/^\.\//, "").replace(/\/$/, "")
    return normalized === "." ? relative === "" : relative === normalized || relative.startsWith(`${normalized}/`)
  })
  if (preferences.fileAccessPolicy === "allowlist" && !matches)
    throw new Error(`Access to '${relativePath ?? "."}' is outside the allowed directories.`)
  if (preferences.fileAccessPolicy !== "allowlist" && matches)
    throw new Error(`Access to '${relativePath ?? "."}' is blocked by the file access policy.`)
}
export async function enforceCommandPolicy(command: string, executableName: string) {
  const preferences = await readToolPreferences()
  const normalized = command.trim().toLowerCase()
  const allowlist = normalizeRuleList(preferences.commandAllowlist)
  const blocked = normalizeRuleList(preferences.commandBlacklist).find((entry) => normalized.includes(entry))
  if (allowlist.length && !allowlist.includes(executableName.toLowerCase()))
    throw new Error(`Command blocked by allowlist: ${executableName}`)
  if (blocked) throw new Error(`Command blocked by preferences: ${blocked}`)
}
export async function ensureToolWorkspace() {
  await ensureWorkspace()
}
