import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/shared/button'
import { useAppStore } from '@/store/appStore'
import type { ScheduledTask } from '@/types'
import { TimerLayout } from './TimerLayout'

const { confirmMock } = vi.hoisted(() => ({
  confirmMock: vi.fn().mockResolvedValue(true),
}))

const electronInvokeMock = vi.fn()

vi.mock('@/services/confirmDialog', () => ({
  confirm: confirmMock,
}))

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
  TimerDetail: ({ timer, onOpenAssistant, onDelete }: { timer: ScheduledTask; onOpenAssistant?: () => void; onDelete?: () => void }) => (
    <div>
      <div>{timer.name}</div>
      <Button type="button" unstyled onClick={onOpenAssistant}>open-ai-edit</Button>
      <Button type="button" unstyled onClick={onDelete}>delete-timer</Button>
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
  const originalElectron = window.electron
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
    window.electron = originalElectron
    confirmMock.mockReset()
    confirmMock.mockResolvedValue(true)
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

    expect(screen.getAllByRole('button', { name: 'AI Create' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: '+ New' })).toHaveLength(2)

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

  it('disables creation affordances when the Electron bridge is unavailable', () => {
    // Browser preview has no desktop IPC, so timer mutations must stay disabled.
    // @ts-expect-error test-only override for browser-preview mode
    window.electron = undefined

    render(<TimerLayout />)

    expect(screen.getAllByRole('button', { name: 'AI Create' })[0]).toBeDisabled()
    expect(screen.getAllByRole('button', { name: '+ New' })[0]).toBeDisabled()
    expect(screen.getAllByText('Timer creation and execution are available in the Electron desktop app.').length).toBeGreaterThan(0)
    expect(screen.getByText('Open the Electron desktop app to create, run, or edit scheduled timers.')).toBeVisible()
    expect(electronInvokeMock).not.toHaveBeenCalled()
  })

  it('confirms before deleting the selected timer', async () => {
    const user = userEvent.setup()

    render(<TimerLayout />)

    await user.click(await screen.findByRole('button', { name: /Morning report/i }))
    await user.click(screen.getByRole('button', { name: 'delete-timer' }))

    expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Delete timer?',
      confirmText: 'Delete',
      danger: true,
    }))
    expect(electronInvokeMock).toHaveBeenCalledWith('timer:delete', 'timer-1')
  })

  it('does not delete the timer when confirmation is cancelled', async () => {
    const user = userEvent.setup()
    confirmMock.mockResolvedValueOnce(false)

    render(<TimerLayout />)

    await user.click(await screen.findByRole('button', { name: /Morning report/i }))
    await user.click(screen.getByRole('button', { name: 'delete-timer' }))

    expect(confirmMock).toHaveBeenCalled()
    expect(electronInvokeMock).not.toHaveBeenCalledWith('timer:delete', 'timer-1')
  })
})
