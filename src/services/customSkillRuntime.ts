/**
 * Custom Skill Runtime — compiles user-authored TypeScript/JS tool definitions
 * into AI SDK compatible ToolSet objects.
 *
 * Users write code using `defineCustomTool({ name, description, params, execute })`
 * which is collected and converted to AI SDK `tool()` calls with Zod schemas.
 */
import { tool, type ToolSet } from 'ai'
import { z, type ZodTypeAny } from 'zod'
import type { Skill } from '@/types'

// ─── Types ──────────────────────────────────────────────────────────

interface CustomToolParamDef {
  type: 'string' | 'number' | 'boolean'
  description: string
  required?: boolean
}

interface CustomToolDef {
  name: string
  description: string
  params: Record<string, CustomToolParamDef>
  execute: (args: Record<string, unknown>, context?: { signal: AbortSignal }) => Promise<string> | string
}

export interface CompileResult {
  tools: ToolSet
  toolNames: string[]
  error?: string
}

const MAX_CUSTOM_TOOL_RESULT_LENGTH = 20_000

/** Max wall-clock time a single custom-tool `execute` call is allowed. */
const CUSTOM_TOOL_EXECUTION_TIMEOUT_MS = 10_000

// ─── Param → Zod mapping ───────────────────────────────────────────

function paramToZod(def: CustomToolParamDef): ZodTypeAny {
  let schema: ZodTypeAny
  switch (def.type) {
    case 'number':
      schema = z.number().describe(def.description)
      break
    case 'boolean':
      schema = z.boolean().describe(def.description)
      break
    default:
      schema = z.string().describe(def.description)
  }
  if (!def.required) {
    schema = schema.optional()
  }
  return schema
}

function buildZodSchema(params: Record<string, CustomToolParamDef>) {
  const shape: Record<string, ZodTypeAny> = {}
  for (const [key, def] of Object.entries(params)) {
    shape[key] = paramToZod(def)
  }
  return z.object(shape)
}

// ─── Sandboxed execution ────────────────────────────────────────────

/** Allowed globals exposed to user code */
const SAFE_GLOBALS: Record<string, unknown> = {
  console: { log: console.log, warn: console.warn, error: console.error },
  JSON,
  Math,
  Date,
  Array,
  Object,
  String,
  Number,
  Boolean,
  RegExp,
  Map,
  Set,
  Promise,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  encodeURIComponent,
  decodeURIComponent,
  encodeURI,
  decodeURI,
  atob: typeof atob !== 'undefined' ? atob : undefined,
  btoa: typeof btoa !== 'undefined' ? btoa : undefined,
}

/**
 * Detect Function constructor bypass attempts in code.
 * Returns true if dangerous patterns are found.
 *
 * Note: regex denylists are inherently imperfect. The real defense-in-depth
 * is the parameter shadowing + `"use strict"` wrapper inside compileCustomCode
 * and the per-execution timeout. This check is a fast pre-flight screen to
 * reject the most common / lazy bypass attempts.
 */
