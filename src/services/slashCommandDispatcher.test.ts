import { describe, expect, it } from 'vitest'
import { buildSlashCommandHelp, dispatchSlashCommand, formatSlashMessage } from './slashCommandDispatcher'
import { setI18nLocale } from './i18n'

describe('slashCommandDispatcher', () => {
  it('prefers chat-control commands over builder shortcuts', () => {
    const result = dispatchSlashCommand('/agent use Research Agent')
    expect(result?.kind).toBe('control')
    if (result?.kind === 'control') {
      expect(result.command).toMatchObject({ type: 'agent', reference: 'Research Agent' })
    }
  })

  it('routes builder-style commands to the shortcut parser', () => {
    const result = dispatchSlashCommand('/pipeline create daily report')
    expect(result?.kind).toBe('shortcut')
    if (result?.kind === 'shortcut') {
      expect(result.command).toMatchObject({
        domain: 'pipeline',
        action: 'create',
        request: 'daily report',
      })
    }
  })

  it('parses /help via the control parser', () => {
    const result = dispatchSlashCommand('/help')
    expect(result?.kind).toBe('control')
    if (result?.kind === 'control') {
      expect(result.command.type).toBe('help')
    }
  })

  it('returns null for non-slash input', () => {
    expect(dispatchSlashCommand('hello world')).toBeNull()
    expect(dispatchSlashCommand('/totally-unknown action thing')).toBeNull()
  })

  it('renders i18n messages with substitution', () => {
    setI18nLocale('en')
    expect(formatSlashMessage('slash.modelSwitched', { name: 'GPT' })).toBe('Switched model to GPT.')
    setI18nLocale('zh')
    expect(formatSlashMessage('slash.modelSwitched', { name: 'GPT' })).toBe('已切换模型：GPT')
    setI18nLocale('en')
  })

  it('builds a help string covering controls and shortcuts', () => {
    setI18nLocale('en')
    const help = buildSlashCommandHelp()
    expect(help).toContain('/clear')
    expect(help).toContain('/model use')
    expect(help).toContain('/agent use')
    for (const domain of ['agent', 'channel', 'document', 'pipeline', 'timer']) {
      expect(help).toContain(`/${domain}`)
    }
  })
})
