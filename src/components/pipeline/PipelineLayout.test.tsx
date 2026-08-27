import type { ReactNode } from 'react'
import { act } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PipelineLayout } from './PipelineLayout'
import { useAppStore } from '@/store/appStore'
import { loadPipelineExecutionsFromDisk, loadPipelinesFromDisk } from '@/services/pipelineFiles'
import { dryRunAgentPipeline } from '@/services/agentPipelineService'
import type { Agent, AgentPipeline, AgentPipelineExecution, Model } from '@/types'

vi.mock('@/components/icons/IconifyIcons', () => ({
  IconifyIcon: () => <span data-testid="mock-icon" />,
}))

vi.mock('@/components/layout/SidePanel', () => ({
  SidePanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/layout/ResizeHandle', () => ({
  ResizeHandle: () => <div data-testid="resize-handle" />,
}))

vi.mock('@/components/pipeline/PipelineFlowDiagram', () => ({
  PipelineFlowDiagram: () => <div data-testid="pipeline-diagram" />,
}))

vi.mock('@/components/pipeline/PipelineFlowCanvas', () => ({
  PipelineFlowCanvas: ({ leftPanelContent, topRightPanelContent, rightPanelContent }: { leftPanelContent?: ReactNode; topRightPanelContent?: ReactNode; rightPanelContent?: ReactNode }) => (
    <div data-testid="pipeline-flow-canvas">
      {leftPanelContent}
      {topRightPanelContent}
      {rightPanelContent}
    </div>
  ),
}))

vi.mock('@/components/pipeline/PipelineAssistantDrawer', () => ({
  PipelineAssistantDrawer: ({ mode }: { mode: 'create' | 'edit' }) => <div data-testid="pipeline-assistant-drawer">{mode}</div>,
}))

vi.mock('@/hooks/useResizablePanel', () => ({
  useResizablePanel: () => [320, vi.fn()],
}))

vi.mock('@/services/agentPipelineService', () => ({
  executeAgentPipeline: vi.fn(),
  dryRunAgentPipeline: vi.fn(),
}))

