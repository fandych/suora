import { describe, expect, it } from 'vitest'
import {
  detectNaturalPipelineChatCommand,
  looksLikePipelineChatCommand,
  parseSlashPipelineChatCommand,
  resolvePipelineChatCommandFromText,
} from './pipelineChatCommands'

const pipelines = [
  { id: 'pipeline-1', name: 'Morning Run' },
  { id: 'pipeline-2', name: '日报汇总' },
]

describe('pipelineChatCommands', () => {
  it('parses slash commands for listing pipelines', () => {
    expect(parseSlashPipelineChatCommand('/pipeline list')).toEqual({ type: 'list' })
    expect(parseSlashPipelineChatCommand('/pipeline')).toEqual({ type: 'list' })
    expect(parseSlashPipelineChatCommand('/workflow catalog')).toEqual({ type: 'list' })
  })

  it('parses slash commands with explicit run verbs and workflow aliases', () => {
    expect(parseSlashPipelineChatCommand('/pipeline run Morning Run')).toEqual({
      type: 'run',
      reference: 'Morning Run',
    })
    expect(parseSlashPipelineChatCommand('/workflow execute 日报汇总')).toEqual({
      type: 'run',
      reference: '日报汇总',
    })
  })

  it('parses help, cancel, status, and history slash commands', () => {
    expect(parseSlashPipelineChatCommand('/pipeline help')).toEqual({ type: 'help' })
    expect(parseSlashPipelineChatCommand('/workflow ?')).toEqual({ type: 'help' })
    expect(parseSlashPipelineChatCommand('/pipeline cancel')).toEqual({ type: 'cancel' })
    expect(parseSlashPipelineChatCommand('/pipeline status')).toEqual({ type: 'status' })
    expect(parseSlashPipelineChatCommand('/pipeline history')).toEqual({ type: 'history', reference: undefined })
    expect(parseSlashPipelineChatCommand('/pipeline history Morning Run')).toEqual({ type: 'history', reference: 'Morning Run' })
  })

  it('parses named args from slash pipeline runs', () => {
    expect(parseSlashPipelineChatCommand('/pipeline run Morning Run env=staging dryRun=true')).toEqual({
      type: 'run',
      reference: 'Morning Run',
      args: { env: 'staging', dryRun: 'true' },
    })
  })

  it('detects english natural-language pipeline execution requests', () => {
    expect(detectNaturalPipelineChatCommand('Please run pipeline Morning Run for me', pipelines)).toEqual({
      type: 'run',
      reference: 'Morning Run',
    })
  })

  it('detects chinese natural-language pipeline execution requests', () => {
    expect(resolvePipelineChatCommandFromText('帮我执行日报汇总', pipelines)).toEqual({
      type: 'run',
      reference: '日报汇总',
    })
  })

  it('detects natural-language pipeline listing requests', () => {
    expect(detectNaturalPipelineChatCommand('有哪些流水线可以运行？', pipelines)).toEqual({ type: 'list' })
  })

  it('does not hijack general pipeline discussion', () => {
    expect(looksLikePipelineChatCommand('Explain the pipeline architecture to me')).toBe(true)
    expect(detectNaturalPipelineChatCommand('Explain the pipeline architecture to me', pipelines)).toBeNull()
  })

  it('does not run mentioned pipeline names without an action', () => {
    expect(detectNaturalPipelineChatCommand('Morning Run status looks important', pipelines)).toBeNull()
  })
})
