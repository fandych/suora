import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { ShortcutsSettings } from './ShortcutsSettings'
import { useAppStore } from '@/store/appStore'

describe('ShortcutsSettings', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppStore.setState({
      locale: 'en',
      shortcuts: {
        'New Chat': 'Ctrl + N',
        'Search': 'Ctrl + K',
        'Send Message': 'Enter',
        'New Line': 'Shift + Enter',
        'Voice Input': 'Ctrl + Shift + V',
        'Toggle Sidebar': 'Ctrl + B',
        'Close Panel': 'Escape',
      },
    })
  })

  it('allows recording only for shortcuts that are live in the current workbench', () => {
    render(<ShortcutsSettings />)

    expect(screen.getByRole('button', { name: /Ctrl \+ K/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Ctrl \+ B/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Escape/i })).toBeDisabled()
  })

  it('shows the escape-cancel guidance only while recording', async () => {
    const user = userEvent.setup()

    render(<ShortcutsSettings />)

    expect(screen.getByText('Click a live shortcut below to record a new key binding.')).toBeVisible()
    expect(screen.queryByText('Escape cancels capture')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Ctrl \+ K/i }))

    expect(screen.getByText('Recording a live shortcut. Press Escape to cancel.')).toBeVisible()
    expect(screen.getByText('Escape cancels capture')).toBeVisible()
  })
})