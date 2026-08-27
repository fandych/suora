import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PipelineFlowCanvas } from './PipelineFlowCanvas'

let lastReactFlowProps: { onEdgesChange?: (changes: Array<{ type: string; id: string }>) => void } | null = null

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, nodeTypes, children, onEdgesChange }: { nodes: Array<{ id: string; type: string; data: unknown }>; nodeTypes: Record<string, (props: { data: unknown }) => ReactNode>; children?: ReactNode; onEdgesChange?: (changes: Array<{ type: string; id: string }>) => void }) => {
    lastReactFlowProps = { onEdgesChange }
    return (
      <div data-testid="mock-reactflow">
        {nodes.map((node) => {
          const Component = nodeTypes[node.type]
          return Component ? <Component key={node.id} data={node.data} /> : null
        })}
        {children}
      </div>
    )
  },
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  ConnectionLineType: { SmoothStep: 'smoothstep' },
  Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom' },
  useNodesState: (initial: unknown) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown) => [initial, vi.fn(), vi.fn()],
  useViewport: () => ({ zoom: 1 }),
}))

vi.mock('@/components/shared/dropdown', () => ({
  Dropdown: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownButton: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => <button {...props}>{children}</button>,
  DropdownMenu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownSection: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownHeading: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownItem: ({ children, onClick, ...props }: { children?: ReactNode; onClick?: () => void } & Record<string, unknown>) => <button onClick={onClick} {...props}>{children}</button>,
  DropdownLabel: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  DropdownDescription: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}))

describe('PipelineFlowCanvas', () => {
  it('shows an interactive placeholder in flow view when the pipeline is empty', async () => {
    const user = userEvent.setup()
    const onAddStep = vi.fn()

    render(
      <PipelineFlowCanvas
        steps={[]}
        progressSteps={[]}
        agentNameMap={{}}
        onAddStep={onAddStep}
      />,
    )

    expect(screen.getByText('Start building this pipeline')).toBeVisible()
    expect(screen.getByText('Add the first step to see the workflow take shape in the canvas.')).toBeVisible()

    await user.click(screen.getByRole('button', { name: '+ Add Step' }))

    expect(onAddStep).toHaveBeenCalledTimes(1)
  })

  it('shows a lightweight step search panel for non-empty pipelines', async () => {
    const user = userEvent.setup()

    render(
      <PipelineFlowCanvas
        steps={[
          { agentId: 'agent-1', task: 'Draft the update', name: 'Draft update', enabled: true, continueOnError: true, retryCount: 0 },
          { agentId: 'agent-2', task: 'Review the draft', name: 'Review draft', enabled: true, continueOnError: true, retryCount: 0 },
        ]}
        progressSteps={[]}
        agentNameMap={{ 'agent-1': 'Writer', 'agent-2': 'Reviewer' }}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Search nodes...' }))
    await user.type(screen.getByPlaceholderText('Search nodes...'), 'review')

    expect(screen.getByRole('button', { name: /Review draft/i })).toBeVisible()
  })

  it('shows the top-left flow toolbar for node search and layout actions', () => {
    render(
      <PipelineFlowCanvas
        steps={[
          { agentId: 'agent-1', task: 'Draft the update', name: 'Draft update', enabled: true, continueOnError: true, retryCount: 0 },
        ]}
        progressSteps={[]}
        agentNameMap={{ 'agent-1': 'Writer' }}
      />,
    )

    expect(screen.getByRole('button', { name: /Hide Node library/i })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Auto layout' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Search nodes...' })).toBeVisible()
  })

  it('opens the next-node chooser and inserts the selected node type', async () => {
    const user = userEvent.setup()
    const onInsertStepAfter = vi.fn()

    render(
      <PipelineFlowCanvas
        steps={[
          { agentId: 'agent-1', task: 'Draft the update', name: 'Draft update', enabled: true, continueOnError: true, retryCount: 0, nodeType: 'agent' },
        ]}
        progressSteps={[]}
        agentNameMap={{ 'agent-1': 'Writer' }}
        onInsertStepAfter={onInsertStepAfter}
      />,
    )

    await user.click(screen.getByRole('button', { name: '+ next node' }))
    await user.click(screen.getByRole('button', { name: /HTTP \/ APIhttp External API request\./i }))

    expect(onInsertStepAfter).toHaveBeenCalledWith(0, 'http')
  })

  it('selects a node when the rendered card is clicked', async () => {
    const user = userEvent.setup()
    const onStepSelect = vi.fn()

    render(
      <PipelineFlowCanvas
        steps={[
          { agentId: 'agent-1', task: 'Draft the update', name: 'Draft update', enabled: true, continueOnError: true, retryCount: 0, nodeType: 'agent' },
        ]}
        progressSteps={[]}
        agentNameMap={{ 'agent-1': 'Writer' }}
        onStepSelect={onStepSelect}
      />,
    )

    await user.click(screen.getByText('Draft update'))

    expect(onStepSelect).toHaveBeenCalledWith(0)
  })

  it('shows setup-needed status on cards when a node is missing required configuration', () => {
    render(
      <PipelineFlowCanvas
        steps={[
          { agentId: 'agent-1', task: '', name: 'Send alert', enabled: true, continueOnError: true, retryCount: 0, nodeType: 'email' },
        ]}
        progressSteps={[]}
        agentNameMap={{ 'agent-1': 'Writer' }}
      />,
    )

    expect(screen.getByText('setup needed (3)')).toBeVisible()
  })

  it('surfaces cycle alerts and unreachable highlights from validation issues', () => {
    render(
      <PipelineFlowCanvas
        steps={[
          { id: 'start', agentId: 'agent-1', task: 'Draft', name: 'Draft', enabled: true, continueOnError: true, retryCount: 0 },
          { id: 'orphan', agentId: 'agent-1', task: 'Orphan', name: 'Orphan', enabled: true, continueOnError: true, retryCount: 0 },
        ]}
        progressSteps={[]}
        agentNameMap={{ 'agent-1': 'Writer' }}
        validationIssues={[
          { severity: 'error', code: 'cycle-detected', message: 'cycle detected' },
          { severity: 'warning', code: 'unreachable-node', message: 'orphan', stepIndex: 1 },
        ]}
      />,
    )

    expect(screen.getByText('Cycle detected in this workflow graph')).toBeVisible()
    expect(screen.getByText('1 unreachable node(s) highlighted')).toBeVisible()
    expect(screen.getByText('unreachable')).toBeVisible()
  })

  it('parses removed edges into disconnect callbacks', () => {
    const onDisconnectSteps = vi.fn()
    render(
      <PipelineFlowCanvas
        steps={[
          { agentId: 'agent-1', task: 'Draft', name: 'Draft', enabled: true, continueOnError: true, retryCount: 0 },
          { agentId: 'agent-1', task: 'Review', name: 'Review', enabled: true, continueOnError: true, retryCount: 0 },
        ]}
        progressSteps={[]}
        agentNameMap={{ 'agent-1': 'Writer' }}
        onDisconnectSteps={onDisconnectSteps}
      />,
    )

    lastReactFlowProps?.onEdgesChange?.([{ type: 'remove', id: 'step-0-step-1' }])

    expect(onDisconnectSteps).toHaveBeenCalledWith(0, 1)
  })
})