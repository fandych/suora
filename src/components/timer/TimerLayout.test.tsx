import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store/appStore'
import type { ScheduledTask } from '@/types'
import { TimerLayout } from './TimerLayout'

const electronInvokeMock = vi.fn()

vi.mock('@/components/layout/SidePanel', () => ({
  SidePanel: ({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) => (
    <div>
      <div>{title}</div>
      {action}
      {children}
    </div>
  ),
}))

vi.mock('@/components/layout/ResizeHandle', () => ({
  ResizeHandle: () => null,
}))

vi.mock('@/hooks/useResizablePanel', () => ({
  useResizablePanel: () => [280, vi.fn()],
}))

vi.mock('./TimerForm', () => ({
  TimerForm: () => <div>timer-form</div>,
}))

vi.mock('./TimerDetail', () => ({
  TimerDetail: ({ timer, onOpenAssistant }: { timer: ScheduledTask; onOpenAssistant?: () => void }) => (
    <div>
      <div>{timer.name}</div>
      <button type="button" onClick={onOpenAssistant}>open-ai-edit</button>
    </div>
  ),
}))

vi.mock('./TimerAssistantDrawer', () => ({
  TimerAssistantDrawer: ({ mode, timer }: { mode: 'create' | 'edit'; timer?: ScheduledTask | null }) => (
    <div data-testid="timer-assistant-drawer">{`${mode}:${timer?.id ?? 'new'}`}</div>
  ),
}))

vi.mock('./timerHelpers', () => ({
  electronInvoke: (...args: unknown[]) => electronInvokeMock(...args),
  electronOn: vi.fn(),
  electronOff: vi.fn(),
  formatRelative: () => 'in 1 hour',
  TIMER_REFRESH_INTERVAL_MS: 30000,
}))

vi.mock('@/services/pipelineFiles', () => ({
  loadPipelinesFromDisk: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/services/timerRuntime', () => ({
  handleTimerFired: vi.fn(),
}))

describe('TimerLayout', () => {
  const timer: ScheduledTask = {
    id: 'timer-1',
    name: 'Morning report',
    type: 'once',
    schedule: '2026-05-10T01:00:00.000Z',
    action: 'notify',
    prompt: 'Read the report',
    enabled: true,
    createdAt: 2,
    updatedAt: 2,
    nextRun: 2,
  }

  beforeEach(() => {
    localStorage.clear()
    electronInvokeMock.mockReset()
    electronInvokeMock.mockImplementation(async (channel: string) => {
      if (channel === 'timer:list') return { timers: [timer] }
      return {}
    })

    useAppStore.setState({
      workspacePath: '',
      agentPipelines: [],
      sessions: [],
      activeSessionId: null,
      openSessionTabs: [],
    })
  })

  it('opens the timer assistant in create mode from the sidebar action', async () => {
    const user = userEvent.setup()

    render(<TimerLayout />)

    await waitFor(() => expect(electronInvokeMock).toHaveBeenCalledWith('timer:list'))

    await user.click(screen.getAllByRole('button', { name: 'AI Create' })[0])

    expect(screen.getByTestId('timer-assistant-drawer')).toHaveTextContent('create:new')
  })

  it('opens the timer assistant in edit mode for the selected timer', async () => {
    const user = userEvent.setup()

    render(<TimerLayout />)

    await user.click(await screen.findByRole('button', { name: /Morning report/i }))
    await user.click(screen.getByRole('button', { name: 'open-ai-edit' }))

    expect(screen.getByTestId('timer-assistant-drawer')).toHaveTextContent('edit:timer-1')
  })
})