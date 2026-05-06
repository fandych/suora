import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { NavBar } from './NavBar'
import { useAppStore } from '@/store/appStore'

function LocationProbe() {
  const location = useLocation()
  return <div>{`${location.pathname}${location.search}`}</div>
}

describe('NavBar', () => {
  beforeEach(() => {
    useAppStore.setState({
      notifications: [],
      activeModule: 'chat',
    })
  })

  it('renders a semantic main navigation with primary destinations', () => {
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <NavBar />
      </MemoryRouter>,
    )

    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Agents' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeVisible()
  })

  it('navigates when a destination button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <NavBar />
        <Routes>
          <Route path="/chat" element={<div>Chat page</div>} />
          <Route path="/models" element={<div>Models page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Models' }))
    expect(screen.getByText('Models page')).toBeInTheDocument()
  })

  it('uses notification action path when provided', async () => {
    const user = userEvent.setup()
    useAppStore.setState({
      notifications: [
        {
          id: 'notif-1',
          type: 'success',
          title: 'Pipeline completed',
          timestamp: Date.now(),
          read: false,
          action: {
            module: 'pipeline',
            label: 'Open pipeline run',
            path: '/pipeline?pipelineId=pipeline-1&executionId=exec-1',
          },
        },
      ],
    })

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <NavBar />
        <Routes>
          <Route path="/chat" element={<div>Chat page</div>} />
          <Route path="/pipeline" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /notifications/i }))
    await user.click(screen.getByRole('button', { name: /pipeline completed/i }))

    expect(screen.getByText('/pipeline?pipelineId=pipeline-1&executionId=exec-1')).toBeInTheDocument()
  })
})
