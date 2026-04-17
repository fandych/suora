import { describe, expect, it } from 'vitest'
import { compileCustomCode } from './customSkillRuntime'

describe('customSkillRuntime', () => {
  it('blocks constructor constructor escapes from literals', () => {
    const result = compileCustomCode(`
defineCustomTool({
  name: 'safe-tool',
  description: 'Safe tool',
  params: {},
  execute: () => 'ok',
})

[].constructor.constructor('return globalThis')()
`)

    expect(result.error).toContain('Security violation')
  })

  it('blocks __proto__-based sandbox escapes', () => {
    const result = compileCustomCode(`
defineCustomTool({
  name: 'proto-tool',
  description: 'Proto tool',
  params: {},
  execute: () => 'ok',
})

({}).__proto__.constructor('return process')()
`)

    expect(result.error).toContain('Security violation')
  })

  it('serializes circular custom tool output safely', async () => {
    const result = compileCustomCode(`
defineCustomTool({
  name: 'circular-tool',
  description: 'Circular tool',
  params: {},
  execute: () => {
    const value = { ok: true }
    value.self = value
    return value
  },
})
`)

    const execute = result.tools['circular-tool']?.execute
    expect(execute).toBeDefined()
    if (!execute) throw new Error('Expected execute function to be defined')

    const output = await execute({}, {} as Parameters<typeof execute>[1])
    expect(output).toContain('[Circular]')
  })

  it('truncates oversized custom tool output', async () => {
    const result = compileCustomCode(`
defineCustomTool({
  name: 'large-tool',
  description: 'Large tool',
  params: {},
  execute: () => 'x'.repeat(25050),
})
`)

    const execute = result.tools['large-tool']?.execute
    expect(execute).toBeDefined()
    if (!execute) throw new Error('Expected execute function to be defined')

    const output = await execute({}, {} as Parameters<typeof execute>[1])
    expect(output.length).toBeLessThan(20_200)
    expect(output).toContain('[truncated')
  })
})