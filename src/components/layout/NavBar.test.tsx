import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NavBar } from './NavBar'

describe('NavBar', () => {
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
})
