import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { TimerForm } from './TimerForm'

describe('TimerForm', () => {
  it('preserves the existing schedule value when switching back to its original timer type', async () => {
    const user = userEvent.setup()

    render(
      <TimerForm
        initial={{
          id: 'timer-1',
          name: 'Morning report',
          type: 'interval',
          schedule: '30',
          action: 'notify',
          prompt: 'Ping me',
          enabled: true,
          createdAt: 1,
          updatedAt: 1,
        }}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    )

    expect(screen.getByDisplayValue('30')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Cron/i }))
    expect(screen.getByPlaceholderText('0 9 * * 1-5')).toHaveValue('')

    await user.click(screen.getByRole('button', { name: /Repeating/i }))
    expect(screen.getByDisplayValue('30')).toBeInTheDocument()
  })

  it('preserves per-type schedule drafts when switching between repeating and cron', async () => {
    const user = userEvent.setup()

    render(<TimerForm onSave={() => {}} onCancel={() => {}} />)

    await user.click(screen.getByRole('button', { name: /Repeating/i }))
    const intervalInput = screen.getByPlaceholderText('30')
    await user.type(intervalInput, '45')

    await user.click(screen.getByRole('button', { name: /Cron/i }))
    const cronInput = screen.getByPlaceholderText('0 9 * * 1-5')
    await user.type(cronInput, '0 8 * * 1-5')

    await user.click(screen.getByRole('button', { name: /Repeating/i }))
    expect(screen.getByDisplayValue('45')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Cron/i }))
    expect(screen.getByDisplayValue('0 8 * * 1-5')).toBeInTheDocument()
  })

  it('shows direct navigation actions for missing agent and pipeline prerequisites', async () => {
    const user = userEvent.setup()

    render(<TimerForm onSave={() => {}} onCancel={() => {}} />)

    expect(screen.queryByRole('button', { name: 'Open Agents' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Agent Prompt/i }))
    expect(screen.getByRole('button', { name: 'Open Agents' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: /^Pipeline$/i }))
    expect(screen.getByRole('button', { name: /Open pipeline/i })).toBeVisible()
  })

  it('shows the actual fallback agent name when no prompt agent is selected', async () => {
    const user = userEvent.setup()

    render(<TimerForm onSave={() => {}} onCancel={() => {}} />)

    await user.click(screen.getByRole('button', { name: /Agent Prompt/i }))

    expect(screen.getByText('Select an agent to execute the prompt, or leave empty to use Assistant.')).toBeVisible()
  })

  it('requires a notification or prompt body before enabling save', async () => {
    const user = userEvent.setup()

    render(<TimerForm onSave={() => {}} onCancel={() => {}} />)

    const createButton = screen.getByRole('button', { name: 'Create Timer' })
    const nameInput = screen.getByPlaceholderText('Reminder name')
    const scheduleInput = screen.getByLabelText('Schedule date and time')
    const bodyInput = screen.getByPlaceholderText('Reminder text...')

    await user.type(nameInput, 'Morning reminder')
    await user.type(scheduleInput, '2026-08-20T09:00')

    expect(createButton).toBeDisabled()

    await user.type(bodyInput, 'Stand up and stretch')
    expect(createButton).toBeEnabled()

    await user.click(screen.getByRole('button', { name: /Agent Prompt/i }))
    await user.clear(bodyInput)
    expect(createButton).toBeDisabled()
  })

  it('blocks invalid interval schedules before enabling save', async () => {
    const user = userEvent.setup()

    render(<TimerForm onSave={() => {}} onCancel={() => {}} />)

    await user.type(screen.getByPlaceholderText('Reminder name'), 'Interval reminder')
    await user.click(screen.getByRole('button', { name: /Repeating/i }))

    const intervalInput = screen.getByPlaceholderText('30')
    const bodyInput = screen.getByPlaceholderText('Reminder text...')
    const createButton = screen.getByRole('button', { name: 'Create Timer' })

    await user.type(intervalInput, '0')
    await user.type(bodyInput, 'Every interval')
    expect(createButton).toBeDisabled()

    await user.clear(intervalInput)
    await user.type(intervalInput, '15')
    expect(createButton).toBeEnabled()
  })
})