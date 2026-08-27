import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { HarnessAgent } from '@ai-sdk/harness/agent'
import { createClaudeCode } from '@ai-sdk/harness-claude-code'
import { createCodex } from '@ai-sdk/harness-codex'
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel'

const DEFAULT_PORT = 4000
const DEFAULT_RUNTIME = 'node24'
const DEFAULT_MAX_FILES = 400
const DEFAULT_MAX_FILE_BYTES = 1_000_000
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'out',
  'build',
  'coverage',
  'playwright-report',
  'test-results',
  '.turbo',
  '.next',
])

const HELP_TEXT = `
Run a remote AI SDK harness adapter against a Vercel sandbox seeded with the current workspace snapshot.

Usage:
  npm run harness:codex -- [options] "<prompt>"
  npm run harness:claude-code -- [options] "<prompt>"

Options:
  --adapter <name>      codex | claude-code
  --cwd <path>          Workspace root to sync. Defaults to the current directory.
  --model <id>          Adapter model id.
  --auth <mode>         Adapter auth mode. Defaults to auto.
  --reasoning <level>   Codex reasoning effort: low|medium|high.
  --max-files <count>   Max files copied into the sandbox. Default 400.
  --max-bytes <count>   Max bytes per copied file. Default 1000000.
  --help, -h            Show this help text.

Environment:
  VERCEL_OIDC_TOKEN
  AI_GATEWAY_API_KEY
  AI_GATEWAY_BASE_URL
  OPENAI_API_KEY
  CODEX_API_KEY
  ANTHROPIC_API_KEY
  ANTHROPIC_AUTH_TOKEN
  HARNESS_SHOW_REASONING=1

Notes:
  - These runners copy a filtered snapshot of the current workspace into a remote sandbox.
  - They do not write changes back into the local workspace.
  - Bridge-backed adapters need Vercel Sandbox credentials plus model credentials.
`.trim()

