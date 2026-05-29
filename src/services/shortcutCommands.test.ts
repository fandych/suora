import { describe, expect, it } from 'vitest'
import { buildShortcutCommandPrompt, parseShortcutCommand } from './shortcutCommands'

describe('shortcutCommands', () => {
  it('parses resource/action slash commands', () => {
    expect(parseShortcutCommand('/pipeline create daily report')).toMatchObject({
      domain: 'pipeline',
      action: 'create',
      request: 'daily report',
      agentId: 'builtin-pipeline-builder',
    })

    expect(parseShortcutCommand('/timer delete standup reminder')).toMatchObject({
      domain: 'timer',
      action: 'delete',
      request: 'standup reminder',
      agentId: 'builtin-timer-builder',
    })

    expect(parseShortcutCommand('/channel update Feishu alerts')).toMatchObject({
      domain: 'channel',
      action: 'update',
      request: 'Feishu alerts',
      agentId: 'builtin-channel-builder',
    })

    expect(parseShortcutCommand('/document new launch plan')).toMatchObject({
      domain: 'document',
      action: 'create',
      request: 'launch plan',
      agentId: 'builtin-document-editor',
    })
  })

  it('ignores unsupported slash commands so legacy handlers can process them', () => {
    expect(parseShortcutCommand('/pipeline run Morning Pipeline')).toBeNull()
    expect(parseShortcutCommand('/pipeline status')).toBeNull()
    expect(parseShortcutCommand('/unknown create thing')).toBeNull()
  })

  it('builds a routing prompt for the specialized agent', () => {
    const command = parseShortcutCommand('/pipeline create daily report')
    if (!command) throw new Error('Expected shortcut command to parse')
    const prompt = buildShortcutCommandPrompt(command)

    expect(prompt).toContain('"/pipeline create daily report"')
    expect(prompt).toContain('Resource: pipeline')
    expect(prompt).toContain('Action: create')
    expect(prompt).toContain('daily report')
  })
})
