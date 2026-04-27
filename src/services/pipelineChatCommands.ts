import type { AgentPipeline } from '@/types'

export type PipelineChatCommand =
  | { type: 'list' }
  | { type: 'help' }
  | { type: 'cancel' }
  | { type: 'status' }
  | { type: 'history'; reference?: string }
  | { type: 'run'; reference: string; args?: Record<string, string> }

type PipelineChatReference = Pick<AgentPipeline, 'id' | 'name'>

const LIST_PATTERNS = [
  /\b(?:list|show|view|display)(?:\s+(?:me|all|the))?(?:\s+(?:saved|available))?\s+(?:pipelines?|workflows?)\b/i,
  /\b(?:what|which)(?:\s+are|'s)?\s+(?:the\s+)?(?:saved|available)\s+(?:pipelines?|workflows?)\b/i,
  /\b(?:pipelines?|workflows?)\s+(?:list|catalog|overview)\b/i,
  /(?:列出|查看|显示|有哪些|有什么).*(?:流水线|工作流|管道|pipeline)/u,
  /(?:流水线|工作流|管道|pipeline).*(?:列表|清单|目录|有哪些|有什么)/u,
]

const RUN_PATTERNS = [
  /^(?:(?:please|help me)\s+|(?:can|could|would)\s+you(?:\s+please)?\s+|(?:i\s+(?:want|need)\s+to|i'd\s+like\s+to)\s+)?(?:run|execute|start|launch|trigger)\b(?:\s+(?:the|saved|named))?(?:\s+(?:pipeline|workflow))?\s+["'“”‘’]?(.+?)["'“”‘’]?(?:\s+(?:pipeline|workflow))?(?:\s+(?:please|for me))?[.!?]?$/i,
  /^(?:the\s+)?(?:pipelines?|workflows?)\s+(?:run|execute|start|launch|trigger)\s+["'“”‘’]?(.+?)["'“”‘’]?(?:\s+(?:please|for me))?[.!?]?$/i,
  /(?:请|帮我|麻烦|可以)?(?:运行|执行|启动|触发)(?:一下)?(?:名为)?(?:这个)?(?:流水线|工作流|管道)?[\s:：-]*["'“”‘’]?(.+?)["'“”‘’]?(?:\s*(?:流水线|工作流|管道))?(?:吧|呀|哦|吗)?[。！？!?.]*$/u,
  /(?:流水线|工作流|管道)[\s:：-]*(?:运行|执行|启动|触发)[\s:：-]*["'“”‘’]?(.+?)["'“”‘’]?(?:吧|呀|哦|吗)?[。！？!?.]*$/u,
]

const ACTION_PATTERN = /(?:\b(?:run|execute|start|launch|trigger)\b|运行|执行|启动|触发)/i
const SIGNAL_PATTERN = /(?:\b(?:run|execute|start|launch|trigger|list|show|view|display)\b|运行|执行|启动|触发|列出|查看|显示|有哪些|有什么|pipeline|workflow|流水线|工作流|管道)/i

function cleanReference(reference: string): string {
  return reference
    .trim()
    .replace(/^(?:run|execute|start|launch|trigger)\s+/i, '')
    .replace(/^(?:pipeline|workflow)\s+/i, '')
    .replace(/^(?:运行|执行|启动|触发)(?:一下)?(?:名为)?(?:这个)?(?:流水线|工作流|管道)?[\s:：-]*/u, '')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/gu, '')
    .replace(/(?:\s+(?:please|for me))$/i, '')
    .replace(/[。！？!?.]+$/u, '')
    .replace(/(?:吧|呀|哦|吗)$/u, '')
    .trim()
}

function parseNamedArgs(input: string): { reference: string; args?: Record<string, string> } {
  const parts = input.match(/"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\S+/g) ?? []
  const args: Record<string, string> = {}
  const referenceParts: string[] = []

  for (const part of parts) {
    const match = part.match(/^([\w.-]+)=(.+)$/)
    if (!match) {
      referenceParts.push(part)
      continue
    }
    const value = match[2].replace(/^['"]|['"]$/g, '')
    args[match[1]] = value
  }

  return {
    reference: cleanReference(referenceParts.join(' ')),
    args: Object.keys(args).length > 0 ? args : undefined,
  }
}

function findMentionedPipeline(
  input: string,
  pipelines: PipelineChatReference[],
): PipelineChatReference | null {
  const normalizedInput = input.toLowerCase()
  const sortedPipelines = [...pipelines].sort((left, right) => right.name.length - left.name.length)
  return sortedPipelines.find((pipeline) => {
    const normalizedName = pipeline.name.toLowerCase()
    if (!normalizedName) return false
    if (/^[\w -]+$/i.test(normalizedName)) {
      return new RegExp(`(?:^|\\b)${escapeRegExp(normalizedName)}(?:\\b|$)`, 'i').test(normalizedInput)
    }
    return normalizedInput.includes(normalizedName)
  }) ?? null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function removeMentionedPipelineNames(input: string, pipelines: PipelineChatReference[]): string {
  return pipelines.reduce((current, pipeline) => {
    const name = pipeline.name.trim()
    if (!name) return current
    return current.replace(new RegExp(escapeRegExp(name), 'gi'), ' ')
  }, input)
}

export function parseSlashPipelineChatCommand(input: string): PipelineChatCommand | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null

  if (/^\/(?:pipelines?|workflows?)\s*(?:list|show|catalog|overview)?$/i.test(trimmed)) {
    return { type: 'list' }
  }

  if (/^\/(?:pipelines?|workflows?)\s+(?:help|\?)$/i.test(trimmed)) {
    return { type: 'help' }
  }

  if (/^\/(?:pipelines?|workflows?)\s+cancel$/i.test(trimmed)) {
    return { type: 'cancel' }
  }

  if (/^\/(?:pipelines?|workflows?)\s+status$/i.test(trimmed)) {
    return { type: 'status' }
  }

  const historyMatch = trimmed.match(/^\/(?:pipelines?|workflows?)\s+history(?:\s+(.+))?$/i)
  if (historyMatch) {
    return { type: 'history', reference: historyMatch[1] ? cleanReference(historyMatch[1]) : undefined }
  }

  const runMatch = trimmed.match(/^\/(?:run-)?(?:pipelines?|workflows?)(?:\s+(?:run|execute|start|launch|trigger))?\s+(.+)$/i)
  if (!runMatch?.[1]?.trim()) return null

  const parsed = parseNamedArgs(runMatch[1])

  return {
    type: 'run',
    reference: parsed.reference,
    args: parsed.args,
  }
}

export function looksLikePipelineChatCommand(input: string): boolean {
  return SIGNAL_PATTERN.test(input.trim())
}

export function detectNaturalPipelineChatCommand(
  input: string,
  pipelines: PipelineChatReference[],
): PipelineChatCommand | null {
  const trimmed = input.trim()
  if (!trimmed || trimmed.startsWith('/')) return null

  if (LIST_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return { type: 'list' }
  }

  for (const pattern of RUN_PATTERNS) {
    const match = trimmed.match(pattern)
    const reference = match?.[1] ? cleanReference(match[1]) : ''
    if (reference) {
      return { type: 'run', reference }
    }
  }

  if (!ACTION_PATTERN.test(removeMentionedPipelineNames(trimmed, pipelines))) return null

  const mentionedPipeline = findMentionedPipeline(trimmed, pipelines)
  if (!mentionedPipeline) return null

  return {
    type: 'run',
    reference: mentionedPipeline.id,
  }
}

export function resolvePipelineChatCommandFromText(
  input: string,
  pipelines: PipelineChatReference[],
): PipelineChatCommand | null {
  return parseSlashPipelineChatCommand(input) ?? detectNaturalPipelineChatCommand(input, pipelines)
}