import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/catalyst-ui/button'
import { SkillsLayout } from './SkillsLayout'
import { useAppStore } from '@/store/appStore'
import type { Skill } from '@/types'

vi.mock('@/components/icons/IconifyIcons', () => ({
  SkillIcon: () => <span data-testid="mock-skill-icon" />,
  IconifyIcon: () => <span data-testid="mock-iconify-icon" />,
  getSkillIconName: () => 'mock-skill-icon',
  useSkillIconsReady: () => true,
}))

vi.mock('./SkillEditor', () => ({
  SkillEditor: ({ skill, onSave }: { skill: Skill | null; onSave: (skill: Skill) => void }) => (
    <Button
      type="button"
      unstyled
      onClick={() => onSave({
        ...(skill as Skill),
        name: 'New Skill',
        description: 'Saved description',
        frontmatter: { ...(skill?.frontmatter ?? {}), name: 'New Skill', description: 'Saved description' },
      })}
    >
      Mock Save Skill
    </Button>
  ),
}))

function renderSkillsLayout(initialEntry = '/skills') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/skills" element={<SkillsLayout />} />
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
    await user.click(await screen.findByRole('button', { name: 'Mock Save Skill' }))

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

  it('toggles the Claude Code local skill source from the single skills view', async () => {
    const user = userEvent.setup()
    renderSkillsLayout('/skills')

    await user.click(screen.getByRole('checkbox', { name: 'Enable Claude Code' }))

    await waitFor(() => {
      expect(useAppStore.getState().externalDirectories).toContainEqual({
        path: '~/.claude/skills',
        enabled: true,
        type: 'skills',
      })
    })

    await waitFor(() => {
      expect(window.electron.invoke).toHaveBeenCalledWith('workspace:setExternalDirectories', ['~/.claude/skills', '~/.suora/skills'])
    })

    await user.click(screen.getByRole('checkbox', { name: 'Disable Claude Code' }))

    await waitFor(() => {
      expect(useAppStore.getState().externalDirectories).toContainEqual({
        path: '~/.claude/skills',
        enabled: false,
        type: 'skills',
      })
    })
  })

  it('uses a solid primary background for enabled local source toggles', () => {
    useAppStore.setState({
      externalDirectories: [{ path: '~/.claude/skills', enabled: true, type: 'skills' }],
    })

    renderSkillsLayout('/skills')

    const checkbox = screen.getByRole('checkbox', { name: 'Disable Claude Code' })
    expect(checkbox.closest('label')).toHaveClass('bg-accent')
  })

  it('does not render skills tabs or a skills search input', () => {
    renderSkillsLayout('/skills')

    expect(screen.queryByPlaceholderText('Search skills...')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Installed' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Browse' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sources' })).not.toBeInTheDocument()
  })

  it('shows only the two built-in local skill sources and maps legacy paths to the new ones', () => {
    useAppStore.setState({
      externalDirectories: [
        { path: '~/.claude/.suora/skills', enabled: true, type: 'skills' },
        { path: '~/.agents/skills', enabled: true, type: 'skills' },
        { path: 'C:/shared/skills', enabled: true, type: 'skills' },
      ],
    })

    renderSkillsLayout('/skills')

    expect(screen.getByText('~/.claude/skills')).toBeInTheDocument()
    expect(screen.getByText('~/.agents/skills')).toBeInTheDocument()
    expect(screen.queryByText('~/.claude/.suora/skills')).not.toBeInTheDocument()
    expect(screen.getByText('C:/shared/skills')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
  })

  it('filters installed skills by source tab label', async () => {
    const user = userEvent.setup()
    useAppStore.setState({
      workspacePath: '/workspace',
      skills: [
        {
          id: 'skill-local',
          name: 'Local Skill',
          description: 'Local description',
          enabled: true,
          source: 'local',
          content: 'local',
          context: 'inline',
          frontmatter: { name: 'Local Skill', description: 'Local description' },
        },
        {
          id: 'skill-shared',
          name: 'Shared Skill',
          description: 'Shared description',
          enabled: true,
          source: 'claude-dir',
          content: 'shared',
          context: 'inline',
          frontmatter: { name: 'Shared Skill', description: 'Shared description' },
        },
      ],
    })

    renderSkillsLayout('/skills')

    expect(screen.getByText('Local Skill')).toBeInTheDocument()
    expect(screen.getByText('Shared Skill')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Claude Code/i }))

    expect(screen.queryByText('Local Skill')).not.toBeInTheDocument()
    expect(screen.getByText('Shared Skill')).toBeInTheDocument()
  })
})

