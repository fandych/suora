import { fireEvent, render, screen, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialogHost } from './ConfirmDialog'
import { confirm, useConfirmStore } from '@/services/confirmDialog'

describe('ConfirmDialogHost open guard', () => {
  beforeEach(() => {
    useConfirmStore.setState({ queue: [] })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-21T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    useConfirmStore.setState({ queue: [] })
  })

  it('ignores an Escape dismiss fired within the open guard window, then honors it afterwards', async () => {
    render(<ConfirmDialogHost />)

    let resolved: boolean | undefined
    act(() => {
      void confirm({ title: 'Delete?', body: 'Sure?', danger: true }).then((value) => {
        resolved = value
      })
    })

    expect(screen.getByText('Delete?')).toBeInTheDocument()

    // Immediate Escape (the tail of the opening interaction) must be ignored.
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    await Promise.resolve()
    expect(resolved).toBeUndefined()
    expect(screen.getByText('Delete?')).toBeInTheDocument()

    // After the guard window, Escape dismisses to false.
    act(() => {
      vi.setSystemTime(new Date('2026-07-21T00:00:01Z'))
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(resolved).toBe(false)
  })

  it('resolves true when the confirm button is clicked even within the guard window', async () => {
    render(<ConfirmDialogHost />)

    let resolved: boolean | undefined
    act(() => {
      void confirm({ title: 'Remove item?', body: 'Confirm removal', confirmText: 'Delete', danger: true }).then((value) => {
        resolved = value
      })
    })

    const confirmButton = screen.getByRole('button', { name: 'Delete' })
    act(() => {
      fireEvent.click(confirmButton)
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(resolved).toBe(true)
  })

  it('renders the confirmation dialog in a top-level stacking context', () => {
    render(<ConfirmDialogHost />)

    act(() => {
      void confirm({ title: 'Delete?', body: 'Sure?', danger: true })
    })

    expect(screen.getByRole('dialog')).toHaveClass('relative', 'z-[120]')
  })
})
