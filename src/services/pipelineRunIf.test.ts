import { describe, expect, it } from 'vitest'
import { evaluateRunIf, extractVariableReferences, validateRunIfSyntax } from './pipelineRunIf'
import type { RunIfStepValue } from './pipelineRunIf'

const successStep: RunIfStepValue = {
  stepIndex: 0,
  agentId: 'agent-1',
  task: 'Draft',
  input: '',
  output: 'all good — approved',
  status: 'success',
  error: '',
}

const errorStep: RunIfStepValue = {
  stepIndex: 1,
  agentId: 'agent-2',
  task: 'Review',
  input: '',
  output: undefined,
  status: 'error',
  error: 'boom',
}

describe('pipelineRunIf', () => {
  it('returns passed=true for empty/missing expressions', () => {
    expect(evaluateRunIf(undefined, [successStep]).passed).toBe(true)
    expect(evaluateRunIf('', [successStep]).passed).toBe(true)
    expect(evaluateRunIf('   ', [successStep]).passed).toBe(true)
  })

  it('evaluates equality on step status', () => {
    expect(evaluateRunIf("step1.status == 'success'", [successStep]).passed).toBe(true)
    expect(evaluateRunIf("step1.status == 'error'", [successStep]).passed).toBe(false)
  })

  it('supports the previous alias', () => {
    expect(evaluateRunIf("previous.status == 'success'", [successStep]).passed).toBe(true)
    expect(evaluateRunIf("last.status != 'success'", [successStep]).passed).toBe(false)
  })

  it('supports contains and not contains', () => {
    expect(evaluateRunIf("step1.output contains 'approved'", [successStep]).passed).toBe(true)
    expect(evaluateRunIf("step1.output not contains 'rejected'", [successStep]).passed).toBe(true)
    expect(evaluateRunIf("step1.output contains 'rejected'", [successStep]).passed).toBe(false)
  })

  it('supports regex matches with optional flags', () => {
    expect(evaluateRunIf("step1.output matches '^all'", [successStep]).passed).toBe(true)
    expect(evaluateRunIf("step1.output matches /APPROVED/i", [successStep]).passed).toBe(true)
    expect(evaluateRunIf("step1.output matches '^nope'", [successStep]).passed).toBe(false)
  })

  it('supports unary "is empty" / "is not empty"', () => {
    expect(evaluateRunIf('step1.error is empty', [successStep]).passed).toBe(true)
    expect(evaluateRunIf('step2.error is not empty', [successStep, errorStep]).passed).toBe(true)
  })

  it('resolves vars references with string values', () => {
    expect(evaluateRunIf("vars.mode == 'live'", [successStep], { mode: 'live' }).passed).toBe(true)
    expect(evaluateRunIf("vars.mode == 'live'", [successStep], { mode: 'dry-run' }).passed).toBe(false)
    expect(evaluateRunIf('vars.threshold == 5', [successStep], { threshold: '5' }).passed).toBe(true)
  })

  it('combines clauses with &&', () => {
    expect(
      evaluateRunIf("step1.status == 'success' && step1.output contains 'approved'", [successStep]).passed,
    ).toBe(true)
    expect(
      evaluateRunIf("step1.status == 'success' && step1.output contains 'rejected'", [successStep]).passed,
    ).toBe(false)
  })

  it('returns a reason describing the failed clause', () => {
    const result = evaluateRunIf("step1.status == 'error'", [successStep])
    expect(result.passed).toBe(false)
    expect(result.reason).toMatch(/Condition not met/)
    expect(result.reason).toContain("step1.status == 'error'")
  })

  it('treats a bare reference as an "is truthy" check', () => {
    expect(evaluateRunIf('step1.output', [successStep]).passed).toBe(true)
    expect(evaluateRunIf('step2.output', [successStep, errorStep]).passed).toBe(false)
  })

  it('throws RunIfParseError on malformed expressions', () => {
    expect(() => evaluateRunIf('==', [successStep])).toThrow()
    expect(() => evaluateRunIf("step1.output matches '['", [successStep])).toThrow(/regex/i)
  })
})

describe('validateRunIfSyntax', () => {
  it('returns null for valid expressions', () => {
    expect(validateRunIfSyntax(undefined)).toBeNull()
    expect(validateRunIfSyntax("step1.status == 'success'")).toBeNull()
    expect(validateRunIfSyntax("vars.x is not empty")).toBeNull()
    expect(validateRunIfSyntax("previous.output contains 'ok' && step1.error is empty")).toBeNull()
  })

  it('returns an error message for invalid expressions', () => {
    expect(validateRunIfSyntax('==')).toBeTruthy()
    expect(validateRunIfSyntax("foo bar baz")).toBeTruthy()
  })
})

describe('extractVariableReferences', () => {
  it('returns the unique set of vars.NAME references', () => {
    expect(extractVariableReferences("Use {{vars.mode}} and {{vars.threshold}} and vars.mode again"))
      .toEqual(['mode', 'threshold'])
    expect(extractVariableReferences(undefined)).toEqual([])
    expect(extractVariableReferences('no references')).toEqual([])
  })
})
