import type { AgentPipelineExecutionStep } from '@/types'

/**
 * Pipeline `runIf` expression evaluator.
 *
 * Supported atoms (lowercased):
 *   - `previous.<field>`  / `last.<field>`
 *   - `step<N>.<field>`   / `steps[<N>].<field>`
 *   - `vars.<name>`
 *   - String literal:     `'value'` or `"value"`
 *   - Number literal:     `42`, `1.5`
 *
 * Where `<field>` is one of: `output`, `input`, `task`, `status`, `error`.
 *
 * Supported binary operators (case-insensitive):
 *   - `==`, `!=`
 *   - `contains`, `not contains`
 *   - `matches` (right-hand side is a regex pattern, optional flags via `/.../i`)
 *
 * Supported unary suffixes:
 *   - `is empty`, `is not empty`
 *   - `is truthy`, `is falsy`
 *
 * Multiple clauses can be combined with `&&` (logical AND).
 *
 * Evaluation rules:
 *   - Numeric comparison is used when BOTH sides parse as finite numbers.
 *   - Otherwise comparisons are string-based and case-sensitive.
 *   - References to missing steps/variables resolve to the empty string (treated as falsy).
 */

export type RunIfStepValue = Pick<
  AgentPipelineExecutionStep,
  'stepIndex' | 'agentId' | 'task' | 'input' | 'output' | 'status' | 'error'
>

export interface EvaluateRunIfResult {
  passed: boolean
  /** Human-readable reason describing the failed clause (used as skip reason). */
  reason?: string
}

const BINARY_OPERATORS = ['!=', '==', 'not contains', 'contains', 'matches'] as const
const UNARY_SUFFIXES = ['is not empty', 'is empty', 'is truthy', 'is falsy'] as const

export class RunIfParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RunIfParseError'
  }
}

const NUMBER_PATTERN = /^-?\d+(?:\.\d+)?$/
const REGEX_LITERAL_PATTERN = /^\/(.+)\/([gimsuy]*)$/

function tryParseStringLiteral(raw: string): string | undefined {
  const trimmed = raw.trim()
  if (trimmed.length < 2) return undefined
  const quote = trimmed[0]
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    // Use function replacer to avoid $-substitution in replacement string
    return trimmed.slice(1, -1).replace(new RegExp(`\\\\${quote}`, 'g'), () => quote)
  }
  return undefined
}

function tryResolveAtom(
  raw: string,
  previousSteps: RunIfStepValue[],
  variables: Record<string, string>,
): { value: string; resolved: boolean } {
  const trimmed = raw.trim()

  const stringLiteral = tryParseStringLiteral(trimmed)
  if (stringLiteral !== undefined) return { value: stringLiteral, resolved: true }
  if (NUMBER_PATTERN.test(trimmed)) return { value: trimmed, resolved: true }

  const lower = trimmed.toLowerCase()
  if (lower === 'true') return { value: 'true', resolved: true }
  if (lower === 'false') return { value: 'false', resolved: true }

  // vars.NAME
  const varMatch = trimmed.match(/^vars\.([A-Za-z_][A-Za-z0-9_]*)$/)
  if (varMatch) {
    const name = varMatch[1]
    return { value: variables[name] ?? '', resolved: true }
  }

  // previous / last [.field]
  const prevMatch = lower.match(/^(?:previous|last)(?:\.(output|input|task|status|error))?$/)
  if (prevMatch) {
    const field = (prevMatch[1] ?? 'output') as keyof RunIfStepValue
    const previousStep = previousSteps[previousSteps.length - 1]
    if (!previousStep) return { value: '', resolved: true }
    const value = previousStep[field]
    return { value: value == null ? '' : String(value), resolved: true }
  }

  // step<N>.<field> or steps[<N>].<field>
  const stepMatch = lower.match(/^(?:step(\d+)|steps\[(\d+)\])(?:\.(output|input|task|status|error))?$/)
  if (stepMatch) {
    const oneBasedIndex = Number(stepMatch[1] ?? stepMatch[2])
    const field = (stepMatch[3] ?? 'output') as keyof RunIfStepValue
    if (!Number.isFinite(oneBasedIndex) || oneBasedIndex < 1) return { value: '', resolved: true }
    const referencedStep = previousSteps[oneBasedIndex - 1]
    if (!referencedStep) return { value: '', resolved: true }
    const value = referencedStep[field]
    return { value: value == null ? '' : String(value), resolved: true }
  }

  return { value: '', resolved: false }
}

function compareValues(left: string, op: string, right: string): boolean {
  const leftNum = Number(left)
  const rightNum = Number(right)
  const numeric = Number.isFinite(leftNum) && Number.isFinite(rightNum) && left.trim() !== '' && right.trim() !== ''

  switch (op) {
    case '==':
      return numeric ? leftNum === rightNum : left === right
    case '!=':
      return numeric ? leftNum !== rightNum : left !== right
    case 'contains':
      return left.includes(right)
    case 'not contains':
      return !left.includes(right)
    case 'matches': {
      const literal = right.match(REGEX_LITERAL_PATTERN)
      const pattern = literal ? literal[1] : right
      const flags = literal ? literal[2] : ''
      try {
        return new RegExp(pattern, flags).test(left)
      } catch (error) {
        throw new RunIfParseError(`Invalid regex in 'matches' clause: ${(error as Error).message}`)
      }
    }
    default:
      throw new RunIfParseError(`Unknown operator '${op}'`)
  }
}

