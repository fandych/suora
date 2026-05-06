import type { ReactNode } from 'react'
import { act } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PipelineLayout } from './PipelineLayout'
import { useAppStore } from '@/store/appStore'
import { loadPipelineExecutionsFromDisk, loadPipelinesFromDisk } from '@/services/pipelineFiles'
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
    vi.mocked(window.electron.invoke).mockReset()
    vi.mocked(window.electron.invoke).mockResolvedValue(undefined)
    vi.mocked(loadPipelinesFromDisk).mockResolvedValue([])
    vi.mocked(loadPipelineExecutionsFromDisk).mockResolvedValue([])
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
    vi.mocked(loadPipelinesFromDisk).mockResolvedValue([savedPipeline])
    vi.mocked(loadPipelineExecutionsFromDisk).mockResolvedValue([savedExecution])
    useAppStore.setState({
      workspacePath: '/workspace',
      selectedAgentPipelineId: savedPipeline.id,
      agentPipelines: [savedPipeline],
    })

    renderPipelineLayout()

    expect(await screen.findByText('Execution engine: Legacy')).toBeInTheDocument()
    expect(await screen.findAllByText('Workflow executor failed and fell back to legacy')).not.toHaveLength(0)
    expect(await screen.findByText('Routing diagnostics')).toBeInTheDocument()
    expect(await screen.findByText('Workflow SDK path is enabled but the Workflow executor is not configured; execution used the legacy pipeline executor.')).toBeInTheDocument()
  })
})
