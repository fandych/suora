import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store/appStore'
import type { AgentPipeline } from '@/types'
import { grantPermissions, registerPluginTools, revokePermissions, unregisterPluginTools } from '@/services/pluginSystem'

vi.mock('@/services/aiService', () => ({
  generateResponse: vi.fn(),
  initializeProvider: vi.fn(),
  streamResponseWithTools: vi.fn(),
}))

vi.mock('@/services/pipelineFiles', () => ({
  appendPipelineExecutionToDisk: vi.fn().mockResolvedValue(true),
  loadPipelinesFromDisk: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/services/fileStorage', async () => {
  const actual = await vi.importActual<typeof import('@/services/fileStorage')>('@/services/fileStorage')
  return {
    ...actual,
    flushPendingSplitStoreWrites: vi.fn().mockResolvedValue(undefined),
  }
})

import { generateResponse, initializeProvider, streamResponseWithTools } from '@/services/aiService'
import { flushPendingSplitStoreWrites } from '@/services/fileStorage'
import { appendPipelineExecutionToDisk, loadPipelinesFromDisk } from '@/services/pipelineFiles'
import { dryRunAgentPipeline, executeAgentPipeline, executePipelineById, executePipelineByReference } from './agentPipelineService'

const savedPipeline: AgentPipeline = {
  id: 'pipeline-1',
  name: 'Morning Run',
  steps: [
    { agentId: 'agent-1', task: 'Draft the report' },
    { agentId: 'agent-2', task: 'Review the report' },
  ],
  createdAt: 1,
  updatedAt: 2,
}

const nestedPipeline: AgentPipeline = {
  id: 'pipeline-2',
  name: 'Nested Review',
  steps: [
    { agentId: 'agent-1', task: 'Draft nested update' },
    { agentId: 'agent-2', task: 'Review nested update' },
  ],
  createdAt: 1,
  updatedAt: 2,
}

const iterationTemplatePipeline: AgentPipeline = {
  id: 'pipeline-iteration-template',
  name: 'Iteration Template Child',
  steps: [
    { agentId: 'agent-1', task: 'Render child output', nodeType: 'template', templateBody: '{{ vars.record }}-{{ vars.position }}' },
  ],
  createdAt: 1,
  updatedAt: 2,
}

const iterationCodePipeline: AgentPipeline = {
  id: 'pipeline-iteration-code',
  name: 'Iteration Code Child',
  steps: [
    { agentId: 'agent-1', task: 'Transform item', nodeType: 'code', codeOutputSchema: 'result', codeSource: 'function main(inputs) { if (inputs.vars.record === "bad") throw new Error("bad item"); return { result: String(inputs.vars.record).toUpperCase() }; }' },
  ],
  createdAt: 1,
  updatedAt: 2,
}

describe('agentPipelineService', () => {
  beforeEach(() => {
    vi.mocked(generateResponse).mockReset()
    vi.mocked(initializeProvider).mockReset()
    vi.mocked(streamResponseWithTools).mockReset()
    vi.mocked(appendPipelineExecutionToDisk).mockClear()
    vi.mocked(loadPipelinesFromDisk).mockReset()
    vi.mocked(flushPendingSplitStoreWrites).mockClear()

    useAppStore.setState({
      workspacePath: 'C:/workspace',
      models: [
        { id: 'model-1', name: 'GPT', provider: 'provider-1', providerType: 'openai', modelId: 'gpt-4.1', enabled: true, isDefault: true },
        { id: 'model-cheap', name: 'GPT mini', provider: 'provider-1', providerType: 'openai', modelId: 'gpt-4.1-mini', enabled: true },
      ],
      agents: [
        { id: 'agent-1', name: 'Writer', systemPrompt: 'Write', modelId: 'model-1', skills: [], enabled: true, memories: [], autoLearn: false },
        { id: 'agent-2', name: 'Reviewer', systemPrompt: 'Review', modelId: 'model-1', skills: [], enabled: true, memories: [], autoLearn: false },
      ],
      agentPipelines: [savedPipeline, nestedPipeline, iterationTemplatePipeline, iterationCodePipeline],
      channels: [{
        id: 'channel-1',
        name: 'Support Webhook',
        platform: 'custom',
        enabled: true,
        status: 'active',
        connectionMode: 'webhook',
        webhookPath: '/webhook/support',
        customWebhookUrl: 'https://hooks.example.com/support',
        autoReply: false,
        replyAgentId: 'agent-1',
        createdAt: 1,
        messageCount: 0,
      }],
      documentGroups: [
        { id: 'kb-1', name: 'Knowledge Base', color: '#0ea5e9', createdAt: 1, updatedAt: 1 },
        { id: 'kb-2', name: 'Runbooks', color: '#22c55e', createdAt: 1, updatedAt: 1 },
      ],
      documentNodes: [
        { id: 'doc-1', groupId: 'kb-1', parentId: null, type: 'document', title: 'Release Plan', markdown: '# Release Plan\n\nlaunch checklist', createdAt: 1, updatedAt: 1 },
        { id: 'doc-2', groupId: 'kb-2', parentId: null, type: 'document', title: 'Launch Runbook', markdown: '---\ntags: [runbook, launch]\n---\n\n# Launch Runbook\n\nlaunch rollback steps', createdAt: 1, updatedAt: 1 },
      ],
      installedPlugins: [
        { id: 'ticketManagement', name: 'Ticket Management', version: '1.0.0', author: 'test', description: 'Fixture toolset', status: 'enabled', hooks: [], config: {}, installedAt: 1, permissions: ['tools:register'] },
        { id: 'issueManagement', name: 'Issue Management', version: '1.0.0', author: 'test', description: 'Conflicting fixture toolset', status: 'enabled', hooks: [], config: {}, installedAt: 1, permissions: ['tools:register'] },
      ],
      pluginTools: { ticketManagement: ['getTickets', 'lookup'], issueManagement: ['lookup'] },
      notifications: [],
    })

    grantPermissions('ticketManagement', ['tools:register'])
    grantPermissions('issueManagement', ['tools:register'])
    registerPluginTools('ticketManagement', {
      // @ts-expect-error test helper tool set
      getTickets: { execute: async () => ({ tickets: ['ticket-1', 'ticket-2'] }) },
      // @ts-expect-error test helper tool set
      lookup: { execute: async () => ({ source: 'tickets' }) },
    })
    registerPluginTools('issueManagement', {
      // @ts-expect-error test helper tool set
      lookup: { execute: async () => ({ source: 'issues' }) },
    })
  })

  afterEach(() => {
    unregisterPluginTools('ticketManagement')
    unregisterPluginTools('issueManagement')
    revokePermissions('ticketManagement')
    revokePermissions('issueManagement')
  })

  it('executes a saved pipeline and records execution history', async () => {
    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'draft-ready' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'review-ready' }
      })

    const execution = await executeAgentPipeline(savedPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps).toHaveLength(2)
    expect(execution.finalOutput).toBe('review-ready')
    expect(execution.steps[1].input).toContain('draft-ready')
    expect(initializeProvider).toHaveBeenCalledTimes(1)
    expect(appendPipelineExecutionToDisk).toHaveBeenCalledTimes(1)
    expect(flushPendingSplitStoreWrites).toHaveBeenCalledTimes(1)
    expect(useAppStore.getState().agentPipelines[0].lastRunAt).toBeDefined()
  })

  it('resolves explicit step output references before executing downstream steps', async () => {
    const referencedPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Draft the report' },
        { agentId: 'agent-2', task: 'Review this exact draft:\n{{steps[1].output}}' },
      ],
    }

    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'draft-ready' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'review-ready' }
      })

    const execution = await executeAgentPipeline(referencedPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[1].input).toContain('Review this exact draft:\ndraft-ready')
    expect(execution.steps[1].input).not.toContain('Previous step output:')
  })

  it('retries a failed step before marking it successful', async () => {
    const retryPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Draft the report', retryCount: 1 },
      ],
    }

    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'error', error: 'temporary outage' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'draft-ready' }
      })

    const execution = await executeAgentPipeline(retryPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[0].attempts).toBe(2)
    expect(execution.steps[0].output).toBe('draft-ready')
    expect(streamResponseWithTools).toHaveBeenCalledTimes(2)
  })

  it('skips disabled steps without breaking downstream handoff context', async () => {
    const disabledStepPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Draft the report' },
        { agentId: 'agent-2', task: 'Review the report', enabled: false },
        { agentId: 'agent-2', task: 'Summarize the latest usable result' },
      ],
    }

    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'draft-ready' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'summary-ready' }
      })

    const execution = await executeAgentPipeline(disabledStepPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[1].status).toBe('skipped')
    expect(execution.steps[2].input).toContain('draft-ready')
    expect(execution.finalOutput).toBe('summary-ready')
  })

  it('executes structural nodes without calling the model', async () => {
    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: 'draft-ready' }
    })

    const execution = await executeAgentPipeline({
      id: 'pipeline-structural',
      name: 'Structural Run',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { agentId: 'agent-1', task: '', nodeType: 'parallel', parallelBranches: 3 },
        { agentId: 'agent-1', task: 'Draft in branch', nodeType: 'agent' },
        { agentId: 'agent-1', task: '', nodeType: 'join', joinStrategy: 'merge-output' },
      ],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toContain('3 branches')
    expect(execution.steps[2].output).toContain('merge-output')
    expect(streamResponseWithTools).toHaveBeenCalledTimes(1)
  })

  it('executes start and end nodes as first-class workflow data nodes', async () => {
    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: 'draft-ready' }
    })

    const execution = await executeAgentPipeline({
      id: 'pipeline-boundaries',
      name: 'Boundary Flow',
      createdAt: 1,
      updatedAt: 2,
      variables: [{ name: 'topic', defaultValue: 'launch' }],
      steps: [
        { agentId: 'agent-1', task: '', nodeType: 'start', startParams: [{ key: 'topic', defaultValue: 'launch' }] },
        { agentId: 'agent-1', task: 'Draft the report for {{vars.topic}}', nodeType: 'agent' },
        { agentId: 'agent-1', task: '', nodeType: 'end', endOutputs: [{ key: 'result', value: '{{previous.output}}' }] },
      ],
    }, { variables: { topic: 'launch' } })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toContain('"topic": "launch"')
    expect(execution.steps[2].output).toContain('"result": "draft-ready"')
    expect(execution.finalOutput).toContain('"result": "draft-ready"')
  })

  it('follows explicit graph transitions and skips nodes outside the selected workflow path', async () => {
    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: 'graph-ready' }
    })

    const execution = await executeAgentPipeline({
      id: 'pipeline-graph-route',
      name: 'Graph Route',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { id: 'start', agentId: 'agent-1', task: '', nodeType: 'start', startParams: [{ key: 'topic', defaultValue: 'launch' }], transitions: [{ targetStepId: 'draft' }] },
        { id: 'orphan', agentId: 'agent-2', task: 'This step should be skipped' },
        { id: 'draft', agentId: 'agent-1', task: 'Draft the graph output', transitions: [{ targetStepId: 'end' }] },
        { id: 'end', agentId: 'agent-1', task: '', nodeType: 'end', endOutputs: [{ key: 'result', value: '{{previous.output}}' }] },
      ],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps.find((step) => step.stepIndex === 2)?.status).toBe('success')
    expect(execution.steps.find((step) => step.stepIndex === 1)?.status).toBe('skipped')
    expect(execution.finalOutput).toContain('graph-ready')
  })

  it('executes parallel branches and waits for a join node before continuing', async () => {
    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'branch-a' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'branch-b' }
      })

    const execution = await executeAgentPipeline({
      id: 'pipeline-parallel-graph',
      name: 'Parallel Graph',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { id: 'start', agentId: 'agent-1', task: '', nodeType: 'start', startParams: [{ key: 'topic', defaultValue: 'launch' }], transitions: [{ targetStepId: 'parallel' }] },
        { id: 'parallel', agentId: 'agent-1', task: '', nodeType: 'parallel', parallelBranches: 2, parallelJoinStrategy: 'all', transitions: [{ targetStepId: 'branch-a' }, { targetStepId: 'branch-b' }] },
        { id: 'branch-a', agentId: 'agent-1', task: 'Run branch A', transitions: [{ targetStepId: 'join' }] },
        { id: 'branch-b', agentId: 'agent-2', task: 'Run branch B', transitions: [{ targetStepId: 'join' }] },
        { id: 'join', agentId: 'agent-1', task: '', nodeType: 'join', joinStrategy: 'merge-output', transitions: [{ targetStepId: 'end' }] },
        { id: 'end', agentId: 'agent-1', task: '', nodeType: 'end', endOutputs: [{ key: 'result', value: '{{previous.output}}' }] },
      ],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps.find((step) => step.stepIndex === 2)?.output).toBe('branch-a')
    expect(execution.steps.find((step) => step.stepIndex === 3)?.output).toBe('branch-b')
    expect(execution.steps.find((step) => step.stepIndex === 4)?.output).toContain('merge-output')
    expect(execution.finalOutput).toContain('branch-a')
    expect(execution.finalOutput).toContain('branch-b')
  })

  it('keeps parallel sibling branch inputs anchored to the shared upstream source', async () => {
    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'branch-a' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'branch-b' }
      })

    const execution = await executeAgentPipeline({
      id: 'pipeline-parallel-context',
      name: 'Parallel Context',
      createdAt: 1,
      updatedAt: 2,
      variables: [{ name: 'topic', defaultValue: 'launch' }],
      steps: [
        { id: 'start', agentId: 'agent-1', task: '', nodeType: 'start', startParams: [{ key: 'topic', defaultValue: 'launch' }], transitions: [{ targetStepId: 'parallel' }] },
        { id: 'parallel', agentId: 'agent-1', task: '', nodeType: 'parallel', parallelBranches: 2, transitions: [{ targetStepId: 'branch-a' }, { targetStepId: 'branch-b' }] },
        { id: 'branch-a', agentId: 'agent-1', task: 'Use {{previous.output}} in branch A' },
        { id: 'branch-b', agentId: 'agent-2', task: 'Use {{previous.output}} in branch B' },
      ],
    })

    expect(execution.steps.find((step) => step.stepIndex === 2)?.input).toContain('"topic": "launch"')
    expect(execution.steps.find((step) => step.stepIndex === 3)?.input).toContain('"topic": "launch"')
    expect(execution.steps.find((step) => step.stepIndex === 3)?.input).not.toContain('branch-a')
  })

  it('executes nested pipeline nodes through the pipeline runtime instead of the current step agent', async () => {
    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'nested-draft' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'nested-review' }
      })

    const execution = await executeAgentPipeline({
      id: 'pipeline-parent',
      name: 'Parent Flow',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { agentId: 'agent-1', task: 'Delegate to nested flow', nodeType: 'pipeline', pipelineTargetId: 'pipeline-2' },
      ],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toBe('nested-review')
    expect(execution.steps[0].warnings?.[0]).toContain('Nested pipeline executed')
    expect(streamResponseWithTools).toHaveBeenCalledTimes(2)
  })

  it('executes http nodes through the desktop fetch bridge instead of the model runtime', async () => {
    vi.mocked(window.electron.invoke).mockImplementation(async (channel, ...args) => {
      if (channel === 'web:fetchText') {
        expect(args[0]).toBe('https://api.example.com/data')
        return { content: '{"ok":true}' }
      }
      return undefined
    })

    const execution = await executeAgentPipeline({
      id: 'pipeline-http',
      name: 'HTTP Flow',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { agentId: 'agent-1', task: 'Fetch data', nodeType: 'http', httpMethod: 'GET', httpUrl: 'https://api.example.com/data' },
      ],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toContain('{"ok":true}')
    expect(streamResponseWithTools).not.toHaveBeenCalled()
  })

  it('resolves toolset nodes against the selected toolset when multiple plugins expose the same tool name', async () => {
    const execution = await executeAgentPipeline({
      id: 'pipeline-toolset-precise-resolution',
      name: 'Toolset Precision',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { agentId: 'agent-1', task: 'Lookup issue', nodeType: 'toolset', toolsetId: 'issueManagement', toolName: 'lookup' },
      ],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toContain('issues')
    expect(execution.steps[0].output).not.toContain('tickets')
  })

  it('resolves template variables inside http node urls before invoking the fetch bridge', async () => {
    vi.mocked(window.electron.invoke).mockImplementation(async (channel, ...args) => {
      if (channel === 'web:fetchText') {
        expect(args[0]).toBe('https://api.example.com/reports/daily')
        return { content: 'report-ready' }
      }
      return undefined
    })

    const execution = await executeAgentPipeline({
      id: 'pipeline-http-templates',
      name: 'HTTP Templates',
      createdAt: 1,
      updatedAt: 2,
      variables: [{ name: 'slug', defaultValue: 'daily' }],
      steps: [
        { agentId: 'agent-1', task: 'Fetch data', nodeType: 'http', httpMethod: 'GET', httpUrl: 'https://api.example.com/reports/{{vars.slug}}' },
      ],
    }, { variables: { slug: 'daily' } })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toBe('report-ready')
  })

  it('serializes form request bodies and exposes split http response fields as downstream variables', async () => {
    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: 'http-vars-ready' }
    })
    vi.mocked(window.electron.invoke).mockImplementation(async (channel, ...args) => {
      if (channel === 'web:request') {
        expect(args[0]).toMatchObject({
          url: 'https://api.example.com/forms',
          method: 'POST',
          body: 'topic=launch&mode=full',
        })
        expect((args[0] as { headers?: Record<string, string> }).headers).toMatchObject({
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        })
        return {
          content: '{"accepted":true}',
          status: 202,
          headers: { 'x-trace-id': 'trace-1' },
        }
      }
      return undefined
    })

    const execution = await executeAgentPipeline({
      id: 'pipeline-http-response-vars',
      name: 'HTTP Response Vars',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        {
          agentId: 'agent-1',
          task: 'Send form payload',
          nodeType: 'http',
          httpMethod: 'POST',
          httpUrl: 'https://api.example.com/forms',
          httpBodyType: 'form',
          httpBody: 'topic=launch\nmode=full',
          httpSuccessStatuses: '202',
          httpResponseBodyVar: 'apiBody',
          httpResponseStatusVar: 'apiStatus',
          httpResponseHeadersVar: 'apiHeaders',
          httpResponseSizeVar: 'apiSize',
        },
        { agentId: 'agent-2', task: 'Use {{vars.apiStatus}} {{vars.apiSize}} {{vars.apiBody}} {{vars.apiHeaders}}' },
      ],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toContain('"status": 202')
    expect(execution.steps[0].output).toContain('"body": "{\\"accepted\\":true}"')
    expect(execution.steps[0].output).toContain('"size": 17')
    expect(execution.steps[1].input).toContain('202')
    expect(execution.steps[1].input).toContain('{"accepted":true}')
    expect(execution.steps[1].input).toContain('trace-1')
    expect(execution.steps[1].input).toContain('17')
  })

  it('executes script nodes through the shell bridge instead of the model runtime', async () => {
    vi.mocked(window.electron.invoke).mockImplementation(async (channel, ...args) => {
      if (channel === 'shell:exec') {
        expect(String(args[0])).toContain('node')
        return { stdout: 'script-complete', stderr: '' }
      }
      return undefined
    })

    const execution = await executeAgentPipeline({
      id: 'pipeline-script',
      name: 'Script Flow',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { agentId: 'agent-1', task: 'Run script', nodeType: 'script', scriptRuntime: 'javascript', scriptPath: 'scripts/run.js' },
      ],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toBe('script-complete')
    expect(streamResponseWithTools).not.toHaveBeenCalled()
  })

  it('executes email nodes through the global smtp bridge instead of the model runtime', async () => {
    useAppStore.setState({
      emailConfig: {
        smtpHost: 'smtp.example.com',
        smtpPort: 465,
        secure: true,
        username: 'bot@example.com',
        password: 'secret',
        fromName: 'Suora Bot',
        fromAddress: 'bot@example.com',
        enabled: true,
      },
    })
    vi.mocked(window.electron.invoke).mockImplementation(async (channel, ...args) => {
      if (channel === 'email:send') {
        expect(args[1]).toMatchObject({
          to: 'ops@example.com',
          subject: 'Pipeline alert',
        })
        return { success: true, messageId: 'msg-123' }
      }
      return undefined
    })

    const execution = await executeAgentPipeline({
      id: 'pipeline-email',
      name: 'Email Flow',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { agentId: 'agent-1', task: 'Send notification', nodeType: 'email', emailTo: 'ops@example.com', emailSubject: 'Pipeline alert' },
      ],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toContain('Email sent to ops@example.com')
    expect(streamResponseWithTools).not.toHaveBeenCalled()
  })

  it('executes webhook nodes through the generic request bridge', async () => {
    vi.mocked(window.electron.invoke).mockImplementation(async (channel, ...args) => {
      if (channel === 'web:request') {
        expect(args[0]).toMatchObject({ url: 'https://hooks.example.com/support', method: 'POST' })
        return { content: '{"accepted":true}', status: 200 }
      }
      return undefined
    })

    const execution = await executeAgentPipeline({
      id: 'pipeline-webhook',
      name: 'Webhook Flow',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { agentId: 'agent-1', task: 'Send webhook', nodeType: 'webhook', webhookChannelId: 'channel-1', webhookMethod: 'POST', webhookBody: '{"message":"hello"}' },
      ],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toContain('"status": 200')
    expect(execution.steps[0].output).toContain('"body": "{\\"accepted\\":true}"')
  })

  it('routes webhook failures through the explicit failure branch when an error edge is configured', async () => {
    vi.mocked(window.electron.invoke).mockImplementation(async (channel) => {
      if (channel === 'web:request') {
        return { content: 'upstream unavailable', status: 503, headers: { 'retry-after': '30' } }
      }
      return undefined
    })
    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: 'failure-handled' }
    })

    const execution = await executeAgentPipeline({
      id: 'pipeline-webhook-failure-branch',
      name: 'Webhook Failure Branch',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        {
          id: 'hook',
          agentId: 'agent-1',
          task: 'Send webhook',
          nodeType: 'webhook',
          webhookChannelId: 'channel-1',
          webhookMethod: 'POST',
          continueOnError: true,
          transitions: [
            { targetStepId: 'success' },
            { targetStepId: 'failure', sourceHandle: 'error', label: 'Failure' },
          ],
        },
        { id: 'success', agentId: 'agent-1', task: 'Continue success path' },
        { id: 'failure', agentId: 'agent-2', task: 'Handle webhook failure' },
      ],
    })

    const successBranch = execution.steps.find((step) => step.stepIndex === 1)
    const failureBranch = execution.steps.find((step) => step.stepIndex === 2)

    expect(execution.status).toBe('error')
    expect(execution.steps[0].status).toBe('error')
    expect(successBranch?.status).toBe('skipped')
    expect(failureBranch?.status).toBe('success')
    expect(failureBranch?.output).toBe('failure-handled')
    expect(execution.runtime?.visitedStepIndices).toEqual([0, 2])
  })

  it('queues http and webhook nodes asynchronously without waiting for a response body', async () => {
    vi.mocked(window.electron.invoke).mockImplementation(async (channel, ...args) => {
      if (channel === 'web:requestAsync') {
        return { queued: true, method: (args[0] as { method?: string }).method }
      }
      throw new Error(`Unexpected channel: ${String(channel)}`)
    })

    const httpExecution = await executeAgentPipeline({
      id: 'pipeline-http-async',
      name: 'HTTP Async Flow',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { agentId: 'agent-1', task: 'Fetch later', nodeType: 'http', httpMethod: 'POST', httpUrl: 'https://api.example.com/data', httpAsync: true, httpBody: '{"ok":true}' },
      ],
    })

    expect(httpExecution.status).toBe('success')
    expect(httpExecution.steps[0].output).toContain('Queued POST https://api.example.com/data asynchronously.')

    const webhookExecution = await executeAgentPipeline({
      id: 'pipeline-webhook-async',
      name: 'Webhook Async Flow',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { agentId: 'agent-1', task: 'Notify webhook', nodeType: 'webhook', webhookChannelId: 'channel-1', webhookMethod: 'POST', webhookAsync: true },
      ],
    })

    expect(webhookExecution.status).toBe('success')
    expect(webhookExecution.steps[0].output).toContain('Queued webhook POST https://hooks.example.com/support asynchronously.')
  })

  it('executes toolset nodes through registered plugin tools', async () => {
    const execution = await executeAgentPipeline({
      id: 'pipeline-toolset',
      name: 'Toolset Flow',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { agentId: 'agent-1', task: 'Get tickets', nodeType: 'toolset', toolsetId: 'ticketManagement', toolName: 'getTickets', toolInput: '{}' },
      ],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toContain('ticket-1')
  })

  it('executes inline code nodes in a sandbox and exposes returned fields to downstream steps', async () => {
    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: 'code-finished' }
    })

    const execution = await executeAgentPipeline({
      id: 'pipeline-code',
      name: 'Code Flow',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        {
          agentId: 'agent-1',
          task: 'Transform data',
          nodeType: 'code',
          codeInputMapping: 'items={{vars.items}}',
          codeOutputSchema: 'result,summary',
          codeSource: 'function main(inputs) { return { result: inputs.items.length, summary: inputs.items.join("|") }; }',
        },
        { agentId: 'agent-2', task: 'Use {{vars.summary}} with count {{previous.output}}' },
      ],
      variables: [{ name: 'items', defaultValue: '["A","B","C"]' }],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toBe('3')
    expect(execution.steps[1].input).toContain('A|B|C')
    expect(execution.steps[1].input).toContain('count 3')
  })

  it('renders template nodes with conditions, filters, and loops from workflow context', async () => {
    const execution = await executeAgentPipeline({
      id: 'pipeline-template',
      name: 'Template Flow',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        {
          agentId: 'agent-1',
          task: 'Prepare vars',
          nodeType: 'code',
          codeOutputSchema: 'title,items',
          codeSource: 'function main() { return { title: "Launch", items: ["Alpha", "Beta"] }; }',
        },
        {
          agentId: 'agent-1',
          task: 'Render template',
          nodeType: 'template',
          templateBody: '{% if vars.title %}# {{ vars.title | upper }}\n{% endif %}{% for item in vars.items %}- {{ item | lower }}\n{% endfor %}',
        },
      ],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[1].output).toContain('# LAUNCH')
    expect(execution.steps[1].output).toContain('- alpha')
    expect(execution.steps[1].output).toContain('- beta')
  })

  it('updates workflow variables through variable assigner nodes', async () => {
    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: 'variables-ready' }
    })

    const execution = await executeAgentPipeline({
      id: 'pipeline-variable',
      name: 'Variable Flow',
      createdAt: 1,
      updatedAt: 2,
      variables: [{ name: 'sourceItems', defaultValue: '["A","B"]' }],
      steps: [
        {
          agentId: 'agent-1',
          task: 'Assign vars',
          nodeType: 'variable',
          variableAssignments: [
            { variable: 'bag', mode: 'overwrite', value: '{{vars.sourceItems}}' },
            { variable: 'bag', mode: 'append', value: 'C' },
          ],
        },
        { agentId: 'agent-2', task: 'Use {{vars.bag}}' },
      ],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toContain('bag')
    expect(execution.steps[1].input).toContain('[\n  "A",\n  "B",\n  "C"\n]')
  })

  it('iterates sequentially over an array and aggregates child pipeline outputs', async () => {
    const execution = await executeAgentPipeline({
      id: 'pipeline-iteration-sequential',
      name: 'Iteration Sequential',
      createdAt: 1,
      updatedAt: 2,
      variables: [{ name: 'records', defaultValue: '["a","b","c"]' }],
      steps: [
        {
          agentId: 'agent-1',
          task: '',
          nodeType: 'iteration',
          iterationSource: '{{vars.records}}',
          iterationPipelineTargetId: 'pipeline-iteration-template',
          iterationInputMapping: 'record={{vars.row}}\nposition={{vars.idx}}',
          iterationItemVar: 'row',
          iterationIndexVar: 'idx',
          iterationMode: 'sequential',
        },
      ],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toContain('a-0')
    expect(execution.steps[0].output).toContain('b-1')
    expect(execution.steps[0].output).toContain('c-2')
  })

  it('continues iteration failures with null placeholders when configured', async () => {
    const execution = await executeAgentPipeline({
      id: 'pipeline-iteration-continue',
      name: 'Iteration Continue',
      createdAt: 1,
      updatedAt: 2,
      variables: [{ name: 'records', defaultValue: '["ok","bad","done"]' }],
      steps: [
        {
          agentId: 'agent-1',
          task: '',
          nodeType: 'iteration',
          iterationSource: '{{vars.records}}',
          iterationPipelineTargetId: 'pipeline-iteration-code',
          iterationInputMapping: 'record={{vars.row}}',
          iterationItemVar: 'row',
          iterationErrorMode: 'continue',
        },
      ],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toContain('OK')
    expect(execution.steps[0].output).toContain('null')
    expect(execution.steps[0].warnings?.[0]).toContain('failed item')
  })

  it('removes failed iteration results when configured', async () => {
    const execution = await executeAgentPipeline({
      id: 'pipeline-iteration-remove-failed',
      name: 'Iteration Remove Failed',
      createdAt: 1,
      updatedAt: 2,
      variables: [{ name: 'records', defaultValue: '["ok","bad","done"]' }],
      steps: [
        {
          agentId: 'agent-1',
          task: '',
          nodeType: 'iteration',
          iterationSource: '{{vars.records}}',
          iterationPipelineTargetId: 'pipeline-iteration-code',
          iterationInputMapping: 'record={{vars.row}}',
          iterationItemVar: 'row',
          iterationErrorMode: 'remove-failed',
        },
      ],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toContain('OK')
    expect(execution.steps[0].output).toContain('DONE')
    expect(execution.steps[0].output).not.toContain('null')
  })

  it('does not fall back to another toolset when the selected runtime toolset is unavailable', async () => {
    unregisterPluginTools('issueManagement')

    const execution = await executeAgentPipeline({
      id: 'pipeline-toolset-missing-runtime-registration',
      name: 'Toolset Runtime Gap',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { agentId: 'agent-1', task: 'Lookup issue', nodeType: 'toolset', toolsetId: 'issueManagement', toolName: 'lookup', toolInput: '{}' },
      ],
    })

    expect(execution.status).toBe('error')
    expect(execution.steps[0].error).toContain('Tool not available in toolset issueManagement: lookup')
  })

  it('reports invalid toolset JSON input clearly', async () => {
    const execution = await executeAgentPipeline({
      id: 'pipeline-toolset-invalid-json',
      name: 'Toolset Invalid JSON',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { agentId: 'agent-1', task: 'Get tickets', nodeType: 'toolset', toolsetId: 'ticketManagement', toolName: 'getTickets', toolInput: '{invalid' },
      ],
    })

    expect(execution.status).toBe('error')
    expect(execution.steps[0].error).toContain('Tool input JSON is invalid')
  })

  it('executes document retrieval and wiki search nodes against workspace documents', async () => {
    const ragExecution = await executeAgentPipeline({
      id: 'pipeline-rag',
      name: 'RAG Flow',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { agentId: 'agent-1', task: 'Retrieve docs', nodeType: 'rag', ragKnowledgeBaseId: 'kb-1', ragQuery: 'launch', ragTopK: 3 },
      ],
    })

    expect(ragExecution.status).toBe('success')
    expect(ragExecution.steps[0].output).toContain('Release Plan')

    const wikiExecution = await executeAgentPipeline({
      id: 'pipeline-wiki',
      name: 'Wiki Flow',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { agentId: 'agent-1', task: 'Search wiki', nodeType: 'wiki', wikiId: 'kb-1', wikiQuery: 'launch', wikiTopK: 3 },
      ],
    })

    expect(wikiExecution.status).toBe('success')
    expect(wikiExecution.steps[0].output).toContain('Release Plan')
  })

  it('supports multi-knowledge-base retrieval with metadata filters', async () => {
    const execution = await executeAgentPipeline({
      id: 'pipeline-rag-multi',
      name: 'RAG Multi',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        {
          agentId: 'agent-1',
          task: 'Retrieve docs',
          nodeType: 'rag',
          ragKnowledgeBaseId: 'kb-1',
          ragKnowledgeBaseIds: ['kb-2'],
          ragQuery: 'launch',
          ragMetadataFilter: 'tag:runbook',
          ragTopK: 5,
        },
      ],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toContain('Launch Runbook')
    expect(execution.steps[0].output).not.toContain('Release Plan')
    expect(execution.steps[0].output).toContain('"knowledgeBaseIds"')
  })

  it('returns a clear warning when retrieval nodes find no matching documents', async () => {
    const execution = await executeAgentPipeline({
      id: 'pipeline-rag-empty',
      name: 'RAG Empty',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { agentId: 'agent-1', task: 'Retrieve docs', nodeType: 'rag', ragKnowledgeBaseId: 'kb-1', ragQuery: 'no-match-token', ragTopK: 3 },
      ],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].warnings?.[0]).toContain('No knowledge-base results matched the query.')
  })

  it('resolves template variables inside email delivery fields before invoking smtp send', async () => {
    useAppStore.setState({
      emailConfig: {
        smtpHost: 'smtp.example.com',
        smtpPort: 465,
        secure: true,
        username: 'bot@example.com',
        password: 'secret',
        fromName: 'Suora Bot',
        fromAddress: 'bot@example.com',
        enabled: true,
      },
    })
    vi.mocked(window.electron.invoke).mockImplementation(async (channel, ...args) => {
      if (channel === 'email:send') {
        expect(args[1]).toMatchObject({
          to: 'ops+alerts@example.com',
          subject: 'Alert: daily report',
        })
        return { success: true, messageId: 'msg-124' }
      }
      return undefined
    })

    const execution = await executeAgentPipeline({
      id: 'pipeline-email-template',
      name: 'Email Template Flow',
      createdAt: 1,
      updatedAt: 2,
      variables: [{ name: 'tag', defaultValue: 'alerts' }, { name: 'topic', defaultValue: 'daily report' }],
      steps: [
        { agentId: 'agent-1', task: 'Send notification', nodeType: 'email', emailTo: 'ops+{{vars.tag}}@example.com', emailSubject: 'Alert: {{vars.topic}}' },
      ],
    }, { variables: { tag: 'alerts', topic: 'daily report' } })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toContain('Email sent to ops+alerts@example.com')
  })

  it('executes http nodes through the desktop fetch bridge instead of the model runtime', async () => {
    vi.mocked(window.electron.invoke).mockImplementation(async (channel, ...args) => {
      if (channel === 'web:fetchText') {
        expect(args[0]).toBe('https://api.example.com/data')
        return { content: '{"ok":true}' }
      }
      return undefined
    })

    const execution = await executeAgentPipeline({
      id: 'pipeline-http',
      name: 'HTTP Flow',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { agentId: 'agent-1', task: 'Fetch data', nodeType: 'http', httpMethod: 'GET', httpUrl: 'https://api.example.com/data' },
      ],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toContain('{"ok":true}')
    expect(streamResponseWithTools).not.toHaveBeenCalled()
  })

  it('executes script nodes through the shell bridge instead of the model runtime', async () => {
    vi.mocked(window.electron.invoke).mockImplementation(async (channel, ...args) => {
      if (channel === 'shell:exec') {
        expect(String(args[0])).toContain('node')
        return { stdout: 'script-complete', stderr: '' }
      }
      return undefined
    })

    const execution = await executeAgentPipeline({
      id: 'pipeline-script',
      name: 'Script Flow',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { agentId: 'agent-1', task: 'Run script', nodeType: 'script', scriptRuntime: 'javascript', scriptPath: 'scripts/run.js' },
      ],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toBe('script-complete')
    expect(streamResponseWithTools).not.toHaveBeenCalled()
  })

  it('executes email nodes through the global smtp bridge instead of the model runtime', async () => {
    useAppStore.setState({
      emailConfig: {
        smtpHost: 'smtp.example.com',
        smtpPort: 465,
        secure: true,
        username: 'bot@example.com',
        password: 'secret',
        fromName: 'Suora Bot',
        fromAddress: 'bot@example.com',
        enabled: true,
      },
    })
    vi.mocked(window.electron.invoke).mockImplementation(async (channel, ...args) => {
      if (channel === 'email:send') {
        expect(args[1]).toMatchObject({
          to: 'ops@example.com',
          subject: 'Pipeline alert',
        })
        return { success: true, messageId: 'msg-123' }
      }
      return undefined
    })

    const execution = await executeAgentPipeline({
      id: 'pipeline-email',
      name: 'Email Flow',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { agentId: 'agent-1', task: 'Send notification', nodeType: 'email', emailTo: 'ops@example.com', emailSubject: 'Pipeline alert' },
      ],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toContain('Email sent to ops@example.com')
    expect(streamResponseWithTools).not.toHaveBeenCalled()
  })

  it('stops and marks remaining steps skipped when continue on error is disabled', async () => {
    const stopOnErrorPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Draft the report', continueOnError: false },
        { agentId: 'agent-2', task: 'Review the report' },
      ],
    }

    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'error', error: 'draft failed' }
    })

    const execution = await executeAgentPipeline(stopOnErrorPipeline)

    expect(execution.status).toBe('error')
    expect(execution.steps).toHaveLength(2)
    expect(execution.steps[0].status).toBe('error')
    expect(execution.steps[1].status).toBe('skipped')
    expect(streamResponseWithTools).toHaveBeenCalledTimes(1)
  })

  it('fails blank enabled steps without calling the model', async () => {
    const invalidPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: '   ' },
        { agentId: 'agent-2', task: 'Review the report' },
      ],
    }

    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: 'review-ready' }
    })

    const execution = await executeAgentPipeline(invalidPipeline)

    expect(execution.status).toBe('error')
    expect(execution.steps[0].status).toBe('error')
    expect(execution.steps[0].error).toBe('Step 1 has an empty task.')
    expect(streamResponseWithTools).not.toHaveBeenCalled()
  })

  it('returns dry-run validation failures before calling the model', async () => {
    const invalidPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [{ agentId: 'missing-agent', task: 'Draft the report' }],
    }

    const execution = await executeAgentPipeline(invalidPipeline)

    expect(execution.status).toBe('error')
    expect(execution.error).toContain('Step 1 references a missing agent')
    expect(execution.runId).toBeTruthy()
    expect(execution.runtime?.runId).toBe(execution.runId)
    expect(execution.steps[0].recoveryActions?.[0].label).toBe('Choose another agent')
    expect(streamResponseWithTools).not.toHaveBeenCalled()
  })

  it('truncates step output when a max output budget is configured', async () => {
    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: 'abcdef' }
    })

    const execution = await executeAgentPipeline({
      ...savedPipeline,
      steps: [{ agentId: 'agent-1', task: 'Draft the report', maxOutputChars: 3 }],
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toContain('[Pipeline step output truncated: 3 characters omitted]')
    expect(execution.steps[0].warnings?.[0]).toContain('Step output truncated')
    expect(execution.steps[0].outputType).toBe('text')
  })

  it('marks every remaining step cancelled when aborted before execution', async () => {
    const controller = new AbortController()
    controller.abort()

    const execution = await executeAgentPipeline(savedPipeline, { abortSignal: controller.signal })

    expect(execution.status).toBe('error')
    expect(execution.error).toBe('Cancelled by user')
    expect(execution.steps).toHaveLength(2)
    expect(execution.steps.every((step) => step.status === 'skipped' && step.error === 'Cancelled by user')).toBe(true)
    expect(streamResponseWithTools).not.toHaveBeenCalled()
  })

  it('redacts secrets and local paths from recorded pipeline errors', async () => {
    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield {
        type: 'error',
        error: 'failed with sk-abcdefghijklmnopqrstuvwxyz123456 at C:\\Users\\Fandy\\secret\\trace.log',
      }
    })

    const execution = await executeAgentPipeline({
      ...savedPipeline,
      steps: [{ agentId: 'agent-1', task: 'Draft the report', continueOnError: false }],
    })

    expect(execution.status).toBe('error')
    expect(execution.steps[0].error).toContain('sk-***REDACTED***')
    expect(execution.steps[0].error).toContain('<...>/trace.log')
    expect(execution.steps[0].error).not.toContain('Fandy')
  })

  it('creates an error execution when a pipeline cannot be resolved by id', async () => {
    vi.mocked(loadPipelinesFromDisk).mockResolvedValueOnce([])
    useAppStore.setState({ agentPipelines: [] })

    const execution = await executePipelineById('missing-pipeline', { trigger: 'timer', timerId: 'timer-1' })

    expect(execution.status).toBe('error')
    expect(execution.error).toBe('Pipeline not found')
    expect(execution.timerId).toBe('timer-1')
    expect(appendPipelineExecutionToDisk).toHaveBeenCalledTimes(1)
  })

  it('streams step progress updates when a callback is provided', async () => {
    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'draft-ready' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'review-ready' }
      })

    const updates: Array<{ stepIndex: number; status: string; output?: string }> = []
    const execution = await executeAgentPipeline(savedPipeline, {
      onStepUpdate: (step) => {
        updates.push({
          stepIndex: step.stepIndex,
          status: step.status,
          output: step.output,
        })
      },
    })

    expect(execution.status).toBe('success')
    expect(initializeProvider).toHaveBeenCalledTimes(1)
    expect(streamResponseWithTools).toHaveBeenCalledTimes(2)
    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ stepIndex: 0, status: 'running' }),
      expect.objectContaining({ stepIndex: 0, status: 'success', output: 'draft-ready' }),
      expect.objectContaining({ stepIndex: 1, status: 'running' }),
      expect.objectContaining({ stepIndex: 1, status: 'success', output: 'review-ready' }),
    ]))
  })

  it('executes a saved pipeline by name for chat-triggered runs', async () => {
    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'draft-ready' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'review-ready' }
      })

    const execution = await executePipelineByReference('morning run', { trigger: 'chat' })

    expect(execution.status).toBe('success')
    expect(execution.trigger).toBe('chat')
    expect(execution.pipelineId).toBe('pipeline-1')
    expect(execution.pipelineName).toBe('Morning Run')
  })

  it('reports ambiguous partial pipeline references without executing a model call', async () => {
    useAppStore.setState({
      agentPipelines: [
        savedPipeline,
        { ...savedPipeline, id: 'pipeline-2', name: 'Morning Report' },
      ],
    })

    const execution = await executePipelineByReference('Morning', { trigger: 'chat' })

    expect(execution.status).toBe('error')
    expect(execution.error).toContain('Pipeline reference is ambiguous')
    expect(execution.recoveryActions?.[0].label).toBe('Choose an exact pipeline name')
    expect(streamResponseWithTools).not.toHaveBeenCalled()
  })

  it('classifies structural and nested pipeline nodes correctly during dry runs', () => {
    const result = dryRunAgentPipeline({
      id: 'pipeline-dry-nodes',
      name: 'Dry Nodes',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { agentId: 'agent-1', task: '', nodeType: 'parallel', parallelBranches: 2 },
        { agentId: 'agent-1', task: 'Delegate', nodeType: 'pipeline', pipelineTargetId: 'pipeline-2' },
        { agentId: 'agent-1', task: '', nodeType: 'join', joinStrategy: 'wait-all' },
      ],
    })

    expect(result.steps[0].status).toBe('would-run')
    expect(result.steps[1].status).toBe('would-run')
    expect(result.steps[2].status).toBe('would-run')
    expect(result.validationErrors).toHaveLength(0)
  })

  it('classifies http, script, and email nodes correctly during dry runs', () => {
    const result = dryRunAgentPipeline({
      id: 'pipeline-dry-io',
      name: 'Dry IO',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { agentId: 'agent-1', task: 'Fetch data', nodeType: 'http', httpUrl: 'https://api.example.com/data' },
        { agentId: 'agent-1', task: 'Run script', nodeType: 'script', scriptPath: 'scripts/run.js' },
        { agentId: 'agent-1', task: 'Send email', nodeType: 'email', emailTo: 'ops@example.com', emailSubject: 'Alert' },
      ],
    })

    expect(result.steps.every((step) => step.status === 'would-run')).toBe(true)
    expect(result.validationErrors).toHaveLength(0)
  })

  it('classifies http, script, and email nodes correctly during dry runs', () => {
    const result = dryRunAgentPipeline({
      id: 'pipeline-dry-io',
      name: 'Dry IO',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        { agentId: 'agent-1', task: 'Fetch data', nodeType: 'http', httpUrl: 'https://api.example.com/data' },
        { agentId: 'agent-1', task: 'Run script', nodeType: 'script', scriptPath: 'scripts/run.js' },
        { agentId: 'agent-1', task: 'Send email', nodeType: 'email', emailTo: 'ops@example.com', emailSubject: 'Alert' },
      ],
    })

    expect(result.steps.every((step) => step.status === 'would-run')).toBe(true)
    expect(result.validationErrors).toHaveLength(0)
  })

  it('skips a step whose runIf condition does not match and records the reason', async () => {
    const conditionalPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Draft the report' },
        { agentId: 'agent-2', task: 'Review the report', runIf: "step1.output contains 'approved'" },
      ],
    }

    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: 'draft-ready' }
    })

    const execution = await executeAgentPipeline(conditionalPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[1].status).toBe('skipped')
    expect(execution.steps[1].skipReason).toMatch(/Condition not met/)
    expect(execution.steps[1].skipReason).toContain("step1.output contains 'approved'")
    expect(streamResponseWithTools).toHaveBeenCalledTimes(1)
    expect(execution.finalOutput).toBe('draft-ready')
  })

  it('routes condition nodes through named branches instead of only true/false', async () => {
    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: '{"branch":"revise"}' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'revise-ready' }
      })

    const execution = await executeAgentPipeline({
      id: 'pipeline-condition-multi',
      name: 'Condition Multi',
      createdAt: 1,
      updatedAt: 2,
      steps: [
        {
          id: 'condition',
          agentId: 'agent-1',
          task: 'Choose branch',
          nodeType: 'condition',
          conditionBranches: [
            { key: 'approve', label: 'Approve' },
            { key: 'revise', label: 'Revise' },
          ],
          transitions: [
            { targetStepId: 'approve', sourceHandle: 'approve' },
            { targetStepId: 'revise', sourceHandle: 'revise' },
          ],
        },
        { id: 'approve', agentId: 'agent-1', task: 'Approve branch' },
        { id: 'revise', agentId: 'agent-2', task: 'Revise branch' },
      ],
    })

    const approveBranch = execution.steps.find((step) => step.stepIndex === 1)
    const reviseBranch = execution.steps.find((step) => step.stepIndex === 2)

    expect(execution.status).toBe('success')
    expect(approveBranch?.status).toBe('skipped')
    expect(reviseBranch?.status).toBe('success')
    expect(reviseBranch?.output).toBe('revise-ready')
    expect(execution.runtime?.visitedStepIndices).toEqual([0, 2])
  })

  it('runs a step whose runIf condition matches', async () => {
    const conditionalPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Draft the report' },
        { agentId: 'agent-2', task: 'Review the report', runIf: "step1.status == 'success'" },
      ],
    }

    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'draft-ready' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'review-ready' }
      })

    const execution = await executeAgentPipeline(conditionalPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[1].status).toBe('success')
    expect(streamResponseWithTools).toHaveBeenCalledTimes(2)
  })

  it('rejects pipelines with malformed runIf expressions during validation', async () => {
    const invalidPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Draft', runIf: '==' },
      ],
    }

    const execution = await executeAgentPipeline(invalidPipeline)

    expect(execution.status).toBe('error')
    expect(execution.error).toMatch(/invalid runIf/i)
    expect(streamResponseWithTools).not.toHaveBeenCalled()
  })

  it('substitutes pipeline-level variables and records them in the runtime snapshot', async () => {
    const variablePipeline: AgentPipeline = {
      ...savedPipeline,
      variables: [
        { name: 'mode', defaultValue: 'live' },
        { name: 'reviewer' },
      ],
      steps: [
        { agentId: 'agent-1', task: 'Draft for {{vars.mode}} mode for {{vars.reviewer}}' },
      ],
    }

    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: 'drafted' }
    })

    const execution = await executeAgentPipeline(variablePipeline, {
      variables: { reviewer: 'Alice' },
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[0].input).toContain('Draft for live mode for Alice')
    expect(execution.runtime?.variables).toEqual({ mode: 'live', reviewer: 'Alice' })
  })

  it('uses vars in runIf conditions to gate steps', async () => {
    const variablePipeline: AgentPipeline = {
      ...savedPipeline,
      variables: [{ name: 'mode' }],
      steps: [
        { agentId: 'agent-1', task: 'Draft' },
        { agentId: 'agent-2', task: 'Review', runIf: "vars.mode == 'live'" },
      ],
    }

    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: 'draft-ready' }
    })

    const execution = await executeAgentPipeline(variablePipeline, {
      variables: { mode: 'dry-run' },
    })

    expect(execution.status).toBe('success')
    expect(execution.steps[1].status).toBe('skipped')
    expect(execution.steps[1].skipReason).toContain("vars.mode == 'live'")
  })

  it('captures token usage per step and aggregates it on the execution', async () => {
    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'draft-ready' }
        yield { type: 'usage', promptTokens: 10, completionTokens: 5, totalTokens: 15 }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'review-ready' }
        yield { type: 'usage', promptTokens: 20, completionTokens: 7, totalTokens: 27 }
      })

    const execution = await executeAgentPipeline(savedPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[0].usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 })
    expect(execution.steps[1].usage).toEqual({ promptTokens: 20, completionTokens: 7, totalTokens: 27 })
    expect(execution.usage).toEqual({ promptTokens: 30, completionTokens: 12, totalTokens: 42 })
  })

  it('aborts the run and skips remaining steps when the token budget is exceeded', async () => {
    const budgetPipeline: AgentPipeline = {
      ...savedPipeline,
      budget: { maxTotalTokens: 20 },
      steps: [
        { agentId: 'agent-1', task: 'Draft the report' },
        { agentId: 'agent-2', task: 'Review the report' },
      ],
    }

    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'draft-ready' }
        yield { type: 'usage', promptTokens: 30, completionTokens: 0, totalTokens: 30 }
      })

    const execution = await executeAgentPipeline(budgetPipeline)

    expect(execution.status).toBe('error')
    expect(execution.budgetExceeded).toEqual({ type: 'tokens', limit: 20, observed: 30 })
    expect(execution.steps).toHaveLength(2)
    expect(execution.steps[0].status).toBe('success')
    expect(execution.steps[1].status).toBe('skipped')
    expect(execution.steps[1].skipReason).toContain('budget')
    expect(streamResponseWithTools).toHaveBeenCalledTimes(1)
  })

  it('aborts the run when the step-count cap is reached', async () => {
    const budgetPipeline: AgentPipeline = {
      ...savedPipeline,
      budget: { maxStepCount: 1 },
      steps: [
        { agentId: 'agent-1', task: 'Draft the report' },
        { agentId: 'agent-2', task: 'Review the report' },
      ],
    }

    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'draft-ready' }
      })

    const execution = await executeAgentPipeline(budgetPipeline)

    expect(execution.status).toBe('error')
    expect(execution.budgetExceeded?.type).toBe('steps')
    expect(execution.steps[0].status).toBe('success')
    expect(execution.steps[1].status).toBe('skipped')
  })

  it('honors the per-step retry backoff before retrying', async () => {
    vi.useFakeTimers()
    try {
      const retryPipeline: AgentPipeline = {
        ...savedPipeline,
        steps: [
          { agentId: 'agent-1', task: 'Draft', retryCount: 1, retryBackoffMs: 100, retryBackoffStrategy: 'fixed' },
        ],
      }

      vi.mocked(streamResponseWithTools)
        .mockImplementationOnce(async function* () {
          yield { type: 'error', error: 'temporary' }
        })
        .mockImplementationOnce(async function* () {
          yield { type: 'text-delta', text: 'recovered' }
        })

      const promise = executeAgentPipeline(retryPipeline)
      // Allow the rejected attempt to flow through the microtask queue.
      await vi.advanceTimersByTimeAsync(0)
      // Before the backoff elapses, the retry has not been triggered.
      expect(streamResponseWithTools).toHaveBeenCalledTimes(1)
      // After the backoff, the retry runs.
      await vi.advanceTimersByTimeAsync(100)
      const execution = await promise

      expect(execution.status).toBe('success')
      expect(execution.steps[0].attempts).toBe(2)
      expect(streamResponseWithTools).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('uses exponential growth for the retry backoff when configured', async () => {
    vi.useFakeTimers()
    try {
      const retryPipeline: AgentPipeline = {
        ...savedPipeline,
        steps: [
          { agentId: 'agent-1', task: 'Draft', retryCount: 2, retryBackoffMs: 50, retryBackoffStrategy: 'exponential' },
        ],
      }

      vi.mocked(streamResponseWithTools)
        .mockImplementationOnce(async function* () { yield { type: 'error', error: 'fail-1' } })
        .mockImplementationOnce(async function* () { yield { type: 'error', error: 'fail-2' } })
        .mockImplementationOnce(async function* () { yield { type: 'text-delta', text: 'recovered' } })

      const promise = executeAgentPipeline(retryPipeline)

      await vi.advanceTimersByTimeAsync(0)
      expect(streamResponseWithTools).toHaveBeenCalledTimes(1)
      // First retry waits ~50ms.
      await vi.advanceTimersByTimeAsync(50)
      expect(streamResponseWithTools).toHaveBeenCalledTimes(2)
      // Second retry waits ~100ms (50 * 2^1).
      await vi.advanceTimersByTimeAsync(100)
      const execution = await promise

      expect(execution.status).toBe('success')
      expect(execution.steps[0].attempts).toBe(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('uses the per-step model override when present', async () => {
    const overridePipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Draft', modelId: 'model-cheap' },
      ],
    }

    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: 'cheap-output' }
    })

    const execution = await executeAgentPipeline(overridePipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[0].modelId).toBe('model-cheap')
    // The mocked streamResponseWithTools is called with the model identifier as the first arg.
    const callArgs = vi.mocked(streamResponseWithTools).mock.calls[0]
    expect(callArgs[0]).toContain('gpt-4.1-mini')
  })

  it('falls back to the agent default at runtime when the step model override is disabled', async () => {
    // Disabled-model override is a warning at validation time, not an error,
    // so the run still proceeds — falling through to the agent's default model.
    useAppStore.setState({
      models: [
        { id: 'model-1', name: 'GPT', provider: 'provider-1', providerType: 'openai', modelId: 'gpt-4.1', enabled: true, isDefault: true },
        { id: 'model-cheap', name: 'GPT mini', provider: 'provider-1', providerType: 'openai', modelId: 'gpt-4.1-mini', enabled: false },
      ],
      agents: useAppStore.getState().agents,
      agentPipelines: useAppStore.getState().agentPipelines,
      workspacePath: 'C:/workspace',
      notifications: [],
    })
    const overridePipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Draft', modelId: 'model-cheap' },
      ],
    }

    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: 'fallback-output' }
    })

    const execution = await executeAgentPipeline(overridePipeline)

    expect(execution.status).toBe('success')
    // Falls back to model-1 (the agent's modelId).
    expect(execution.steps[0].modelId).toBe('model-1')
  })

  it('applies the trim output transform before passing output downstream', async () => {
    const transformPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Draft', outputTransform: 'trim' },
        { agentId: 'agent-2', task: 'Review {{previous.output}}' },
      ],
    }

    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: '  raw with whitespace  \n' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'reviewed' }
      })

    const execution = await executeAgentPipeline(transformPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toBe('raw with whitespace')
    expect(execution.steps[0].rawOutput).toBe('  raw with whitespace  \n')
    expect(execution.steps[1].input).toContain('Review raw with whitespace')
  })

  it('extracts a JSON path via the json-path output transform', async () => {
    const transformPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Draft', outputTransform: 'json-path', outputTransformPath: 'data.title' },
      ],
    }

    vi.mocked(streamResponseWithTools).mockImplementationOnce(async function* () {
      yield { type: 'text-delta', text: '{"data":{"title":"Hello"}}' }
    })

    const execution = await executeAgentPipeline(transformPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toBe('Hello')
    expect(execution.steps[0].rawOutput).toBe('{"data":{"title":"Hello"}}')
  })

  it('dryRunAgentPipeline classifies steps without invoking any model', () => {
    const dryPipeline: AgentPipeline = {
      ...savedPipeline,
      variables: [{ name: 'topic', defaultValue: 'launch' }],
      steps: [
        { agentId: 'agent-1', task: 'Draft about {{vars.topic}}' },
        { agentId: 'agent-2', task: 'Review', enabled: false },
        { agentId: 'agent-2', task: 'Summarize', runIf: "step1.status == 'success'" },
        { agentId: 'agent-missing', task: 'Broken' },
      ],
    }

    const result = dryRunAgentPipeline(dryPipeline)

    expect(streamResponseWithTools).not.toHaveBeenCalled()
    expect(generateResponse).not.toHaveBeenCalled()
    expect(result.steps).toHaveLength(4)
    expect(result.steps[0].status).toBe('would-run')
    expect(result.steps[0].resolvedInput).toContain('Draft about launch')
    expect(result.steps[0].modelId).toBe('model-1')
    expect(result.steps[1].status).toBe('disabled')
    expect(result.steps[2].status).toBe('would-run')
    expect(result.steps[3].status).toBe('error')
    expect(result.steps[3].reason).toMatch(/missing agent/)
    expect(result.variables.topic).toBe('launch')
  })

  it('dryRunAgentPipeline reports a budget cap that would skip later steps', () => {
    const dryPipeline: AgentPipeline = {
      ...savedPipeline,
      budget: { maxStepCount: 1 },
      steps: [
        { agentId: 'agent-1', task: 'A' },
        { agentId: 'agent-1', task: 'B' },
      ],
    }

    const result = dryRunAgentPipeline(dryPipeline)

    expect(result.budgetExceeded?.type).toBe('steps')
    expect(result.steps[0].status).toBe('would-run')
    expect(result.steps[1].status).toBe('skipped')
    expect(result.steps[1].reason).toMatch(/budget/)
  })

  it('exports a step output into a named pipeline variable for downstream substitution', async () => {
    const exportPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Pick a topic', exportVar: 'topic' },
        { agentId: 'agent-2', task: 'Write about {{vars.topic}}' },
      ],
    }

    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'quantum computing' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'article' }
      })

    const execution = await executeAgentPipeline(exportPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toBe('quantum computing')
    // The second step's prompt should have the exported variable splat in.
    expect(execution.steps[1].input).toContain('Write about quantum computing')
  })

  it('exports the transformed output (not the raw output) into the variable', async () => {
    const exportPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        {
          agentId: 'agent-1',
          task: 'Return JSON',
          outputTransform: 'json-path',
          outputTransformPath: 'data.title',
          exportVar: 'title',
        },
        { agentId: 'agent-2', task: 'Promote {{vars.title}}' },
      ],
    }

    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: '{"data":{"title":"Hello"}}' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'done' }
      })

    const execution = await executeAgentPipeline(exportPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[0].output).toBe('Hello')
    expect(execution.steps[0].rawOutput).toBe('{"data":{"title":"Hello"}}')
    expect(execution.steps[1].input).toContain('Promote Hello')
  })

  it('makes an exported variable visible to downstream runIf conditions', async () => {
    const exportPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Decide', exportVar: 'decision' },
        { agentId: 'agent-2', task: 'Approve', runIf: "vars.decision == 'approved'" },
        { agentId: 'agent-2', task: 'Reject', runIf: "vars.decision == 'rejected'" },
      ],
    }

    vi.mocked(streamResponseWithTools)
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'approved' }
      })
      .mockImplementationOnce(async function* () {
        yield { type: 'text-delta', text: 'approved-output' }
      })

    const execution = await executeAgentPipeline(exportPipeline)

    expect(execution.status).toBe('success')
    expect(execution.steps[0].exportedVar).toBe('decision')
    expect(execution.steps[1].status).toBe('success')
    expect(execution.steps[2].status).toBe('skipped')
  })

  it('dryRunAgentPipeline propagates exported variables through the simulation', () => {
    const dryPipeline: AgentPipeline = {
      ...savedPipeline,
      steps: [
        { agentId: 'agent-1', task: 'Pick', exportVar: 'choice' },
        { agentId: 'agent-2', task: 'Use {{vars.choice}}' },
      ],
    }

    const result = dryRunAgentPipeline(dryPipeline)

    expect(streamResponseWithTools).not.toHaveBeenCalled()
    expect(result.steps[0].status).toBe('would-run')
    expect(result.steps[0].exportedVar).toBe('choice')
    // The second step's resolved input should reflect the simulated dry-run
    // output rather than an empty string.
    expect(result.steps[1].resolvedInput).toContain('[dry-run output for step 1]')
  })
})