function evaluateUnary(value: string, suffix: string): boolean {
  const normalized = suffix.toLowerCase()
  switch (normalized) {
    case 'is empty':
      return value === ''
    case 'is not empty':
      return value !== ''
    case 'is truthy':
      return value !== '' && value !== '0' && value.toLowerCase() !== 'false'
    case 'is falsy':
      return value === '' || value === '0' || value.toLowerCase() === 'false'
    default:
      throw new RunIfParseError(`Unknown unary suffix '${suffix}'`)
  }
}

function findUnaryOperator(input: string): { suffix: string; index: number } | undefined {
  const lower = input.toLowerCase()
  for (const suffix of UNARY_SUFFIXES) {
    const index = lower.lastIndexOf(suffix)
    if (index >= 0 && index + suffix.length === lower.length) {
      return { suffix, index }
    }
  }
  return undefined
}

function findBinaryOperator(input: string): { op: string; index: number } | undefined {
  const lower = input.toLowerCase()
  let best: { op: string; index: number } | undefined
  for (const op of BINARY_OPERATORS) {
    const isAlphabetic = /^[a-z]/.test(op)
    let searchFrom = 0
    while (searchFrom <= lower.length) {
      const index = lower.indexOf(op, searchFrom)
      if (index < 0) break
      const before = index > 0 ? lower[index - 1] : ' '
      const after = index + op.length < lower.length ? lower[index + op.length] : ' '
      const validBoundary = !isAlphabetic
        || (!/[a-z0-9_]/.test(before) && !/[a-z0-9_]/.test(after))
      if (validBoundary && (!best || index < best.index)) {
        best = { op, index }
      }
      searchFrom = index + op.length
    }
  }
  return best
}

function evaluateClause(
  clause: string,
  previousSteps: RunIfStepValue[],
  variables: Record<string, string>,
): { passed: boolean; reason: string } {
  const trimmed = clause.trim()
  if (!trimmed) throw new RunIfParseError('Empty condition clause')

  const unary = findUnaryOperator(trimmed)
  if (unary) {
    const leftRaw = trimmed.slice(0, unary.index).trim()
    if (!leftRaw) throw new RunIfParseError(`Missing operand before '${unary.suffix}'`)
    const left = tryResolveAtom(leftRaw, previousSteps, variables)
    const passed = evaluateUnary(left.value, unary.suffix)
    return {
      passed,
      reason: passed ? '' : `${leftRaw} ${unary.suffix}`,
    }
  }

  const binary = findBinaryOperator(trimmed)
  if (binary) {
    const leftRaw = trimmed.slice(0, binary.index).trim()
    const rightRaw = trimmed.slice(binary.index + binary.op.length).trim()
    if (!leftRaw || !rightRaw) throw new RunIfParseError(`Operator '${binary.op}' is missing an operand`)
    const left = tryResolveAtom(leftRaw, previousSteps, variables)
    const right = tryResolveAtom(rightRaw, previousSteps, variables)
    const passed = compareValues(left.value, binary.op, right.value)
    return {
      passed,
      reason: passed ? '' : `${leftRaw} ${binary.op} ${rightRaw}`,
    }
  }

  // Bare reference: treat as `<atom> is truthy`.
  const left = tryResolveAtom(trimmed, previousSteps, variables)
  if (!left.resolved) {
    throw new RunIfParseError(`Unrecognized expression '${trimmed}'`)
  }
  const passed = evaluateUnary(left.value, 'is truthy')
  return {
    passed,
    reason: passed ? '' : `${trimmed} is falsy`,
  }
}

export function evaluateRunIf(
  expression: string | undefined,
  previousSteps: RunIfStepValue[],
  variables: Record<string, string> = {},
): EvaluateRunIfResult {
  const trimmed = expression?.trim()
  if (!trimmed) return { passed: true }

  const clauses = trimmed.split(/&&/).map((clause) => clause.trim()).filter(Boolean)
  if (clauses.length === 0) return { passed: true }

  const failedReasons: string[] = []
  for (const clause of clauses) {
    const result = evaluateClause(clause, previousSteps, variables)
    if (!result.passed) failedReasons.push(result.reason)
  }

  if (failedReasons.length === 0) return { passed: true }
  return { passed: false, reason: `Condition not met: ${failedReasons.join('; ')}` }
}

/**
 * Parse-only check used by validation. Returns `null` when the expression is
 * syntactically valid (or empty), otherwise an error message.
 */
export function validateRunIfSyntax(expression: string | undefined): string | null {
  const trimmed = expression?.trim()
  if (!trimmed) return null

  const clauses = trimmed.split(/&&/).map((clause) => clause.trim()).filter(Boolean)
  if (clauses.length === 0) return 'Condition is empty'

  // Build a stub set of "previous steps" wide enough to satisfy any
  // step<N> reference (use a single dummy step; resolution failures only
  // matter for unrecognized references, which we surface separately).
  const dummyStep: RunIfStepValue = {
    stepIndex: 0,
    agentId: '',
    task: '',
    input: '',
    output: '',
    status: 'success',
    error: '',
  }

  for (const clause of clauses) {
    try {
      evaluateClause(clause, [dummyStep], {})
    } catch (error) {
      if (error instanceof RunIfParseError) return error.message
      return (error as Error).message
    }
  }

  return null
}

/**
 * Extract `vars.NAME` references mentioned in an expression or templated
 * task string. Useful for validating that all referenced variables are
 * declared on the pipeline.
 */
export function extractVariableReferences(input: string | undefined): string[] {
  if (!input) return []
  const matches = new Set<string>()
  const pattern = /vars\.([A-Za-z_][A-Za-z0-9_]*)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(input)) !== null) {
    matches.add(match[1])
  }
  return Array.from(matches)
}
