import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store/appStore'
import type { ScheduledTask } from '@/types'
import { TimerDetail } from './TimerDetail'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

vi.mock('./timerHelpers', () => ({
  electronInvoke: vi.fn(),
  formatRelative: () => 'in 2 hours',
  formatDateTime: () => 'Aug 19, 2026, 10:00 AM',
}))

describe('TimerDetail', () => {
  it('shows cron timers as Cron instead of Repeating in the hero metadata', () => {
    useAppStore.setState({
      agents: [],
      agentPipelines: [],
    })

    const timer: ScheduledTask = {
      id: 'cron-1',
      name: 'Weekday digest',
      type: 'cron',
      schedule: '0 9 * * 1-5',
      action: 'notify',
      prompt: 'Send the digest',
      enabled: true,
      createdAt: 1,
      updatedAt: 1,
    }

    render(
      <TimerDetail
        timer={timer}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggle={() => {}}
      />,
    )

    expect(screen.getByText('Cron')).toBeVisible()
    expect(screen.queryByText('Repeating')).not.toBeInTheDocument()
  })
})