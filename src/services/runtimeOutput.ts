import type { ToolCallStatus, ToolOutputEnvelope } from '@/types'
import { generateId } from '@/utils/helpers'
import { safePathSegment } from '@/utils/pathSegments'

type ElectronBridge = { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> }

const TOOL_OUTPUT_PREVIEW_CHARS = 4_000
const TOOL_OUTPUT_EXTERNALIZE_CHARS = 24_000

function getElectron(): ElectronBridge | undefined {
  return (window as unknown as { electron?: ElectronBridge }).electron
}

function runtimeArtifactsDir(workspacePath: string): string {
  return `${workspacePath}/runtime-artifacts/tool-outputs`
}

function runtimeArtifactPath(workspacePath: string, runId: string, toolCallId: string): string {
  return `${runtimeArtifactsDir(workspacePath)}/${safePathSegment(runId, 'run')}-${safePathSegment(toolCallId, 'tool')}.txt`
}

function summarizeOutput(value: string, maxLength = 320): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (!compact) return 'Tool completed with no textual output.'
  return compact.length > maxLength ? `${compact.slice(0, maxLength).trimEnd()}...` : compact
}

export async function createToolOutputEnvelope(options: {
  status: ToolCallStatus
  output: string
  durationMs?: number
  workspacePath?: string
  runId?: string
  toolCallId?: string
  warnings?: string[]
}): Promise<ToolOutputEnvelope> {
  const outputChars = options.output.length
  const envelope: ToolOutputEnvelope = {
    status: options.status,
    summary: summarizeOutput(options.output),
    dataPreview: options.output.slice(0, TOOL_OUTPUT_PREVIEW_CHARS),
    warnings: options.warnings,
    durationMs: options.durationMs,
    outputChars,
    storedExternally: false,
  }

  if (outputChars <= TOOL_OUTPUT_EXTERNALIZE_CHARS || !options.workspacePath) {
    return envelope
  }

  const electron = getElectron()
  if (!electron) {
    envelope.warnings = [...(envelope.warnings ?? []), 'Large output was truncated because artifact storage is unavailable.']
    return envelope
  }

  try {
    const ensureResult = await electron.invoke('system:ensureDirectory', runtimeArtifactsDir(options.workspacePath)) as { error?: string }
    if (ensureResult?.error) throw new Error(ensureResult.error)
    const path = runtimeArtifactPath(options.workspacePath, options.runId ?? generateId('run'), options.toolCallId ?? generateId('tool'))
    const writeResult = await electron.invoke('fs:writeFile', path, options.output) as { success?: boolean; error?: string }
    if (!writeResult?.success) throw new Error(writeResult?.error || 'Write failed')
    envelope.dataRef = path
    envelope.storedExternally = true
    envelope.warnings = [...(envelope.warnings ?? []), `Full output stored externally (${outputChars.toLocaleString()} chars).`]
  } catch (error) {
    envelope.warnings = [
      ...(envelope.warnings ?? []),
      `Large output could not be externalized: ${error instanceof Error ? error.message : String(error)}`,
    ]
  }

  return envelope
}

export function formatToolEnvelopeForModel(envelope: ToolOutputEnvelope): string {
  const lines = [
    `status: ${envelope.status}`,
    `summary: ${envelope.summary}`,
  ]
  if (envelope.dataRef) lines.push(`dataRef: ${envelope.dataRef}`)
  if (envelope.outputChars !== undefined) lines.push(`outputChars: ${envelope.outputChars}`)
  if (envelope.durationMs !== undefined) lines.push(`durationMs: ${envelope.durationMs}`)
  if (envelope.warnings?.length) lines.push(`warnings: ${envelope.warnings.join('; ')}`)
  if (envelope.dataPreview && !envelope.storedExternally) lines.push(`preview: ${envelope.dataPreview}`)
  return lines.join('\n')
}