import path from 'node:path'
import process from 'node:process'

import { HarnessAgent } from '@ai-sdk/harness/agent'
import { createPi } from '@ai-sdk/harness-pi'
import { createJustBashSandbox } from '@ai-sdk/sandbox-just-bash'
import { InMemoryFs, MountableFs, OverlayFs, ReadWriteFs, Sandbox } from 'just-bash'

const HELP_TEXT = `
Run the experimental AI SDK Pi harness against the current workspace.

Usage:
  npm run harness:pi -- [options] "<prompt>"

Options:
  --write               Persist file changes back into the real workspace.
                        Without this flag, reads come from the real repo but
                        edits stay in an in-memory overlay and are discarded.
  --cwd <path>          Workspace root to mount. Defaults to the current directory.
  --model <id>          Pi model id. Can also come from HARNESS_PI_MODEL.
  --thinking <level>    Pi thinking level: off|minimal|low|medium|high|xhigh.
  --auth <mode>         Pi auth mode: auto|openai|anthropic|custom|ai-gateway.
  --agent-dir <path>    Optional Pi agent directory.
  --help, -h            Show this help text.

Environment:
  HARNESS_PI_MODEL
  HARNESS_PI_THINKING
  HARNESS_PI_AUTH
  HARNESS_PI_AGENT_DIR
  HARNESS_SHOW_REASONING=1

Auth examples:
  AI Gateway:   AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN
  OpenAI:       OPENAI_API_KEY
  Anthropic:    ANTHROPIC_API_KEY

Examples:
  npm run harness:pi -- "Summarize the architecture of this repository."
  npm run harness:pi -- --model anthropic/claude-sonnet-4.5 "Inspect src/services/aiService.ts"
  npm run harness:pi:write -- "Update README wording and keep the diff minimal."
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
    write: false,
    promptParts: [],
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    switch (arg) {
      case '--help':
      case '-h':
        options.help = true
        break
      case '--write':
        options.write = true
        break
      case '--cwd':
        options.cwd = takeValue(argv, index, arg)
        index += 1
        break
      case '--model':
        options.model = takeValue(argv, index, arg)
        index += 1
        break
      case '--thinking':
        options.thinking = takeValue(argv, index, arg)
        index += 1
        break
      case '--auth':
        options.auth = takeValue(argv, index, arg)
        index += 1
        break
      case '--agent-dir':
        options.agentDir = takeValue(argv, index, arg)
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

function formatInstructions(writeEnabled) {
  return [
    'You are operating inside the Suora workspace mounted at /workspace.',
    writeEnabled
      ? 'Edits apply to the real workspace. Keep changes minimal and summarize changed files at the end.'
      : 'This is a dry-run copy-on-write workspace. Reads come from the real repository, but any file edits stay inside an ephemeral overlay and are discarded after the session.',
    'Prefer small verifiable changes. When referencing files, use paths relative to /workspace.',
  ].join(' ')
}

const options = parseArgs(process.argv.slice(2))

if (options.help) {
  printHelp(0)
}

const prompt = options.promptParts.join(' ').trim()
if (!prompt) {
  printHelp(1)
}

const workspaceRoot = path.resolve(options.cwd ?? process.cwd())
const model = options.model ?? readEnv('HARNESS_PI_MODEL')
const thinkingLevel = options.thinking ?? readEnv('HARNESS_PI_THINKING') ?? 'medium'
const auth = options.auth ?? readEnv('HARNESS_PI_AUTH') ?? 'auto'
const agentDir = options.agentDir ?? readEnv('HARNESS_PI_AGENT_DIR')

const workspaceFilesystem = options.write
  ? new ReadWriteFs({ root: workspaceRoot })
  : new OverlayFs({ root: workspaceRoot })

const sandboxFilesystem = new MountableFs({
  base: new InMemoryFs(),
  mounts: [{ mountPoint: '/workspace', filesystem: workspaceFilesystem }],
})

const sandbox = await Sandbox.create({
  fs: sandboxFilesystem,
  cwd: '/',
})

const sandboxProvider = createJustBashSandbox({ sandbox })
const harness = createPi({
  auth,
  thinkingLevel,
  ...(model ? { model } : {}),
  ...(agentDir ? { agentDir: path.resolve(agentDir) } : {}),
})

const agent = new HarnessAgent({
  id: 'suora-pi-harness',
  harness,
  instructions: formatInstructions(options.write),
  sandbox: sandboxProvider,
  sandboxConfig: {
    workDir: 'workspace',
  },
  permissionMode: 'allow-all',
})

const fileChanges = []
const sessionId = `suora-${Date.now()}`
const session = await agent.createSession({ sessionId })

try {
  console.error(`[harness] mode=${options.write ? 'write' : 'dry-run'} cwd=${workspaceRoot}`)
  console.error(`[harness] auth=${auth} thinking=${thinkingLevel}${model ? ` model=${model}` : ''}`)

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
      continue
    }

    if (part.type === 'file-change') {
      fileChanges.push(`${part.event} ${part.path}`)
    }
  }

  const usage = await result.totalUsage
  process.stdout.write('\n')

  if (fileChanges.length > 0) {
    console.error('[harness] file changes:')
    for (const change of fileChanges) {
      console.error(`- ${change}`)
    }
  }

  console.error(`[harness] ${formatUsage(usage)}`)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[harness] failed: ${message}`)
  if (!readEnv('AI_GATEWAY_API_KEY') && !readEnv('VERCEL_OIDC_TOKEN') && !readEnv('OPENAI_API_KEY') && !readEnv('ANTHROPIC_API_KEY')) {
    console.error('[harness] hint: set AI_GATEWAY_API_KEY, VERCEL_OIDC_TOKEN, OPENAI_API_KEY, or ANTHROPIC_API_KEY before running the harness.')
  }
  process.exitCode = 1
} finally {
  await session.destroy().catch(() => {})
  await sandbox.stop().catch(() => {})
}