vi.mock('@/services/pipelineFiles', () => ({
  loadPipelinesFromDisk: vi.fn().mockResolvedValue([]),
  loadPipelineExecutionsFromDisk: vi.fn().mockResolvedValue([]),
  savePipelineToDisk: vi.fn().mockResolvedValue(true),
  deletePipelineFromDisk: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/services/fileStorage', async () => {
  const actual = await vi.importActual<typeof import('@/services/fileStorage')>('@/services/fileStorage')
  return {
    ...actual,
    flushPendingSplitStoreWrites: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('@/services/confirmDialog', () => ({
  confirm: vi.fn().mockResolvedValue(true),
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

const agent: Agent = {
  id: 'agent-1',
  name: 'Writer',
  systemPrompt: 'Write well',
  modelId: 'model-1',
  skills: [],
  enabled: true,
  memories: [],
  autoLearn: false,
}

const savedPipeline: AgentPipeline = {
  id: 'pipeline-1',
  name: 'Launch Flow',
  description: 'Saved description',
  steps: [{ agentId: 'agent-1', task: 'Draft {{vars.topic}}' }],
  variables: [{ name: 'topic', defaultValue: 'launch' }],
  createdAt: 1,
  updatedAt: 2,
}

const savedExecution: AgentPipelineExecution = {
  id: 'execution-1',
  pipelineId: savedPipeline.id,
  pipelineName: savedPipeline.name,
  trigger: 'manual',
  startedAt: 1000,
  completedAt: 3000,
  status: 'success',
  steps: [
    {
      id: 'step-exec-1',
      stepIndex: 0,
      agentId: agent.id,
      task: 'Draft launch brief',
      input: 'Draft launch brief',
      output: 'Done',
      status: 'success',
      startedAt: 1000,
      completedAt: 3000,
      durationMs: 2000,
    },
  ],
  finalOutput: 'Done',
  runtime: {
    runId: 'run-1',
    agentIds: [agent.id],
    modelIds: [model.id],
    startedAt: 1000,
    trigger: 'manual',
    executionEngine: 'legacy',
    executionFallbackReason: 'workflow_executor_error',
    validationWarnings: ['Workflow SDK path is enabled but the Workflow executor is not configured; execution used the legacy pipeline executor.'],
  },
}

function renderPipelineLayout() {
  return render(
    <MemoryRouter initialEntries={['/pipeline']}>
      <Routes>
        <Route path="/pipeline" element={<PipelineLayout />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PipelineLayout', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      value: (callback: () => void) => {
        callback()
        return 1
      },
    })
    Object.defineProperty(window, 'cancelIdleCallback', {
      configurable: true,
      value: vi.fn(),
    })
    vi.mocked(window.electron.invoke).mockReset()
    vi.mocked(window.electron.invoke).mockResolvedValue(undefined)
    vi.mocked(loadPipelinesFromDisk).mockResolvedValue([])
    vi.mocked(loadPipelineExecutionsFromDisk).mockResolvedValue([])
    vi.mocked(dryRunAgentPipeline).mockReturnValue({
      pipelineId: savedPipeline.id,
      pipelineName: savedPipeline.name,
      steps: [
        { stepIndex: 0, agentId: agent.id, task: 'Draft {{vars.topic}}', resolvedInput: 'Draft launch', status: 'would-run' },
      ],
      visitedStepIndices: [0],
      variables: { topic: 'launch' },
      validationWarnings: [],
      validationErrors: [],
      valid: true,
    })
    localStorage.clear()

    useAppStore.setState({
      locale: 'en',
      workspacePath: '',
      agents: [agent],
      models: [model],
      agentPipeline: [],
      agentPipelineName: '',
      selectedAgentPipelineId: savedPipeline.id,
      agentPipelines: [savedPipeline],
      notifications: [],
    })
  })

  it('keeps unsaved edits when the saved pipeline list refreshes', async () => {
    const user = userEvent.setup()
    renderPipelineLayout()

    await user.click(screen.getByRole('button', { name: 'General' }))

    const description = await screen.findByPlaceholderText('What this workflow prepares, checks, or hands off...')
    await waitFor(() => expect(description).toHaveValue('Saved description'))

    await user.clear(description)
    await user.type(description, 'Unsaved draft description')
    await user.click(screen.getByRole('button', { name: '+ Add variable' }))
    const variableNameInputs = screen.getAllByPlaceholderText('name')
    await user.type(variableNameInputs[1], 'mode')

    act(() => {
      useAppStore.getState().setAgentPipelines([
        {
          ...savedPipeline,
          description: 'Background refresh description',
          updatedAt: 99,
        },
      ])
    })

    await waitFor(() => {
      expect(description).toHaveValue('Unsaved draft description')
      expect(screen.getAllByPlaceholderText('name')[1]).toHaveValue('mode')
    })
  })

  it('preserves run values when a variable is renamed', async () => {
    const user = userEvent.setup()
    renderPipelineLayout()

    await user.click(screen.getByRole('button', { name: 'General' }))

    const runValueInput = await screen.findByRole('textbox', { name: 'topic' })
    const variableNameInput = screen.getByDisplayValue('topic')

    await user.clear(runValueInput)
    await user.type(runValueInput, 'custom value')
    await user.clear(variableNameInput)
    await user.type(variableNameInput, 'subject')

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'subject' })).toHaveValue('custom value')
      expect(screen.getByDisplayValue('subject')).toBeInTheDocument()
    })
  })

  it('shows execution engine and fallback diagnostics in history details', async () => {
    const user = userEvent.setup()
    vi.mocked(loadPipelinesFromDisk).mockResolvedValue([savedPipeline])
    vi.mocked(loadPipelineExecutionsFromDisk).mockResolvedValue([savedExecution])
    useAppStore.setState({
      workspacePath: '/workspace',
      selectedAgentPipelineId: savedPipeline.id,
      agentPipelines: [savedPipeline],
    })

    renderPipelineLayout()

  await user.click(await screen.findByRole('button', { name: 'Others' }))

    await screen.findByText('Routing diagnostics')
    expect(screen.getByText('Execution engine')).toBeInTheDocument()
    expect(screen.getAllByText('Legacy').length).toBeGreaterThan(0)
    expect(await screen.findAllByText('Workflow executor failed and fell back to legacy')).not.toHaveLength(0)
    expect(await screen.findByText('Workflow SDK path is enabled but the Workflow executor is not configured; execution used the legacy pipeline executor.')).toBeInTheDocument()
  })

  it('shows only saved pipelines in the sidebar list', async () => {
    renderPipelineLayout()

    expect(await screen.findByText('Saved pipelines')).toBeInTheDocument()
    expect(screen.queryByText('Current draft')).not.toBeInTheDocument()
    expect(screen.queryByText('Loaded from Launch Flow')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Launch Flow/i })).toHaveLength(1)
  })

  it('labels never-run saved pipelines as awaiting first run instead of unsaved', async () => {
    renderPipelineLayout()

    expect(await screen.findByText('Awaiting first run')).toBeInTheDocument()
    expect(screen.queryByText('Unsaved')).not.toBeInTheDocument()
  })

  it('opens the AI edit drawer from the simplified header action set', async () => {
    const user = userEvent.setup()
    renderPipelineLayout()

    await user.click(await screen.findByRole('button', { name: 'AI Edit' }))

    expect(await screen.findByTestId('pipeline-assistant-drawer')).toHaveTextContent('edit')
  })

  it('opens the AI edit drawer for the selected saved pipeline', async () => {
    const user = userEvent.setup()
    renderPipelineLayout()

    await user.click(await screen.findByRole('button', { name: 'AI Edit' }))

    expect(await screen.findByTestId('pipeline-assistant-drawer')).toHaveTextContent('edit')
  })

  it('does not show validation noise for an untouched empty draft', async () => {
    useAppStore.setState({
      agentPipeline: [],
      agentPipelineName: '',
      selectedAgentPipelineId: null,
      agentPipelines: [],
    })

    renderPipelineLayout()

    expect(await screen.findByText('Draft pipeline')).toBeInTheDocument()
    expect(screen.queryByText('Dry-run validation')).not.toBeInTheDocument()
    expect(screen.queryByText('ERROR: Pipeline has no enabled steps.')).not.toBeInTheDocument()
    expect(screen.queryByText('Step configuration')).not.toBeInTheDocument()
    expect(screen.queryByText('Execution monitor')).not.toBeInTheDocument()
  })

  it('keeps properties hidden until a node is selected on the design canvas', async () => {
    useAppStore.setState({
      agentPipeline: [{ agentId: 'agent-1', task: 'Draft launch brief', name: 'Draft brief' }],
      agentPipelineName: 'Draft pipeline',
      selectedAgentPipelineId: null,
      agentPipelines: [],
    })

    renderPipelineLayout()

    expect(screen.queryByText('Step configuration')).not.toBeInTheDocument()
  })

  it('uses distinct execution-history hints before the pipeline is saved', async () => {
    const user = userEvent.setup()
    useAppStore.setState({
      agentPipeline: [],
      agentPipelineName: '',
      selectedAgentPipelineId: null,
      agentPipelines: [],
    })

    renderPipelineLayout()

  await user.click(screen.getByRole('button', { name: 'Others' }))

    expect((await screen.findAllByText('Execution history appears after you save this draft as a reusable pipeline.')).length).toBeGreaterThan(0)
    expect(screen.getByText('Save the pipeline first to keep execution history and let timers reference it.')).toBeInTheDocument()
    expect(screen.getAllByText('Save the pipeline first to keep execution history and let timers reference it.')).toHaveLength(1)
  })

  it('disables agent-based step creation when no runnable agents are available', async () => {
    useAppStore.setState({
      agents: [],
      agentPipeline: [],
      selectedAgentPipelineId: null,
      agentPipelines: [],
    })

    renderPipelineLayout()

    expect(await screen.findByText('Configure at least one runnable agent before adding agent or condition nodes.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agent' })).toBeDisabled()
  })

  it('shows dry-run progress summary cards when the dry run panel is open', async () => {
    const user = userEvent.setup()
    renderPipelineLayout()

    await user.click(await screen.findByRole('button', { name: 'Open dry run panel' }))
    await user.click(await screen.findByRole('button', { name: 'Dry run' }))

    expect(await screen.findByText('Progress')).toBeInTheDocument()
    expect(screen.getByText(/Would run:/)).toBeInTheDocument()
    expect(screen.getByText(/Skipped:/)).toBeInTheDocument()
    expect(screen.getByText(/Error:/)).toBeInTheDocument()
    expect(screen.getByText(/Disabled:/)).toBeInTheDocument()
  })

  it('opens import and export dialogs instead of relying on prompt interactions', async () => {
    const user = userEvent.setup()
    useAppStore.setState({
      workspacePath: '/workspace',
      agentPipeline: [{ agentId: 'agent-1', task: 'Draft {{vars.topic}}' }],
      agentPipelineName: 'Launch Flow',
      selectedAgentPipelineId: null,
      agentPipelines: [],
    })

    renderPipelineLayout()

    await user.click(screen.getByRole('button', { name: 'Import JSON' }))
    expect(await screen.findByText('Paste a workflow export or a bare pipeline JSON object to load it into the current draft.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Export JSON' }))
    expect(await screen.findByText('Copy this portable workflow JSON to move the current draft across workspaces.')).toBeInTheDocument()
  })

  it('creates a first workflow from the node library and enables saving the draft', async () => {
    const user = userEvent.setup()
    useAppStore.setState({
      agentPipeline: [],
      agentPipelineName: '',
      selectedAgentPipelineId: null,
      agentPipelines: [],
      workspacePath: '/workspace',
      agents: [agent],
      models: [model],
    })

    renderPipelineLayout()

    await user.click(await screen.findByRole('button', { name: 'Script Execution' }))

    expect(await screen.findByText('Draft pipeline')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '▶ Run Pipeline' })).toBeDisabled()
  })
})
