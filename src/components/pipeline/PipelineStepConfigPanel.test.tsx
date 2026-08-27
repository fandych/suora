import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PipelineStepConfigPanel } from './PipelineStepConfigPanel'
import type { AgentPipelineStep, Model } from '@/types'
import { useAppStore } from '@/store/appStore'

vi.mock('@/components/icons/IconifyIcons', () => ({
  IconifyIcon: () => <span data-testid="mock-icon" />,
}))

const model: Model = {
  id: 'model-1',
  name: 'GPT',
  provider: 'provider-1',
  providerType: 'openai',
  modelId: 'gpt-4.1',
  enabled: true,
  isDefault: true,
}

function renderPanel(step: AgentPipelineStep) {
  return render(
    <PipelineStepConfigPanel
      step={step}
      stepIndex={0}
      totalSteps={1}
      enabledAgents={[{ id: 'agent-1', name: 'Writer' }]}
      agentNameMap={{ 'agent-1': 'Writer' }}
      models={[model]}
      onUpdateStep={vi.fn()}
      onMoveStep={vi.fn()}
      onDuplicateStep={vi.fn()}
      onRemoveStep={vi.fn()}
      onAppendReference={vi.fn()}
      formatDuration={() => '0ms'}
      normalizeRetryCount={(value) => value ?? 0}
      t={(_key, fallback) => fallback ?? ''}
    />,
  )
}

