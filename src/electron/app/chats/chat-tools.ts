import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import { shell } from "electron"
import { z } from "zod"
import {
  MAX_COMMAND_OUTPUT_BYTES,
  MAX_TOOL_FILE_BYTES,
  MAX_TOOL_WRITE_BYTES,
  ensureFileSizeWithinLimit,
  parseWorkspaceCommand,
  resolveWorkspaceSpawnCommand,
} from "@/electron/app/tools/tool-guardrails"
import {
  enforceCommandPolicy,
  enforceRelativePathPolicy,
  readToolPreferences,
  resolveWorkspaceTarget,
} from "@/electron/app/tools/tool-policy"
import { agentService } from "@/electron/app/agents/service"
import { documentService } from "@/electron/app/documents/service"
import { integrationApplicationService } from "@/electron/app/integrations/service"
import { skillService } from "@/electron/app/skills/service"
import { workflowService } from "@/electron/app/workflows/service"
import {
  clickBrowserElement,
  fillBrowserElement,
  getBrowserPageSnapshot,
  navigateBrowserWindow,
} from "@/electron/infrastructure/browser-window"
import { requestHttp } from "@/electron/infrastructure/http-client"
import { assertSafeHttpUrl } from "@/electron/infrastructure/url-security"
import { ensureWorkspace } from "@/electron/infrastructure/workspace-service"

export type ChatToolExecutionContext = {
  sessionId: string
  selectedAgentId?: string
}

type ChatToolDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
  description: string
  inputSchema: TSchema
  execute: (input: z.infer<TSchema>, context: ChatToolExecutionContext) => Promise<unknown>
}

function defineChatTool<TSchema extends z.ZodTypeAny>(definition: ChatToolDefinition<TSchema>) {
  return definition
}

type AgentToolAccess = {
  toolsetIds: string[]
  documentIds: string[]
  skillIds: string[]
  workflowIds: string[]
}

type SearchHit = {
  excerpt: string
}

function clampResultLimit(value: number | undefined, fallback = 5) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(Math.trunc(value), 20))
    : fallback
}

function createSearchExcerpt(value: string, query: string, maxLength = 220) {
  const compact = value.replace(/\s+/g, " ").trim()
  if (!compact) return ""
  const normalizedSource = compact.toLowerCase()
  const normalizedQuery = query.trim().toLowerCase()
  const matchIndex = normalizedSource.indexOf(normalizedQuery)
  if (matchIndex === -1) return compact.slice(0, maxLength)
  const half = Math.floor((maxLength - normalizedQuery.length) / 2)
  const start = Math.max(0, matchIndex - half)
  const end = Math.min(compact.length, matchIndex + normalizedQuery.length + half)
  const prefix = start > 0 ? "..." : ""
  const suffix = end < compact.length ? "..." : ""
  return `${prefix}${compact.slice(start, end).trim()}${suffix}`
}

function includesQuery(value: string, query: string) {
  return value.toLowerCase().includes(query.toLowerCase())
}

function restrictToBindings<T extends { id: string }>(items: T[], bindings: string[]) {
  if (bindings.length === 0) return items
  const allowed = new Set(bindings)
  return items.filter((item) => allowed.has(item.id))
}

async function searchDocuments(query: string, resultLimit?: number, bindings: string[] = []) {
  const limit = clampResultLimit(resultLimit)
  const documents = restrictToBindings(await documentService.list(), bindings)
  const hits: Array<SearchHit & { documentId: string; documentTitle: string; pageId: string; pageTitle: string }> = []

  for (const document of documents) {
    const detail = await documentService.get(document.id)
    if (!detail) continue
    for (const page of detail.pages) {
      const haystack = `${document.title}\n${document.summary}\n${page.title}\n${page.content}`
      if (!includesQuery(haystack, query)) continue
      hits.push({
        documentId: document.id,
        documentTitle: document.title,
        pageId: page.id,
        pageTitle: page.title,
        excerpt: createSearchExcerpt(`${page.title}\n${page.content}`, query),
      })
      if (hits.length >= limit) return hits
    }
  }

  return hits
}

