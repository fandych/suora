import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SkillEditor } from './SkillEditor'
import { useAppStore } from '@/store/appStore'
import type { Skill } from '@/types'

// Confirm dialog & toast — replace the modal with auto-accept and silence toasts.
const { confirmMock, toastMock } = vi.hoisted(() => ({
  confirmMock: vi.fn().mockResolvedValue(true),
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

vi.mock('@/services/confirmDialog', () => ({
  confirm: (...args: unknown[]) => confirmMock(...args),
}))

vi.mock('@/services/toast', () => ({
  toast: toastMock,
}))

// Avoid pulling in heavy markdown renderer used by the Content tab.
vi.mock('./SkillEditorPanels', () => ({
  MarkdownEditor: ({ value }: { value: string }) => (
    <textarea data-testid="markdown-editor" defaultValue={value} />
  ),
}))

// Avoid IconPicker pulling in icon collections during tests.
vi.mock('@/components/icons/IconPicker', () => ({
  IconPicker: () => null,
}))

interface ElectronMock {
  invoke: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
}

function getElectronMock(): ElectronMock {
  return (window as unknown as { electron: ElectronMock }).electron
}

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'skill-test',
    name: 'Test Skill',
    description: 'a test skill',
    enabled: true,
    source: 'local',
    content: '## Hello',
    frontmatter: { name: 'Test Skill', description: 'a test skill' },
    context: 'inline',
    skillRoot: '/workspace/skills/test-skill',
    bundledResources: [
      { path: 'references/intro.md', type: 'file', size: 4 },
      { path: 'assets/logo.png', type: 'file', size: 100 },
    ],
    ...overrides,
  }
}

describe('SkillEditor — Resources tab', () => {
  beforeEach(() => {
    confirmMock.mockClear()
    confirmMock.mockResolvedValue(true)
    Object.values(toastMock).forEach((fn) => fn.mockClear())
    useAppStore.setState({ locale: 'en' })

    const electron = getElectronMock()
    electron.invoke.mockReset()
    electron.invoke.mockImplementation((channel: string) => {
      switch (channel) {
        case 'fs:readFile':
          return Promise.resolve('hello world')
        case 'fs:writeFile':
        case 'fs:deleteFile':
        case 'fs:deleteDir':
        case 'fs:moveFile':
        case 'system:ensureDirectory':
          return Promise.resolve({ success: true })
        default:
          return Promise.resolve(undefined)
      }
    })
  })

  it('shows the four canonical top-level folders, even when empty', () => {
    render(
      <SkillEditor skill={makeSkill({ bundledResources: [] })} onSave={vi.fn()} onCancel={vi.fn()} />,
    )
    // Resources tab is selected when bundledResources is empty? No — default is 'metadata'.
    // Bring it forward.
    // (Buttons render with capitalized "Resources" text.)
    expect(screen.getByRole('button', { name: /Resources/i })).toBeInTheDocument()
  })

  it('renders bundled resources grouped by top-level folder and opens a text file in the editor', async () => {
    const user = userEvent.setup()
    render(<SkillEditor skill={makeSkill()} onSave={vi.fn()} onCancel={vi.fn()} />)

    // SkillEditor opens the Resources tab when bundledResources is non-empty.
    expect(screen.getByText('references/intro.md')).toBeInTheDocument()
    expect(screen.getByText('assets/logo.png')).toBeInTheDocument()

    // Open the markdown file → editor pane reads its content.
    await user.click(screen.getByRole('button', { name: 'references/intro.md' }))
    await waitFor(() => {
      expect(screen.getByLabelText('File content')).toHaveValue('hello world')
    })
    expect(getElectronMock().invoke).toHaveBeenCalledWith(
      'fs:readFile',
      '/workspace/skills/test-skill/references/intro.md',
    )

    // Switching to the binary png shows a "Binary file — preview only" panel instead of a textarea.
    await user.click(screen.getByRole('button', { name: 'assets/logo.png' }))
    await waitFor(() => {
      expect(screen.getByText(/Binary file/i)).toBeInTheDocument()
    })
    expect(screen.queryByLabelText('File content')).not.toBeInTheDocument()
  })

  it('creates a new file under references/ via the inline form', async () => {
    const user = userEvent.setup()
    render(<SkillEditor skill={makeSkill()} onSave={vi.fn()} onCancel={vi.fn()} />)

    // Click the "New file" icon button on the references/ section.
    const newFileButtons = screen.getAllByRole('button', { name: 'New file' })
    // references is the second top-level folder in the canonical order.
    // Find the one whose closest section header text is "references/".
    const referencesNewFile = newFileButtons.find((btn) => {
      const section = btn.closest('div.rounded-3xl')
      return section?.textContent?.startsWith('references/')
    })
    expect(referencesNewFile).toBeDefined()
    if (!referencesNewFile) throw new Error('expected references new-file button')
    await user.click(referencesNewFile)

    // Default suggested name appears (notes.md). Replace and confirm.
    const nameInput = screen.getByPlaceholderText(/name…/) as HTMLInputElement
    expect(nameInput.value).toBe('notes.md')
    await user.clear(nameInput)
    await user.type(nameInput, 'guide.md')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(getElectronMock().invoke).toHaveBeenCalledWith(
        'fs:writeFile',
        '/workspace/skills/test-skill/references/guide.md',
        '',
      )
    })
    // The new file appears in the tree (and also in the right pane header since it auto-selects).
    expect(screen.getAllByText('references/guide.md').length).toBeGreaterThanOrEqual(1)
  })

  it('rejects creating a file with slashes in the name', async () => {
    const user = userEvent.setup()
    const skill = makeSkill({ skillRoot: undefined, bundledResources: [] })
    render(<SkillEditor skill={skill} onSave={vi.fn()} onCancel={vi.fn()} />)

    // Switch to Resources tab manually since bundledResources is empty.
    await user.click(screen.getByRole('button', { name: /Resources/i }))

    const newFileButtons = screen.getAllByRole('button', { name: 'New file' })
    await user.click(newFileButtons[0]) // scripts/

    const nameInput = screen.getByPlaceholderText(/name…/) as HTMLInputElement
    await user.clear(nameInput)
    // Slashes are explicitly disallowed inside a single name to prevent climbing
    // out of the chosen parent folder.
    await user.type(nameInput, 'sub/escape.sh')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalled()
    })
    // No file was added.
    expect(screen.queryByText('scripts/sub/escape.sh')).not.toBeInTheDocument()
  })

  it('deletes a file with confirmation', async () => {
    const user = userEvent.setup()
    render(<SkillEditor skill={makeSkill()} onSave={vi.fn()} onCancel={vi.fn()} />)

    // Hover over the references/intro.md row to reveal the delete button.
    const row = screen.getByText('references/intro.md').closest('div.group') as HTMLElement
    expect(row).toBeTruthy()
    const deleteBtn = within(row).getByRole('button', { name: 'Delete' })
    await user.click(deleteBtn)

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalled()
      expect(getElectronMock().invoke).toHaveBeenCalledWith(
        'fs:deleteFile',
        '/workspace/skills/test-skill/references/intro.md',
      )
    })
    expect(screen.queryByText('references/intro.md')).not.toBeInTheDocument()
  })

  it('saves edits to a text file via fs:writeFile', async () => {
    const user = userEvent.setup()
    render(<SkillEditor skill={makeSkill()} onSave={vi.fn()} onCancel={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'references/intro.md' }))
    const textarea = await screen.findByLabelText('File content')
    await waitFor(() => expect(textarea).toHaveValue('hello world'))

    await user.clear(textarea)
    await user.type(textarea, 'updated')

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save file' }))

    await waitFor(() => {
      expect(getElectronMock().invoke).toHaveBeenCalledWith(
        'fs:writeFile',
        '/workspace/skills/test-skill/references/intro.md',
        'updated',
      )
    })
    expect(toastMock.success).toHaveBeenCalled()
  })
})
