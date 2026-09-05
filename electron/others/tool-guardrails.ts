import path from "node:path"

export const MAX_TOOL_FILE_BYTES = 1024 * 1024
export const MAX_TOOL_WRITE_BYTES = 1024 * 1024
export const MAX_COMMAND_OUTPUT_BYTES = 256 * 1024

const DISALLOWED_EXECUTABLES = new Set([
  "bash",
  "cmd",
  "powershell",
  "pwsh",
  "sh",
  "zsh",
  "wscript",
  "cscript",
])

const ALLOWED_EXECUTABLES = new Set([
  "bun",
  "eslint",
  "git",
  "node",
  "npm",
  "npx",
  "pnpm",
  "python",
  "python3",
  "rg",
  "tsc",
  "tsx",
  "vite",
  "vitest",
  "yarn",
])

const WINDOWS_EXECUTABLE_ALIASES: Record<string, string> = {
  bun: "bun.exe",
  eslint: "eslint.cmd",
  git: "git.exe",
  node: "node.exe",
  npm: "npm.cmd",
  npx: "npx.cmd",
  pnpm: "pnpm.cmd",
  python: "python.exe",
  python3: "python.exe",
  rg: "rg.exe",
  tsc: "tsc.cmd",
  tsx: "tsx.cmd",
  vite: "vite.cmd",
  vitest: "vitest.cmd",
  yarn: "yarn.cmd",
}

function normalizeExecutableName(value: string) {
  return path.basename(value).replace(/\.(cmd|bat|exe|ps1)$/i, "").toLowerCase()
}

function tokenizeCommand(command: string) {
  const tokens: string[] = []
  let current = ""
  let quote: '"' | "'" | null = null

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index]

    if (quote) {
      if (character === quote) {
        quote = null
      } else if (character === "\\" && index + 1 < command.length && command[index + 1] === quote) {
        current += quote
        index += 1
      } else {
        current += character
      }
      continue
    }

    if (character === '"' || character === "'") {
      quote = character
      continue
    }

    if (/\s/.test(character)) {
      if (current) {
        tokens.push(current)
        current = ""
      }
      continue
    }

    current += character
  }

  if (quote) {
    throw new Error("Command has an unterminated quoted argument.")
  }

  if (current) {
    tokens.push(current)
  }

  return tokens
}

export function parseWorkspaceCommand(command: string) {
  const trimmed = command.trim()
  if (!trimmed) {
    throw new Error("Command cannot be empty.")
  }

  const tokens = tokenizeCommand(trimmed)
  if (tokens.length === 0) {
    throw new Error("Command cannot be empty.")
  }

  const executableName = normalizeExecutableName(tokens[0])
  if (DISALLOWED_EXECUTABLES.has(executableName)) {
    throw new Error(`Interactive shell executables are blocked: ${executableName}`)
  }

  if (!ALLOWED_EXECUTABLES.has(executableName)) {
    throw new Error(`Executable is not allowed by workspace command policy: ${executableName}`)
  }

  return {
    executable: process.platform === "win32" ? (WINDOWS_EXECUTABLE_ALIASES[executableName] ?? tokens[0]) : tokens[0],
    args: tokens.slice(1),
    executableName,
  }
}

export function ensureFileSizeWithinLimit(byteLength: number, label: string, maxBytes: number) {
  if (byteLength > maxBytes) {
    throw new Error(`${label} exceeds the ${Math.floor(maxBytes / 1024)} KB safety limit.`)
  }
}