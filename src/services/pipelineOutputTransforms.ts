import type { AgentPipelineStep } from '@/types'

/**
 * Result of applying an `AgentPipelineStep.outputTransform` to a step's raw
 * LLM output. `transformed` is what downstream steps will see; `warning` is
 * surfaced on the step record so users can debug silent fallbacks (e.g. an
 * unparseable JSON payload). When the transform is a no-op (e.g. the
 * original already matched the post-transform value) `changed` is false.
 */
export interface OutputTransformResult {
  transformed: string
  changed: boolean
  warning?: string
}

/**
 * Apply the configured `outputTransform` to a step's raw LLM output.
 *
 * Failures (malformed JSON, unresolved path, empty output) degrade
 * gracefully: the original output is returned and a `warning` is emitted.
 * This avoids surprising users with broken pipelines after enabling a
 * transform on a noisy model response.
 */
export function applyOutputTransform(
  step: Pick<AgentPipelineStep, 'outputTransform' | 'outputTransformPath'>,
  rawOutput: string,
): OutputTransformResult {
  if (!step.outputTransform) {
    return { transformed: rawOutput, changed: false }
  }

  switch (step.outputTransform) {
    case 'trim': {
      const trimmed = rawOutput.trim()
      return { transformed: trimmed, changed: trimmed !== rawOutput }
    }
    case 'first-line': {
      const firstLine = pickLine(rawOutput, 'first')
      return { transformed: firstLine, changed: firstLine !== rawOutput }
    }
    case 'last-line': {
      const lastLine = pickLine(rawOutput, 'last')
      return { transformed: lastLine, changed: lastLine !== rawOutput }
    }
    case 'json-path': {
      const path = (step.outputTransformPath ?? '').trim()
      if (!path) {
        return {
          transformed: rawOutput,
          changed: false,
          warning: 'json-path transform missing outputTransformPath; output left unchanged.',
        }
      }
      const parsed = tryParseJson(rawOutput)
      if (!parsed.ok) {
        return {
          transformed: rawOutput,
          changed: false,
          warning: `json-path transform: could not parse output as JSON (${parsed.error}); output left unchanged.`,
        }
      }
      const resolved = resolveJsonPath(parsed.value, path)
      if (resolved === undefined) {
        return {
          transformed: rawOutput,
          changed: false,
          warning: `json-path transform: path "${path}" did not resolve; output left unchanged.`,
        }
      }
      const stringified = typeof resolved === 'string' ? resolved : JSON.stringify(resolved)
      return { transformed: stringified, changed: stringified !== rawOutput }
    }
    default:
      // Unknown transform — treat as no-op so old/new versions interoperate.
      return {
        transformed: rawOutput,
        changed: false,
        warning: `Unknown outputTransform "${String(step.outputTransform)}"; output left unchanged.`,
      }
  }
}

function pickLine(text: string, side: 'first' | 'last'): string {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0)
  if (lines.length === 0) return text
  return side === 'first' ? lines[0] : lines[lines.length - 1]
}

function tryParseJson(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch (error) {
    // Common case: model wraps JSON in ```json fences. Try to recover by
    // parsing the body of the first fenced block (if multiple fenced blocks
    // are emitted, only the first is considered — a deliberate choice to
    // keep the recovery predictable).
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fenced?.[1]) {
      try {
        return { ok: true, value: JSON.parse(fenced[1]) }
      } catch {
        // fall through to the original error
      }
    }
    return { ok: false, error: (error as Error).message }
  }
}

/**
 * Resolve a dotted path against a parsed JSON value. Numeric segments are
 * treated as array indices, everything else as object keys. Returns
 * `undefined` if any segment is missing.
 */
function resolveJsonPath(root: unknown, path: string): unknown {
  const segments = path.split('.').map((segment) => segment.trim()).filter((segment) => segment.length > 0)
  let current: unknown = root
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined
    if (Array.isArray(current)) {
      const index = Number(segment)
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined
      current = current[index]
      continue
    }
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}
