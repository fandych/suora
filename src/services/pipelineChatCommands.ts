import type { AgentPipeline } from '@/types'

export type PipelineChatCommand =
  | { type: 'list' }
  | { type: 'run'; reference: string }

type PipelineChatReference = Pick<AgentPipeline, 'id' | 'name'>

const LIST_PATTERNS = [
  /\b(?:list|show|view|display)(?:\s+(?:me|all|the))?(?:\s+(?:saved|available))?\s+(?:pipelines?|workflows?)\b/i,
  /\b(?:what|which)(?:\s+are|'s)?\s+(?:the\s+)?(?:saved|available)\s+(?:pipelines?|workflows?)\b/i,
  /(?:列出|查看|显示|有哪些|有什么).*(?:流水线|工作流|管道|pipeline)/u,
]

const RUN_PATTERNS = [
  /\b(?:run|execute|start|launch|trigger)\b(?:\s+(?:the|saved|named))?(?:\s+(?:pipeline|workflow))?\s+["'“”‘’]?(.+?)["'“”‘’]?(?:\s+(?:pipeline|workflow))?(?:\s+(?:please|for me))?[.!?]?$/i,
  /(?:请|帮我|麻烦|可以)?(?:运行|执行|启动|触发)(?:一下)?(?:名为)?(?:这个)?(?:流水线|工作流|管道)?[\s:：-]*["'“”‘’]?(.+?)["'“”‘’]?(?:\s*(?:流水线|工作流|管道))?(?:吧|呀|哦|吗)?[。！？!?.]*$/u,
]

const ACTION_PATTERN = /(?:\b(?:run|execute|start|launch|trigger)\b|运行|执行|启动|触发)/i
const SIGNAL_PATTERN = /(?:\b(?:run|execute|start|launch|trigger|list|show|view|display)\b|运行|执行|启动|触发|列出|查看|显示|有哪些|有什么|pipeline|workflow|流水线|工作流|管道)/i

function cleanReference(reference: string): string {
  return reference
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/gu, '')
    .replace(/(?:\s+(?:please|for me))$/i, '')
    .replace(/[。！？!?.]+$/u, '')
    .replace(/(?:吧|呀|哦|吗)$/u, '')
    .trim()
}

function findMentionedPipeline(
  input: string,
  pipelines: PipelineChatReference[],
): PipelineChatReference | null {
  const normalizedInput = input.toLowerCase()
  const sortedPipelines = [...pipelines].sort((left, right) => right.name.length - left.name.length)
  return sortedPipelines.find((pipeline) => normalizedInput.includes(pipeline.name.toLowerCase())) ?? null
}

export function parseSlashPipelineChatCommand(input: string): PipelineChatCommand | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null

  if (/^\/(?:pipelines?|pipeline)\s*(?:list)?$/i.test(trimmed)) {
    return { type: 'list' }
  }

  const runMatch = trimmed.match(/^\/(?:run-)?pipelines?\s+(.+)$/i)
  if (!runMatch?.[1]?.trim()) return null

  return {
    type: 'run',
    reference: cleanReference(runMatch[1]),
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

  if (!ACTION_PATTERN.test(trimmed)) return null

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