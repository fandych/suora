import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DocumentsLayout } from './DocumentsLayout'
import { useAppStore } from '@/store/appStore'
import { createDocument, createDocumentGroup } from '@/services/documents'

vi.mock('@tiptap/react', () => ({
  EditorContent: ({ className }: { className?: string }) => <div data-testid="editor-content" className={className} />,
  useEditor: () => ({
    isDestroyed: false,
    commands: {
      setContent: vi.fn(),
    },
  }),
}))

vi.mock('@tiptap/starter-kit', () => ({
  default: {},
}))

vi.mock('@tiptap/extension-placeholder', () => ({
  default: {
    configure: () => ({}),
  },
}))

vi.mock('@tiptap/extension-image', () => ({
  default: {
    configure: () => ({}),
  },
}))

vi.mock('@/components/documents/DocumentExtensions', () => ({
  MathBlock: {},
  InlineMath: {},
  MermaidBlock: {},
}))

vi.mock('@/components/documents/DocumentGraphView', () => ({
  DocumentGraphView: () => <div data-testid="document-graph" />,
}))

const confirmMock = vi.fn().mockResolvedValue(true)

vi.mock('@/services/confirmDialog', () => ({
  confirm: (...args: unknown[]) => confirmMock(...args),
}))

describe('DocumentsLayout', () => {
  beforeEach(() => {
    localStorage.clear()
    confirmMock.mockClear()
    vi.mocked(window.electron.invoke).mockReset()
    vi.mocked(window.electron.invoke).mockResolvedValue(undefined)
    useAppStore.setState({
      locale: 'en',
      documentGroups: [],
      documentNodes: [],
      selectedDocumentGroupId: null,
      selectedDocumentId: null,
    })
  })

  it('creates a new group with a welcome document', async () => {
    const user = userEvent.setup()

    render(<DocumentsLayout />)

    await user.click(screen.getByRole('button', { name: 'Create your first document group' }))

    await waitFor(() => {
      expect(useAppStore.getState().documentGroups).toHaveLength(1)
      expect(useAppStore.getState().documentNodes.some((node) => node.type === 'document' && node.title === 'Welcome')).toBe(true)
    })

    expect(screen.getByRole('textbox', { name: 'Document title' })).toHaveValue('Welcome')
  })

  it('supports folder and document CRUD plus search', async () => {
    const user = userEvent.setup()
    const group = createDocumentGroup('Docs')
    const rootDoc = createDocument(group.id, null, 'Intro')

    useAppStore.setState({
      locale: 'en',
      documentGroups: [group],
      documentNodes: [rootDoc],
      selectedDocumentGroupId: group.id,
      selectedDocumentId: rootDoc.id,
    })

    render(<DocumentsLayout />)

    expect(screen.getByText('Intro.md')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'More actions: Docs' }))
    await user.click(screen.getByRole('menuitem', { name: 'New Folder' }))
    const nodeNameInput = screen.getByRole('textbox', { name: 'Document or folder name' })
    await user.clear(nodeNameInput)
    await user.type(nodeNameInput, 'Specs')
    await user.keyboard('{Enter}')

    const folder = await waitFor(() => {
      const nextFolder = useAppStore.getState().documentNodes.find((node) => node.type === 'folder' && node.title === 'Specs')
      expect(nextFolder).toBeTruthy()
      return nextFolder
    })

    await user.click(screen.getByRole('button', { name: 'More actions: Specs' }))
    await user.click(screen.getByRole('menuitem', { name: 'New child document' }))

    const childDocument = await waitFor(() => {
      const nextDoc = useAppStore.getState().documentNodes.find((node) => node.type === 'document' && node.parentId === folder?.id && node.id !== rootDoc.id)
      expect(nextDoc).toBeTruthy()
      return nextDoc
    })

    const titleInput = screen.getByRole('textbox', { name: 'Document title' })
    await user.clear(titleInput)
    await user.type(titleInput, 'Roadmap')

    await waitFor(() => {
      expect(useAppStore.getState().documentNodes.some((node) => node.id === childDocument?.id && node.type === 'document' && node.title === 'Roadmap')).toBe(true)
    })

    const searchInput = screen.getByPlaceholderText('Progressively search markdown…')
    await user.clear(searchInput)
    await user.type(searchInput, 'Road')

    expect(screen.getAllByText('Docs / Specs / Roadmap.md')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Delete current document' }))

    await waitFor(() => {
      expect(useAppStore.getState().documentNodes.some((node) => node.id === childDocument?.id)).toBe(false)
    })

    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(useAppStore.getState().documentNodes.filter((node) => node.type === 'document')).toHaveLength(1)
  })

  it('preserves script extensions and uses source editing for non-markdown documents', async () => {
    const user = userEvent.setup()
    const group = createDocumentGroup('Docs')
    const rootDoc = createDocument(group.id, null, 'Intro')

    useAppStore.setState({
      locale: 'en',
      documentGroups: [group],
      documentNodes: [rootDoc],
      selectedDocumentGroupId: group.id,
      selectedDocumentId: rootDoc.id,
    })

    render(<DocumentsLayout />)

    await user.click(screen.getByRole('button', { name: 'More actions: Intro.md' }))
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }))
    const nodeNameInput = screen.getByRole('textbox', { name: 'Document or folder name' })
    await user.clear(nodeNameInput)
    await user.type(nodeNameInput, 'deploy.sh')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(useAppStore.getState().documentNodes.some((node) => node.id === rootDoc.id && node.type === 'document' && node.title === 'deploy.sh')).toBe(true)
    })

    expect(screen.getByText('deploy.sh')).toBeInTheDocument()
    expect(screen.getAllByText('SH').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Editor' })).toBeDisabled()
    expect(screen.getByPlaceholderText('Edit this text or script file.')).toBeInTheDocument()
  })

  it('supports tab indentation in source editing for scripts', async () => {
    const user = userEvent.setup()
    const group = createDocumentGroup('Docs')
    const script = createDocument(group.id, null, 'deploy.sh')

    useAppStore.setState({
      locale: 'en',
      documentGroups: [group],
      documentNodes: [script],
      selectedDocumentGroupId: group.id,
      selectedDocumentId: script.id,
    })

    render(<DocumentsLayout />)

    const sourceEditor = screen.getByRole('textbox', { name: 'Source editor' }) as HTMLTextAreaElement
    await user.click(sourceEditor)
    await user.type(sourceEditor, 'echo hi')
    fireEvent.keyDown(sourceEditor, { key: 'Tab' })

    expect(sourceEditor).toHaveValue('echo hi  ')

    sourceEditor.focus()
    sourceEditor.setSelectionRange(0, 0)
    fireEvent.keyDown(sourceEditor, { key: 'Tab' })

    expect(sourceEditor).toHaveValue('  echo hi  ')

    sourceEditor.setSelectionRange(0, sourceEditor.value.length)
    fireEvent.keyDown(sourceEditor, { key: 'Tab', shiftKey: true })

    expect(sourceEditor).toHaveValue('echo hi  ')
    expect(screen.getByText('1 line')).toBeInTheDocument()
    expect(screen.getByText('2 words')).toBeInTheDocument()
  })

  it('surfaces markdown image references as document assets', () => {
    const group = createDocumentGroup('Docs')
    const rootDoc = {
      ...createDocument(group.id, null, 'Intro'),
      markdown: '# Intro\n\n![Logo](./assets/logo.png "Logo")',
    }

    useAppStore.setState({
      locale: 'en',
      documentGroups: [group],
      documentNodes: [rootDoc],
      selectedDocumentGroupId: group.id,
      selectedDocumentId: rootDoc.id,
    })

    render(<DocumentsLayout />)

    expect(screen.getByText('Assets')).toBeInTheDocument()
    expect(screen.getByText('./assets/logo.png')).toBeInTheDocument()
    expect(screen.getByText('Logo')).toBeInTheDocument()
  })

  it('shows graph-related notes and exports the active group as a graphify corpus', async () => {
    const user = userEvent.setup()
    const group = createDocumentGroup('Knowledge Base')
    const overview = {
      ...createDocument(group.id, null, 'Project Overview'),
      markdown: 'Read [Budget](#doc:budget). #amber',
    }
    const budget = {
      ...createDocument(group.id, null, 'Budget'),
      id: 'budget',
      markdown: 'Total budget: 42000. #amber',
    }
    const release = {
      ...createDocument(group.id, null, 'Release Plan'),
      markdown: 'Desktop app launch. #amber',
    }

    vi.mocked(window.electron.invoke).mockImplementation(async (channel: string) => {
      if (channel === 'system:ensureDirectory' || channel === 'fs:writeFile') return { success: true }
      return undefined
    })

    useAppStore.setState({
      locale: 'en',
      workspacePath: '/workspace',
      documentGroups: [group],
      documentNodes: [overview, budget, release],
      selectedDocumentGroupId: group.id,
      selectedDocumentId: overview.id,
    })

    render(<DocumentsLayout />)

    const relatedNotesCard = screen.getByText('Related Notes').closest('div.rounded-3xl') as HTMLElement
    expect(relatedNotesCard).toBeTruthy()
    expect(within(relatedNotesCard).getByRole('button', { name: /Budget/i })).toBeInTheDocument()
    expect(within(relatedNotesCard).getByRole('button', { name: /Release Plan/i })).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Export Corpus' })[0])

    await waitFor(() => {
      expect(screen.getByText(/Graphify corpus exported successfully/i)).toBeInTheDocument()
    })

    expect(window.electron.invoke).toHaveBeenCalledWith('system:ensureDirectory', expect.stringContaining('/workspace/.suora/exports/graphify/Knowledge-Base-'))
    expect(window.electron.invoke).toHaveBeenCalledWith('fs:writeFile', expect.stringContaining('/README.md'), expect.any(String))
    expect(window.electron.invoke).toHaveBeenCalledWith('fs:writeFile', expect.stringContaining('/manifest.json'), expect.any(String))
    expect(window.electron.invoke).toHaveBeenCalledWith('fs:writeFile', expect.stringContaining('/docs/Project-Overview.md'), expect.stringContaining('Read [Budget]'))
  })

  it('clears document tree inputs when creating a new group', async () => {
    const user = userEvent.setup()
    const group = createDocumentGroup('Docs')
    const rootDoc = createDocument(group.id, null, 'Intro')

    useAppStore.setState({
      locale: 'en',
      documentGroups: [group],
      documentNodes: [rootDoc],
      selectedDocumentGroupId: group.id,
      selectedDocumentId: rootDoc.id,
    })

    render(<DocumentsLayout />)

    await user.click(screen.getByRole('button', { name: 'More actions: Docs' }))
    await user.click(screen.getByRole('menuitem', { name: 'New Folder' }))
    expect(screen.getByRole('textbox', { name: 'Document or folder name' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '+ Group' }))

    await waitFor(() => {
      expect(useAppStore.getState().documentGroups).toHaveLength(2)
      expect(screen.queryByRole('textbox', { name: 'Document or folder name' })).not.toBeInTheDocument()
    })

    expect(screen.queryByRole('textbox', { name: 'Group name' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Document title' })).toHaveValue('Welcome')
  })

  it('removes a folder together with its nested documents', async () => {
    const user = userEvent.setup()
    const group = createDocumentGroup('Docs')
    const rootDoc = createDocument(group.id, null, 'Intro')

    useAppStore.setState({
      locale: 'en',
      documentGroups: [group],
      documentNodes: [rootDoc],
      selectedDocumentGroupId: group.id,
      selectedDocumentId: rootDoc.id,
    })

    render(<DocumentsLayout />)

    await user.click(screen.getByRole('button', { name: 'More actions: Docs' }))
    await user.click(screen.getByRole('menuitem', { name: 'New Folder' }))
    const nodeNameInput = screen.getByRole('textbox', { name: 'Document or folder name' })
    await user.clear(nodeNameInput)
    await user.type(nodeNameInput, 'Specs')
    await user.keyboard('{Enter}')

    const folder = await waitFor(() => {
      const nextFolder = useAppStore.getState().documentNodes.find((node) => node.type === 'folder' && node.title === 'Specs')
      expect(nextFolder).toBeTruthy()
      return nextFolder
    })

    await user.click(screen.getByRole('button', { name: 'More actions: Specs' }))
    await user.click(screen.getByRole('menuitem', { name: 'New child document' }))

    const childDocument = await waitFor(() => {
      const nextDoc = useAppStore.getState().documentNodes.find((node) => node.type === 'document' && node.parentId === folder?.id)
      expect(nextDoc).toBeTruthy()
      return nextDoc
    })

    await user.click(screen.getByRole('button', { name: 'More actions: Specs' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))

    await waitFor(() => {
      expect(useAppStore.getState().documentNodes.some((node) => node.id === folder?.id)).toBe(false)
      expect(useAppStore.getState().documentNodes.some((node) => node.id === childDocument?.id)).toBe(false)
    })

    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(useAppStore.getState().documentNodes).toEqual([expect.objectContaining({ id: rootDoc.id })])
  })
})