async function searchSkills(query: string, resultLimit?: number, bindings: string[] = []) {
  const limit = clampResultLimit(resultLimit)
  const skills = restrictToBindings(await skillService.list(), bindings)
  const hits: Array<SearchHit & { skillId: string; skillTitle: string; filePath: string }> = []

  for (const skill of skills) {
    const detail = await skillService.get(skill.id)
    if (!detail) continue
    for (const file of detail.files) {
      if (file.kind === "directory") continue
      const haystack = `${skill.title}\n${skill.summary}\n${file.path}\n${file.content}`
      if (!includesQuery(haystack, query)) continue
      hits.push({
        skillId: skill.id,
        skillTitle: skill.title,
        filePath: file.path,
        excerpt: createSearchExcerpt(`${file.path}\n${file.content}`, query),
      })
      if (hits.length >= limit) return hits
    }
  }

  return hits
}

async function searchWorkflows(query: string, resultLimit?: number, bindings: string[] = []) {
  const limit = clampResultLimit(resultLimit)
  const workflows = restrictToBindings(await workflowService.list(), bindings)
  const hits: Array<SearchHit & { workflowId: string; workflowTitle: string; versionLabel: string }> = []

  for (const workflow of workflows) {
    const detail = await workflowService.get(workflow.id)
    if (!detail.workflow) continue
    const latestVersion = detail.versions[0]
    const definitionJson = latestVersion?.definitionJson ?? ""
    const haystack = `${workflow.title}\n${workflow.summary}\n${definitionJson}`
    if (!includesQuery(haystack, query)) continue
    hits.push({
      workflowId: workflow.id,
      workflowTitle: workflow.title,
      versionLabel: latestVersion ? `${latestVersion.major}.${latestVersion.minor}` : "unknown",
      excerpt: createSearchExcerpt(`${workflow.summary}\n${definitionJson}`, query),
    })
    if (hits.length >= limit) return hits
  }

  return hits
}

async function listWorkspaceFiles(relativePath?: string) {
  await ensureWorkspace()
  const target = resolveWorkspaceTarget(relativePath)
  await enforceRelativePathPolicy(relativePath, target)
  const entries = await fs.readdir(target, { withFileTypes: true })
  return entries.map((entry) => ({
    name: entry.name,
    path: path.relative(resolveWorkspaceTarget(), path.join(target, entry.name)).replace(/\\/g, "/"),
    type: entry.isDirectory() ? "directory" : "file",
  }))
}

async function readWorkspaceFile(relativePath: string) {
  await ensureWorkspace()
  const target = resolveWorkspaceTarget(relativePath)
  await enforceRelativePathPolicy(relativePath, target)
  const stats = await fs.stat(target)
  ensureFileSizeWithinLimit(stats.size, `File '${relativePath}'`, MAX_TOOL_FILE_BYTES)
  return { path: relativePath, content: await fs.readFile(target, "utf8") }
}

async function writeWorkspaceFile(relativePath: string, content: string) {
  await ensureWorkspace()
  const target = resolveWorkspaceTarget(relativePath)
  await enforceRelativePathPolicy(relativePath, target)
  ensureFileSizeWithinLimit(
    Buffer.byteLength(content, "utf8"),
    `Write payload for '${relativePath}'`,
    MAX_TOOL_WRITE_BYTES,
  )
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, content, "utf8")
  return { ok: true, path: relativePath }
}

