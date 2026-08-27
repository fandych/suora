import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModelsLayout } from './ModelsLayout'
import { useAppStore } from '@/store/appStore'

vi.mock('@/components/layout/SidePanel', () => ({
  SidePanel: ({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) => (
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
  useResizablePanel: () => [320, vi.fn()],
}))

vi.mock('@/services/aiService', () => ({
  testConnection: vi.fn().mockResolvedValue({ success: true, latency: 10 }),
}))

function renderModelsLayout(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/models/:view" element={<ModelsLayout />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ModelsLayout', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppStore.setState({
      locale: 'en',
      workspacePath: '',
      providerConfigs: [],
      models: [],
      selectedModel: null,
    })
  })

  it('shows a no-models message instead of an edit prompt when the models view is empty', () => {
    renderModelsLayout('/models/models')

    expect(screen.getAllByText('No models configured. Switch to Providers view and add one.').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Switch to Providers' })).toBeVisible()
    expect(screen.queryByText('Click a model to edit its parameters')).not.toBeInTheDocument()
  })

  it('navigates back to providers from the empty models view action', async () => {
    const user = userEvent.setup()

    renderModelsLayout('/models/models')

    await user.click(screen.getByRole('button', { name: 'Switch to Providers' }))

    expect(screen.getByRole('button', { name: 'Add provider' })).toBeVisible()
  })

  it('shows an action-oriented provider empty state instead of duplicating the sidebar copy', () => {
    renderModelsLayout('/models/providers')

    expect(screen.getByText('Start with a preset from the left, or add a custom provider to configure credentials and model availability.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Add custom provider' })).toBeVisible()
  })
})