describe('PipelineStepConfigPanel', () => {
  beforeEach(() => {
    useAppStore.setState({
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
      documentGroups: [{ id: 'kb-1', name: 'Knowledge Base', color: '#0ea5e9', createdAt: 1, updatedAt: 1 }],
      agentPipelines: [{ id: 'pipeline-2', name: 'Child Pipeline', steps: [{ agentId: 'agent-1', task: 'Draft child' }], createdAt: 1, updatedAt: 1 }],
      installedPlugins: [{ id: 'ticketManagement', name: 'Ticket Management', version: '1.0.0', author: 'test', description: 'Test toolset', status: 'enabled', hooks: [], config: {}, installedAt: 1 }],
      pluginTools: { ticketManagement: ['getTickets', 'postTickets'] },
      emailConfig: { smtpHost: '', smtpPort: 587, secure: false, username: '', password: '', fromName: '', fromAddress: '', enabled: false },
    })
  })

  it('shows request-specific fields for http nodes', () => {
    renderPanel({ agentId: 'agent-1', task: 'Call API', nodeType: 'http', httpMethod: 'POST', httpUrl: 'https://api.example.com' })

    expect(screen.getByText('Node configuration ready')).toBeInTheDocument()
    expect(screen.getByText('Request settings')).toBeInTheDocument()
    expect(screen.getByText('Method')).toBeInTheDocument()
    expect(screen.getByText('Request URL')).toBeInTheDocument()
    expect(screen.getByText('Headers')).toBeInTheDocument()
    expect(screen.getByText('Request body type')).toBeInTheDocument()
    expect(screen.getByText('Response variables')).toBeInTheDocument()
  })

  it('shows nested-pipeline handoff fields for pipeline nodes', () => {
    renderPanel({ agentId: 'agent-1', task: 'Run nested flow', nodeType: 'pipeline', pipelineTargetId: 'pipeline-2' })

    expect(screen.getByText('Node configuration ready')).toBeInTheDocument()
    expect(screen.getByText('Pipeline handoff')).toBeInTheDocument()
    expect(screen.getByText('Target pipeline id')).toBeInTheDocument()
    expect(screen.getByText('Input mapping')).toBeInTheDocument()
  })

  it('shows runtime fields for script nodes', () => {
    renderPanel({ agentId: 'agent-1', task: 'Run script', nodeType: 'script', scriptRuntime: 'python', scriptPath: 'scripts/run.py' })

    expect(screen.getByText('Node configuration ready')).toBeInTheDocument()
    expect(screen.getByText('Script runtime')).toBeInTheDocument()
    expect(screen.getByText('Runtime')).toBeInTheDocument()
    expect(screen.getByText('Script path')).toBeInTheDocument()
  })

  it('shows inline code fields for code nodes', () => {
    renderPanel({ agentId: 'agent-1', task: 'Run code', nodeType: 'code', codeLanguage: 'javascript', codeSource: 'function main(inputs) { return { result: inputs }; }' })

    expect(screen.getByText('Code execution')).toBeInTheDocument()
    expect(screen.getByText('Language')).toBeInTheDocument()
    expect(screen.getByText('Input mapping')).toBeInTheDocument()
    expect(screen.getByText('Output variables')).toBeInTheDocument()
  })

  it('shows template rendering fields for template nodes', () => {
    renderPanel({ agentId: 'agent-1', task: 'Render template', nodeType: 'template', templateBody: '{{ vars.title }}' })

    expect(screen.getByText('Template rendering')).toBeInTheDocument()
    expect(screen.getByText('Template body')).toBeInTheDocument()
  })

  it('shows variable assignment fields for variable nodes', () => {
    renderPanel({ agentId: 'agent-1', task: 'Assign vars', nodeType: 'variable', variableAssignments: [{ variable: 'result', mode: 'overwrite', value: '{{previous.output}}' }] })

    expect(screen.getByText('Variable assignments')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Add assignment' })).toBeInTheDocument()
  })

  it('shows iteration fields for iteration nodes', () => {
    renderPanel({ agentId: 'agent-1', task: '', nodeType: 'iteration', iterationSource: '{{vars.items}}', iterationPipelineTargetId: 'pipeline-2' })

    expect(screen.getByText('Iteration settings')).toBeInTheDocument()
    expect(screen.getByText('Array source')).toBeInTheDocument()
    expect(screen.getByText('Child pipeline')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Child Pipeline' })).toBeInTheDocument()
  })

  it('shows structural fields for parallel nodes and hides task-only sections', () => {
    renderPanel({ agentId: 'agent-1', task: '', nodeType: 'parallel', parallelBranches: 3 })

    expect(screen.getByText('Parallel branches')).toBeInTheDocument()
    expect(screen.getByText('Branch count')).toBeInTheDocument()
    expect(screen.queryByText('Model override')).not.toBeInTheDocument()
    expect(screen.queryByText('Export to variable')).not.toBeInTheDocument()
  })

  it('shows branch-specific fields for condition nodes', () => {
    renderPanel({ agentId: 'agent-1', task: 'Evaluate branch', nodeType: 'condition', conditionMode: 'any' })

    expect(screen.getByText('Node configuration ready')).toBeInTheDocument()
    expect(screen.getByText('Branch logic')).toBeInTheDocument()
    expect(screen.getByText('Condition mode')).toBeInTheDocument()
    expect(screen.getByText('If branch label')).toBeInTheDocument()
    expect(screen.getByText('Else branch label')).toBeInTheDocument()
    expect(screen.getByText('Named branches')).toBeInTheDocument()
  })

  it('does not offer boundary nodes or unsupported script runtimes in normal editing flows', () => {
    renderPanel({ agentId: 'agent-1', task: 'Run script', nodeType: 'script', scriptRuntime: 'python', scriptPath: 'scripts/run.py' })

    expect(screen.queryByRole('option', { name: 'Start' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'End' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Bash' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'PowerShell' })).not.toBeInTheDocument()
  })

  it('shows missing required fields when node configuration is incomplete', () => {
    renderPanel({ agentId: 'agent-1', task: '', nodeType: 'email' })

    expect(screen.getByText('Node configuration incomplete')).toBeInTheDocument()
    expect(screen.getByText(/Complete these required fields:/i)).toBeInTheDocument()
    expect(screen.getByText(/Task, To, Subject/i)).toBeInTheDocument()
  })

  it('shows editable start params and end outputs for workflow boundary nodes', () => {
    const { rerender } = render(
      <PipelineStepConfigPanel
        step={{ agentId: 'agent-1', task: '', nodeType: 'start', startParams: [{ key: 'topic', defaultValue: 'launch' }] }}
        stepIndex={0}
        totalSteps={2}
        enabledAgents={[{ id: 'agent-1', name: 'Writer' }]}
        agentNameMap={{ 'agent-1': 'Writer' }}
        models={[model]}
        onUpdateStep={vi.fn()}
        onMoveStep={vi.fn()}
        onDuplicateStep={vi.fn()}
        onRemoveStep={vi.fn()}
        onAppendReference={vi.fn()}
        formatDuration={() => '0ms'}
        normalizeRetryCount={(value) => value ?? 0}
        t={(_key, fallback) => fallback ?? ''}
      />,
    )

    expect(screen.getByText('Start parameters')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Add param' })).toBeInTheDocument()

    rerender(
      <PipelineStepConfigPanel
        step={{ agentId: 'agent-1', task: '', nodeType: 'end', endOutputs: [{ key: 'result', value: '{{previous.output}}' }] }}
        stepIndex={1}
        totalSteps={2}
        enabledAgents={[{ id: 'agent-1', name: 'Writer' }]}
        agentNameMap={{ 'agent-1': 'Writer' }}
        models={[model]}
        onUpdateStep={vi.fn()}
        onMoveStep={vi.fn()}
        onDuplicateStep={vi.fn()}
        onRemoveStep={vi.fn()}
        onAppendReference={vi.fn()}
        formatDuration={() => '0ms'}
        normalizeRetryCount={(value) => value ?? 0}
        t={(_key, fallback) => fallback ?? ''}
      />,
    )

    expect(screen.getByText('Workflow outputs')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Add output' })).toBeInTheDocument()
  })

  it('shows webhook, toolset, rag, and wiki selectors backed by workspace state', () => {
    const { rerender } = renderPanel({ agentId: 'agent-1', task: 'Send webhook', nodeType: 'webhook' })
    expect(screen.getByText('Webhook delivery')).toBeInTheDocument()
    expect(screen.getByText('Saved webhook target')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Support Webhook' })).toBeInTheDocument()

    rerender(
      <PipelineStepConfigPanel
        step={{ agentId: 'agent-1', task: 'Run tool', nodeType: 'toolset', toolsetId: 'ticketManagement', toolName: 'getTickets' }}
        stepIndex={0}
        totalSteps={1}
        enabledAgents={[{ id: 'agent-1', name: 'Writer' }]}
        agentNameMap={{ 'agent-1': 'Writer' }}
        models={[model]}
        onUpdateStep={vi.fn()}
        onMoveStep={vi.fn()}
        onDuplicateStep={vi.fn()}
        onRemoveStep={vi.fn()}
        onAppendReference={vi.fn()}
        formatDuration={() => '0ms'}
        normalizeRetryCount={(value) => value ?? 0}
        t={(_key, fallback) => fallback ?? ''}
      />,
    )
    expect(screen.getByText('Tool invocation')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Ticket Management' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'getTickets' })).toBeInTheDocument()

    rerender(
      <PipelineStepConfigPanel
        step={{ agentId: 'agent-1', task: 'Find docs', nodeType: 'rag', ragKnowledgeBaseId: 'kb-1', ragQuery: 'release notes' }}
        stepIndex={0}
        totalSteps={1}
        enabledAgents={[{ id: 'agent-1', name: 'Writer' }]}
        agentNameMap={{ 'agent-1': 'Writer' }}
        models={[model]}
        onUpdateStep={vi.fn()}
        onMoveStep={vi.fn()}
        onDuplicateStep={vi.fn()}
        onRemoveStep={vi.fn()}
        onAppendReference={vi.fn()}
        formatDuration={() => '0ms'}
        normalizeRetryCount={(value) => value ?? 0}
        t={(_key, fallback) => fallback ?? ''}
      />,
    )
    expect(screen.getByText('Knowledge retrieval')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Knowledge Base' })).toBeInTheDocument()
    expect(screen.getByText('Additional knowledge bases')).toBeInTheDocument()
    expect(screen.getAllByText('Metadata filter').length).toBeGreaterThan(0)

    rerender(
      <PipelineStepConfigPanel
        step={{ agentId: 'agent-1', task: 'Find wiki', nodeType: 'wiki', wikiId: 'kb-1', wikiQuery: 'runbook' }}
        stepIndex={0}
        totalSteps={1}
        enabledAgents={[{ id: 'agent-1', name: 'Writer' }]}
        agentNameMap={{ 'agent-1': 'Writer' }}
        models={[model]}
        onUpdateStep={vi.fn()}
        onMoveStep={vi.fn()}
        onDuplicateStep={vi.fn()}
        onRemoveStep={vi.fn()}
        onAppendReference={vi.fn()}
        formatDuration={() => '0ms'}
        normalizeRetryCount={(value) => value ?? 0}
        t={(_key, fallback) => fallback ?? ''}
      />,
    )
    expect(screen.getAllByText('Wiki search').length).toBeGreaterThan(0)
    expect(screen.getByText('Additional wikis')).toBeInTheDocument()
  })

  it('shows that smtp email nodes are disabled when workspace smtp settings are unavailable', () => {
    renderPanel({ agentId: 'agent-1', task: 'Send alert', nodeType: 'email' })

    expect(screen.getByText(/Workspace SMTP settings are not configured/i)).toBeInTheDocument()
  })
})