function detectFunctionConstructorBypass(code: string): boolean {
  // First, resolve common obfuscation techniques before pattern matching:
  //   - \uXXXX unicode escapes   →  replaced with the actual char
  //   - \xXX   hex escapes        →  replaced with the actual char
  //   - string concatenation      →  `'Func' + 'tion'` collapsed to `Function`
  //     when both sides are short quoted literals
  let normalised = code.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  )
  normalised = normalised.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  )
  // Collapse `"a" + "b" + ...` runs of quoted literals into a single literal
  // (up to 8 segments — enough to defeat `'Func'+'tion'` and similar).
  for (let i = 0; i < 8; i++) {
    const before = normalised
    normalised = normalised.replace(
      /(['"])([^'"]{0,30})\1\s*\+\s*(['"])([^'"]{0,30})\3/g,
      (_m, _q1, a, _q2, b) => `"${a}${b}"`,
    )
    if (normalised === before) break
  }

  const dangerousPatterns = [
    // Direct Function constructor
    /\bFunction\s*\(/,
    /\beval\s*\(/,
    /\bimport\s*\(/,
    /\.\s*constructor\s*\.\s*constructor/,
    /\[\s*['"]constructor['"]\s*\]\s*\[\s*['"]constructor['"]\s*\]/,
    /\[\s*['"]constructor['"]\s*\]\s*\.\s*constructor/,
    // Prototype chain and prototype pollution access
    /\.\s*__proto__\s*(?:\.|\[)/,
    /\[\s*['"]__proto__['"]\s*\]\s*(?:\.|\[)/,
    /\.\s*prototype\s*(?:\.|\[)/,
    /\[\s*['"]prototype['"]\s*\]\s*(?:\.|\[)/,
    /\bObject\s*\.\s*getPrototypeOf\b/,
    // Constructor discovery from literals
    /(?:\[\s*\]|\{\s*\}|["'`][^"'`]*["'`])\s*\.\s*constructor\b/,
    // Reflect.construct bypass
    /Reflect\s*\.\s*construct/,
    // Named function constructor variants
    /\b(?:AsyncFunction|GeneratorFunction|AsyncGeneratorFunction)\b/,
    // Bracket-access to sensitive globals after literal collapsing
    /\[\s*["'](?:Function|eval|import|constructor|AsyncFunction|GeneratorFunction|process|require|globalThis|window|self|top|parent|Reflect|Proxy|Worker|fetch|XMLHttpRequest|WebSocket|importScripts|localStorage|sessionStorage|indexedDB|__proto__|prototype)["']\s*\]/,
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(normalised)) {
      return true
    }
  }
  return false
}

function truncateSerializedResult(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}... [truncated ${value.length - maxLength} chars]`
}

function safeSerializeCustomToolResult(result: unknown, maxLength = MAX_CUSTOM_TOOL_RESULT_LENGTH): string {
  if (typeof result === 'string') {
    return truncateSerializedResult(result, maxLength)
  }

  const seen = new WeakSet<object>()

  try {
    const serialized = JSON.stringify(result, (_key, value) => {
      if (typeof value === 'bigint') return `${value.toString()}n`
      if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`
      // Preserve common rich types that JSON would otherwise drop silently.
      if (value instanceof Date) return value.toISOString()
      if (value instanceof Map) return { __type: 'Map', entries: Array.from(value.entries()) }
      if (value instanceof Set) return { __type: 'Set', values: Array.from(value) }
      if (value instanceof RegExp) return { __type: 'RegExp', source: value.source, flags: value.flags }
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
        }
      }
      if (value && typeof value === 'object') {
        if (seen.has(value)) return '[Circular]'
        seen.add(value)
      }
      return value
    }, 2)

    return truncateSerializedResult(serialized ?? String(result), maxLength)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return `[Unserializable result: ${message}]`
  }
}

/**
 * Compile custom code and return the resulting ToolSet.
 *
 * The code is evaluated with a restricted global scope — no `require`, `import`,
 * `process`, `fs`, etc. A `defineCustomTool()` function is injected so the user
 * code can register tools.
 */
export function compileCustomCode(code: string): CompileResult {
  const collected: CustomToolDef[] = []

  // Pre-flight security check
  if (detectFunctionConstructorBypass(code)) {
    return {
      tools: {},
      toolNames: [],
      error: 'Security violation: Detected attempt to bypass sandbox using Function constructor or prototype manipulation',
    }
  }

  function defineCustomTool(def: CustomToolDef) {
    if (!def.name || typeof def.name !== 'string') {
      throw new Error('defineCustomTool: "name" must be a non-empty string')
    }
    if (!def.description || typeof def.description !== 'string') {
      throw new Error('defineCustomTool: "description" must be a non-empty string')
    }
    if (typeof def.execute !== 'function') {
      throw new Error('defineCustomTool: "execute" must be a function')
    }
    collected.push(def)
  }

  try {
    // Build the sandboxed function.
    // Parameter names become local bindings inside the function body, shadowing
    // any outer scope the Function constructor might close over.
    const paramNames = ['defineCustomTool', ...Object.keys(SAFE_GLOBALS)]
    const paramValues = [defineCustomTool, ...Object.values(SAFE_GLOBALS)]

    // Block dangerous globals by shadowing them as undefined
    // Expanded list to include all potential escape vectors
    const blockedGlobals = [
      // Node.js globals
      'require', 'module', 'exports', '__dirname', '__filename',
      'process', 'global', 'Buffer',
      // Browser globals
      'globalThis', 'window', 'document', 'self', 'top', 'parent', 'frames',
      // Network APIs
      'fetch', 'XMLHttpRequest', 'WebSocket', 'importScripts', 'EventSource',
      // Dynamic code execution
      'Function', 'GeneratorFunction', 'AsyncFunction', 'AsyncGeneratorFunction',
      // Timers (can be used for DoS or timing attacks)
      'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'setImmediate', 'clearImmediate',
      // Reflection APIs (can bypass restrictions)
      'Reflect', 'Proxy',
      // Symbol registry (can access global state)
      'Symbol',
      // Storage APIs
      'localStorage', 'sessionStorage', 'indexedDB', 'caches',
      // Worker APIs
      'Worker', 'SharedWorker', 'ServiceWorker',
      // Import APIs
      'importScripts',
    ]
    const blockDeclarations = blockedGlobals
      .map((g) => `var ${g} = undefined;`)
      .join('\n')

    const wrappedCode = `"use strict";\n${blockDeclarations}\n${code}`

    const fn = new Function(...paramNames, wrappedCode)
    fn(...paramValues)

    // Convert collected definitions to AI SDK tools
    const tools: ToolSet = {}
    const toolNames: string[] = []

    for (const def of collected) {
      const schema = buildZodSchema(def.params ?? {})
      const executeFn = def.execute
      tools[def.name] = tool({
        description: def.description,
        inputSchema: schema,
        execute: async (args: Record<string, unknown>) => {
          // Wall-clock timeout guard — prevents infinite loops / hanging fetches
          // in user-authored skill code from freezing the agent pipeline.
          // An AbortController is passed to the executor (as `{ signal }`) so
          // skills that support cancellation (fetch, setTimeout wrappers, etc.)
          // can abort immediately on timeout. Skills that ignore it still
          // work — the Promise.race still races the timeout rejection, but
          // their background work will no longer block anything visible.
          const controller = new AbortController()
          let timeoutHandle: ReturnType<typeof setTimeout> | null = null
          const timeoutPromise = new Promise<never>((_resolve, reject) => {
            timeoutHandle = setTimeout(() => {
              controller.abort()
              reject(new Error(`Custom tool "${def.name}" timed out after ${CUSTOM_TOOL_EXECUTION_TIMEOUT_MS}ms`))
            }, CUSTOM_TOOL_EXECUTION_TIMEOUT_MS)
          })

          try {
            const result = await Promise.race([
              Promise.resolve().then(() => executeFn(args, { signal: controller.signal })),
              timeoutPromise,
            ])
            return safeSerializeCustomToolResult(result)
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            // Preserve stack trace context to aid skill debugging. Redact
            // the internal execution wrapper frames to keep noise down.
            const stack = err instanceof Error && typeof err.stack === 'string'
              ? err.stack.split('\n').slice(0, 6).join('\n')
              : ''
            const detail = stack && stack !== `Error: ${msg}` ? `\n${stack}` : ''
            return `[Custom tool error] ${msg}${detail}`
          } finally {
            if (timeoutHandle !== null) clearTimeout(timeoutHandle)
            // Ensure the signal is aborted so long-running fetches etc.
            // do not keep running silently after we've returned.
            if (!controller.signal.aborted) controller.abort()
          }
        },
      })
      toolNames.push(def.name)
    }

    return { tools, toolNames }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { tools: {}, toolNames: [], error: msg }
  }
}

// ─── Public API used by tools.ts ────────────────────────────────────

/**
 * Get the AI SDK ToolSet generated from a skill's `customCode` field.
 * Returns an empty ToolSet when there is no custom code or compilation fails.
 */
export function getCustomToolsFromSkill(skill: Skill): ToolSet {
  if (!skill.customCode?.trim()) return {}
  const { tools, error } = compileCustomCode(skill.customCode)
  if (error) {
    console.warn(`[customSkillRuntime] Failed to compile custom code for skill "${skill.name}":`, error)
  }
  return tools
}