async function runWorkspaceCommand(payload: {
  command: string
  cwd?: string
  timeoutMs?: number
  env?: Record<string, string>
}) {
  await ensureWorkspace()
  const parsed = parseWorkspaceCommand(payload.command)
  const spawnCommand = resolveWorkspaceSpawnCommand(parsed)
  await enforceCommandPolicy(payload.command, parsed.executableName)
  const workingDirectory = resolveWorkspaceTarget(payload.cwd)
  const preferences = await readToolPreferences()
  const env = {
    ...process.env,
    ...(payload.env ?? {}),
    ...Object.fromEntries(
      (preferences.globalEnvironmentVariables ?? [])
        .filter((item) => item.key)
        .map((item) => [item.key!, item.value ?? ""]),
    ),
  }
  const timeout = Math.max(1_000, Math.min(payload.timeoutMs ?? 30_000, 120_000))
  return new Promise<{ ok: boolean; exitCode: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(spawnCommand.executable, spawnCommand.args, {
      cwd: workingDirectory,
      shell: spawnCommand.shell,
      windowsHide: true,
      env,
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let bytes = 0
    let complete = false
    const finish = (result: { ok: boolean; exitCode: number | null; stdout: string; stderr: string }) => {
      if (complete) return
      complete = true
      clearTimeout(timer)
      resolve(result)
    }
    const collect = (target: Buffer[], chunk: Buffer) => {
      bytes += chunk.byteLength
      target.push(chunk)
      if (bytes > MAX_COMMAND_OUTPUT_BYTES) {
        child.kill()
        finish({
          ok: false,
          exitCode: null,
          stdout: Buffer.concat(stdout).toString(),
          stderr: "Command output exceeded the safety limit.",
        })
      }
    }
    const timer = setTimeout(() => {
      child.kill()
      finish({
        ok: false,
        exitCode: null,
        stdout: Buffer.concat(stdout).toString(),
        stderr: `Command timed out after ${timeout}ms.`,
      })
    }, timeout)
    child.stdout.on("data", (chunk) => collect(stdout, Buffer.from(chunk)))
    child.stderr.on("data", (chunk) => collect(stderr, Buffer.from(chunk)))
    child.on("close", (code) =>
      finish({
        ok: code === 0,
        exitCode: code,
        stdout: Buffer.concat(stdout).toString(),
        stderr: Buffer.concat(stderr).toString(),
      }),
    )
    child.on("error", (error) =>
      finish({ ok: false, exitCode: null, stdout: Buffer.concat(stdout).toString(), stderr: error.message }),
    )
  })
}

async function getAgentToolAccess(selectedAgentId?: string): Promise<AgentToolAccess> {
  if (!selectedAgentId) return { toolsetIds: [], documentIds: [], skillIds: [], workflowIds: [] }
  const payload = await agentService.get(selectedAgentId)
  const config = payload.agent
    ? (JSON.parse(payload.versions[0]?.configJson ?? "{}") as {
        toolsetIds?: string[]
        documentIds?: string[]
        skillIds?: string[]
        workflowIds?: string[]
      })
    : {}
  const normalizeIds = (value: unknown) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : []
  return {
    toolsetIds: normalizeIds(config.toolsetIds),
    documentIds: normalizeIds(config.documentIds),
    skillIds: normalizeIds(config.skillIds),
    workflowIds: normalizeIds(config.workflowIds),
  }
}

const optionalRelativePathSchema = z.object({ path: z.string().min(1).optional() })

export const chatToolDefinitions = {
  listFiles: defineChatTool({
    description: "List workspace files.",
    inputSchema: optionalRelativePathSchema,
    execute: async ({ path: relativePath }) => listWorkspaceFiles(relativePath),
  }),
  listWorkspaceFiles: defineChatTool({
    description: "List files and folders under the workspace root or an optional relative directory.",
    inputSchema: optionalRelativePathSchema,
    execute: async ({ path: relativePath }) => listWorkspaceFiles(relativePath),
  }),
  readWorkspaceFile: defineChatTool({
    description: "Read a UTF-8 text file from the workspace.",
    inputSchema: z.object({ path: z.string().min(1) }),
    execute: async ({ path: relativePath }) => readWorkspaceFile(relativePath),
  }),
  writeWorkspaceFile: defineChatTool({
    description: "Write a UTF-8 text file inside the workspace.",
    inputSchema: z.object({ path: z.string().min(1), content: z.string() }),
    execute: async ({ path: relativePath, content }) => writeWorkspaceFile(relativePath, content),
  }),
  runWorkspaceCommand: defineChatTool({
    description: "Run an allowed workspace command without an interactive shell.",
    inputSchema: z.object({
      command: z.string().min(1),
      cwd: z.string().min(1).optional(),
      timeoutMs: z.number().int().min(1_000).max(120_000).optional(),
      env: z.record(z.string(), z.string()).optional(),
    }),
    execute: async (input) => runWorkspaceCommand(input),
  }),
  browser_navigate: defineChatTool({
    description: "Open the hidden browser session on a safe HTTP or HTTPS page.",
    inputSchema: z.object({ url: z.string().url().optional(), visible: z.boolean().optional() }),
    execute: async (input, context) => navigateBrowserWindow({ sessionId: context.sessionId, ...input }),
  }),
  browser_page: defineChatTool({
    description: "Read the current hidden browser page title, text, and links.",
    inputSchema: z.object({ includeText: z.boolean().optional(), includeLinks: z.boolean().optional() }),
    execute: async (input, context) => getBrowserPageSnapshot({ sessionId: context.sessionId, ...input }),
  }),
  browser_click: defineChatTool({
    description: "Click the first browser element matching a CSS selector.",
    inputSchema: z.object({ selector: z.string().min(1).max(500) }),
    execute: async ({ selector }, context) => clickBrowserElement(selector, context.sessionId),
  }),
  browser_fill: defineChatTool({
    description: "Fill a browser input, textarea, or select element matched by CSS selector.",
    inputSchema: z.object({ selector: z.string().min(1).max(500), value: z.string().max(10_000) }),
    execute: async ({ selector, value }, context) => fillBrowserElement(selector, value, context.sessionId),
  }),
  openExternalUrl: defineChatTool({
    description: "Open a safe external HTTP or HTTPS URL in the user's default browser.",
    inputSchema: z.object({ url: z.string().url() }),
    execute: async ({ url }) => {
      const safeUrl = await assertSafeHttpUrl(url)
      await shell.openExternal(safeUrl.toString())
      return { ok: true, url: safeUrl.toString() }
    },
  }),
  httpRequest: defineChatTool({
    description: "Perform a safe outbound HTTP or HTTPS request and return the response body.",
    inputSchema: z.object({
      url: z.string().url(),
      method: z.string().min(1).optional(),
      headers: z.record(z.string(), z.string()).optional(),
      body: z.string().optional(),
      timeoutMs: z.number().int().min(1_000).max(120_000).optional(),
    }),
    execute: async ({ url, method, headers, body, timeoutMs }) => {
      const response = await requestHttp(url, { method, headers, body, timeoutMs })
      ensureFileSizeWithinLimit(
        Buffer.byteLength(response.text, "utf8"),
        `HTTP response body for '${url}'`,
        MAX_COMMAND_OUTPUT_BYTES,
      )
      return { status: response.status, headers: response.headers, body: response.text, data: response.data }
    },
  }),
  searchDocuments: defineChatTool({
    description: "Search bound or local documents by title and page content.",
    inputSchema: z.object({ query: z.string().min(1), resultLimit: z.number().int().min(1).max(20).optional() }),
    execute: async ({ query, resultLimit }, context) => {
      const access = await getAgentToolAccess(context.selectedAgentId)
      return searchDocuments(query, resultLimit, access.documentIds)
    },
  }),
  searchSkills: defineChatTool({
    description: "Search bound or local skills by title, file path, and file content.",
    inputSchema: z.object({ query: z.string().min(1), resultLimit: z.number().int().min(1).max(20).optional() }),
    execute: async ({ query, resultLimit }, context) => {
      const access = await getAgentToolAccess(context.selectedAgentId)
      return searchSkills(query, resultLimit, access.skillIds)
    },
  }),
  searchWorkflows: defineChatTool({
    description: "Search bound or local workflows by title, summary, and definition text.",
    inputSchema: z.object({ query: z.string().min(1), resultLimit: z.number().int().min(1).max(20).optional() }),
    execute: async ({ query, resultLimit }, context) => {
      const access = await getAgentToolAccess(context.selectedAgentId)
      return searchWorkflows(query, resultLimit, access.workflowIds)
    },
  }),
  runIntegration: defineChatTool({
    description: "Execute an enabled integration by id with optional JSON string input.",
    inputSchema: z.object({ integrationId: z.string().min(1), inputJson: z.string().optional() }),
    execute: async ({ integrationId, inputJson }, context) => {
      const access = await getAgentToolAccess(context.selectedAgentId)
      if (access.toolsetIds.length > 0 && !access.toolsetIds.includes(integrationId)) {
        throw new Error("The selected agent cannot access this integration.")
      }
      const detail = await integrationApplicationService.get(integrationId)
      if (!detail) throw new Error("Integration was not found.")
      const result = await integrationApplicationService.execute({
        integrationId,
        kind: detail.integration.kind as "http" | "scripts" | "mcp",
        config: detail.config,
        inputJson: inputJson ?? "{}",
      })
      return { integration: detail.integration.title, ...result }
    },
  }),
}

export async function executeChatTool(
  toolName: string,
  input: Record<string, unknown> | undefined,
  context: ChatToolExecutionContext,
) {
  const definition = chatToolDefinitions[toolName as keyof typeof chatToolDefinitions] as
    | ChatToolDefinition<z.ZodTypeAny>
    | undefined
  if (!definition) throw new Error(`Tool '${toolName}' is not registered.`)
  const parsedInput = definition.inputSchema.parse(input ?? {})
  return definition.execute(parsedInput, context)
}