function readEnv(name) {
  const value = process.env[name]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function takeValue(argv, index, flag) {
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`)
  }
  return value
}

function parseArgs(argv) {
  const options = {
    adapter: undefined,
    promptParts: [],
    auth: 'auto',
    maxFiles: DEFAULT_MAX_FILES,
    maxBytes: DEFAULT_MAX_FILE_BYTES,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true
        break
      case '--adapter':
        options.adapter = takeValue(argv, index, arg)
        index += 1
        break
      case '--cwd':
        options.cwd = takeValue(argv, index, arg)
        index += 1
        break
      case '--model':
        options.model = takeValue(argv, index, arg)
        index += 1
        break
      case '--auth':
        options.auth = takeValue(argv, index, arg)
        index += 1
        break
      case '--reasoning':
        options.reasoning = takeValue(argv, index, arg)
        index += 1
        break
      case '--max-files':
        options.maxFiles = Number.parseInt(takeValue(argv, index, arg), 10)
        index += 1
        break
      case '--max-bytes':
        options.maxBytes = Number.parseInt(takeValue(argv, index, arg), 10)
        index += 1
        break
      default:
        options.promptParts.push(arg)
        break
    }
  }

  return options
}

function printHelp(exitCode = 0) {
  const writer = exitCode === 0 ? console.log : console.error
  writer(HELP_TEXT)
  process.exit(exitCode)
}

function formatUsage(usage) {
  if (!usage) return 'usage unavailable'
  const segments = []
  if (usage.inputTokens != null) segments.push(`input=${usage.inputTokens}`)
  if (usage.outputTokens != null) segments.push(`output=${usage.outputTokens}`)
  if (usage.totalTokens != null) segments.push(`total=${usage.totalTokens}`)
  return segments.length > 0 ? segments.join(' ') : 'usage unavailable'
}

function shouldSkipEntry(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/')
  if (!normalized) return false
  return normalized.split('/').some((part) => SKIP_DIRS.has(part))
}

async function collectWorkspaceFiles(rootDir, maxFiles, maxBytes) {
  const files = []
  const skipped = []

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name)
      const relativePath = path.relative(rootDir, absolutePath)
      const normalizedRelativePath = relativePath.replace(/\\/g, '/')

      if (shouldSkipEntry(normalizedRelativePath)) continue
      if (files.length >= maxFiles) return

      if (entry.isDirectory()) {
        await walk(absolutePath)
        continue
      }

      if (!entry.isFile()) continue

      const stat = await fs.stat(absolutePath)
      if (stat.size > maxBytes) {
        skipped.push(`${normalizedRelativePath} (${stat.size} bytes > ${maxBytes})`)
        continue
      }

      const content = await fs.readFile(absolutePath)
      files.push({
        relativePath: normalizedRelativePath,
        content: new Uint8Array(content),
      })
    }
  }

  await walk(rootDir)
  return { files, skipped }
}

async function syncWorkspaceSnapshot(session, sessionWorkDir, workspaceRoot, maxFiles, maxBytes) {
  const { files, skipped } = await collectWorkspaceFiles(workspaceRoot, maxFiles, maxBytes)
  for (const file of files) {
    await session.writeBinaryFile({
      path: `${sessionWorkDir}/${file.relativePath}`,
      content: file.content,
    })
  }
  return { synced: files.length, skipped }
}

function createHarness(adapter, options) {
  if (adapter === 'codex') {
    return createCodex({
      ...(options.model ? { model: options.model } : {}),
      ...(options.auth ? { auth: options.auth } : {}),
      ...(options.reasoning ? { reasoningEffort: options.reasoning } : {}),
    })
  }

  return createClaudeCode({
    ...(options.model ? { model: options.model } : {}),
    ...(options.auth ? { auth: options.auth } : {}),
  })
}

const options = parseArgs(process.argv.slice(2))
if (options.help) printHelp(0)

const adapter = options.adapter
if (adapter !== 'codex' && adapter !== 'claude-code') {
  printHelp(1)
}

const prompt = options.promptParts.join(' ').trim()
if (!prompt) printHelp(1)

const workspaceRoot = path.resolve(options.cwd ?? process.cwd())
const sandbox = createVercelSandbox({
  runtime: DEFAULT_RUNTIME,
  ports: [DEFAULT_PORT],
})

const harness = createHarness(adapter, {
  model: options.model,
  auth: options.auth ?? 'auto',
  reasoning: options.reasoning,
})

const agent = new HarnessAgent({
  id: `suora-${adapter}-harness`,
  harness,
  instructions: `You are operating on a sandboxed snapshot of the Suora workspace at /workspace. Keep changes minimal and summarize touched files.`,
  sandbox,
  sandboxConfig: {
    workDir: 'workspace',
    onSession: async ({ session, sessionWorkDir }) => {
      const summary = await syncWorkspaceSnapshot(session, sessionWorkDir, workspaceRoot, options.maxFiles, options.maxBytes)
      await session.writeTextFile({
        path: `${sessionWorkDir}/.suora-harness-sync.txt`,
        content: [
          `synced=${summary.synced}`,
          `skipped=${summary.skipped.length}`,
          ...summary.skipped.slice(0, 50),
        ].join('\n'),
      })
    },
  },
  permissionMode: 'allow-all',
})

const session = await agent.createSession({ sessionId: `suora-${adapter}-${Date.now()}` })

try {
  console.error(`[harness] adapter=${adapter} cwd=${workspaceRoot}`)
  console.error(`[harness] auth=${options.auth ?? 'auto'}${options.model ? ` model=${options.model}` : ''}`)

  const result = await agent.stream({
    session,
    prompt,
  })

  for await (const part of result.stream) {
    if (part.type === 'text-delta') {
      process.stdout.write(part.text)
      continue
    }

    if (part.type === 'reasoning-delta' && process.env.HARNESS_SHOW_REASONING === '1') {
      process.stderr.write(part.delta)
    }
  }

  process.stdout.write('\n')
  console.error(`[harness] ${formatUsage(await result.totalUsage)}`)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[harness] failed: ${message}`)
  if (!readEnv('VERCEL_OIDC_TOKEN')) {
    console.error('[harness] hint: set VERCEL_OIDC_TOKEN or configure Vercel sandbox credentials before running bridge-backed harnesses.')
  }
  process.exitCode = 1
} finally {
  await session.destroy().catch(() => {})
}