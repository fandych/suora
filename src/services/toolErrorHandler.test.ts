import { describe, expect, it } from 'vitest'
import { buildToolErrorMemoryDraft, classifyToolError } from './toolErrorHandler'

describe('toolErrorHandler', () => {
  it.each([
    ['Cancelled by user confirmation policy.', 'cancelled', false],
    ['Path blocked: /private/file is outside allowed directories', 'path', false],
    ['Permission denied by sandbox policy', 'permission', false],
    ['Tool "env_manage" is already running and does not support concurrent execution.', 'concurrency', true],
    ['Invalid tool input: required field path is missing', 'validation', false],
    ['ENOENT: no such file or directory', 'not-found', false],
    ['Tool call timed out after 30000ms', 'timeout', true],
    ['Network error: failed to fetch', 'network', true],
    ['Unauthorized: API key returned 401', 'auth', false],
    ['Rate limit exceeded: 429 too many requests', 'rate-limit', true],
    ['Error: failed to execute tool', 'execution', false],
    ['Unexpected response shape', 'unknown', false],
  ] as const)('classifies %s as %s', (error, category, retryable) => {
    expect(classifyToolError({
      toolName: 'read_file',
      sessionId: 'session-1',
      error,
    })).toMatchObject({ category, retryable })
  })

  it('routes skill, agent, session, and global scoped errors', () => {
    expect(classifyToolError({
      toolName: 'skill_reload',
      skillIds: ['skill-1'],
      error: 'Error: failed',
    })).toMatchObject({ scope: 'skill', targetId: 'skill-1' })

    expect(classifyToolError({
      toolName: 'agent_delegate',
      agentId: 'agent-1',
      error: 'Error: failed',
    })).toMatchObject({ scope: 'agent', targetId: 'agent-1' })

    expect(classifyToolError({
      toolName: 'read_file',
      sessionId: 'session-1',
      agentId: 'agent-1',
      error: 'Invalid tool input: missing path',
    })).toMatchObject({ scope: 'session', targetId: 'session-1' })

    const global = classifyToolError({
      toolName: 'fetch_webpage',
      error: 'Error: failed',
    })
    expect(global.scope).toBe('global')
    expect(global).not.toHaveProperty('targetId')
  })

  it('normalizes volatile error details into stable fingerprints', () => {
    const first = classifyToolError({
      toolName: 'read_file',
      sessionId: 'session-1',
      error: 'ENOENT: missing file /tmp/session-123/file-456.txt at line 99',
    })
    const second = classifyToolError({
      toolName: 'read_file',
      sessionId: 'session-1',
      error: 'ENOENT: missing file /tmp/session-789/file-999.txt at line 101',
    })

    expect(first.fingerprint).toBe(second.fingerprint)
  })

  it('includes trace metadata in memory content and tags', () => {
    const draft = buildToolErrorMemoryDraft({
      toolName: 'read_file',
      toolCallId: 'tool-call-1',
      sessionId: 'session-1',
      source: 'chat-stream',
      input: { path: '/outside/file.txt' },
      error: 'Path blocked: /outside/file.txt',
      durationMs: 42,
      errorSource: 'returned',
    })

    expect(draft.content).toContain('Tool call id: tool-call-1')
    expect(draft.content).toContain('Source: chat-stream')
    expect(draft.content).toContain('Duration: 42ms')
    expect(draft.content).toContain('Input keys: path')
    expect(draft.tags).toEqual(expect.arrayContaining([
      'source:chat-stream',
      'tool-call:tool-call-1',
    ]))
  })
})
