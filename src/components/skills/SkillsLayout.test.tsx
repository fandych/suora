import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SkillsLayout } from './SkillsLayout'
import { useAppStore } from '@/store/appStore'
import type { Skill } from '@/types'

vi.mock('./SkillEditor', () => ({
  SkillEditor: ({ skill, onSave }: { skill: Skill | null; onSave: (skill: Skill) => void }) => (
    <button
      type="button"
      onClick={() => onSave({
        ...(skill as Skill),
        name: 'New Skill',
        description: 'Saved description',
        frontmatter: { ...(skill?.frontmatter ?? {}), name: 'New Skill', description: 'Saved description' },
      })}
    >
      Mock Save Skill
    </button>
  ),
}))

function renderSkillsLayout() {
  return render(
    <MemoryRouter initialEntries={['/skills/installed']}>
      <Routes>
        <Route path="/skills/:view" element={<SkillsLayout />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SkillsLayout', () => {
  beforeEach(() => {
    useAppStore.setState({
      locale: 'en',
      workspacePath: '/workspace',
      skills: [],
      marketplace: { source: 'official', privateUrl: '', registrySources: [] },
    })
    window.electron.invoke = vi.fn().mockImplementation((channel: string) => {
      if (channel === 'system:ensureDirectory' || channel === 'fs:writeFile') return Promise.resolve({ success: true })
      if (channel === 'fs:listDir') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
  })

  it('persists a newly created local skill to the workspace skills root before storing it', async () => {
    const user = userEvent.setup()
    renderSkillsLayout()

    await user.click(screen.getByRole('button', { name: /\+ New/i }))
    await user.click(screen.getByRole('button', { name: 'Mock Save Skill' }))

    await waitFor(() => {
      expect(window.electron.invoke).toHaveBeenCalledWith('system:ensureDirectory', '/workspace/.suora/skills/new-skill')
      expect(window.electron.invoke).toHaveBeenCalledWith('fs:writeFile', '/workspace/.suora/skills/new-skill/SKILL.md', expect.any(String))
      expect(useAppStore.getState().skills[0]).toMatchObject({
        name: 'New Skill',
        skillRoot: '/workspace/.suora/skills/new-skill',
        filePath: '/workspace/.suora/skills/new-skill/SKILL.md',
      })
    })
  })
})
