import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventTrigger } from '@/types'
import { fireFileChangeEvent, saveTriggers, startEventMonitor, stopEventMonitor } from './eventAutomation'

function trigger(overrides: Partial<EventTrigger>): EventTrigger {
  return {
    id: 'evt-1',
    name: 'Trigger',
    type: 'app_start',
    agentId: 'agent-1',
    promptTemplate: 'Run task',
    enabled: true,
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('eventAutomation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-26T00:00:00.000Z'))
    saveTriggers([])
  })

  afterEach(() => {
    stopEventMonitor()
    saveTriggers([])
    vi.useRealTimers()
  })

  it('fires app_start triggers without clearing the registered handler', () => {
    const onEvent = vi.fn()
    saveTriggers([trigger({ type: 'app_start' })])

    startEventMonitor(onEvent)

    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'evt-1' }), { event: 'app_start' })
  })

  it('routes matching file_change triggers after the monitor starts', () => {
    const onEvent = vi.fn()
    saveTriggers([trigger({ type: 'file_change', pattern: '*.md' })])

    startEventMonitor(onEvent)
    fireFileChangeEvent('notes/today.md', '# Today')
    fireFileChangeEvent('notes/today.txt', 'ignored')

    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'file_change' }), {
      file: 'notes/today.md',
      content: '# Today',
    })
  })

  it('keeps single-star file globs within one path segment', () => {
    const onEvent = vi.fn()
    saveTriggers([
      trigger({ id: 'direct-md', type: 'file_change', pattern: 'docs/*.md' }),
      trigger({ id: 'nested-md', type: 'file_change', pattern: 'docs/**/*.md' }),
    ])

    startEventMonitor(onEvent)
    fireFileChangeEvent('docs/overview.md', '# Overview')
    fireFileChangeEvent('docs/nested/deep.md', '# Deep')

    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'direct-md' }), expect.objectContaining({
      file: 'docs/overview.md',
    }))
    expect(onEvent).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'direct-md' }), expect.objectContaining({
      file: 'docs/nested/deep.md',
    }))
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'nested-md' }), expect.objectContaining({
      file: 'docs/nested/deep.md',
    }))
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'nested-md' }), expect.objectContaining({
      file: 'docs/overview.md',
    }))
  })

  it('fires due schedule triggers on the scheduler tick', () => {
    const onEvent = vi.fn()
    saveTriggers([trigger({ type: 'schedule', pattern: '* * * * *', createdAt: Date.now() })])

    startEventMonitor(onEvent)
    vi.advanceTimersByTime(60_000)

    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'schedule' }), expect.objectContaining({
      event: 'schedule',
      schedule: '* * * * *',
    }))
  })
})