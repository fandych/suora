import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DocumentGraphView } from './DocumentGraphView'
import { useAppStore } from '@/store/appStore'
import type { DocumentGraph } from '@/services/documentGraph'

function createGraph(): DocumentGraph {
  return {
    nodes: [
      {
        id: 'doc-graph:group-1',
        type: 'group',
        label: 'Product Docs',
        groupId: 'group-1',
        weight: 1,
        metadata: {},
      },
      {
        id: 'doc-graph:folder-1',
        type: 'folder',
        label: 'Specs Hub',
        groupId: 'group-1',
        folderId: 'folder-1',
        weight: 1,
        metadata: {
          path: 'Specs Hub',
        },
      },
      {
        id: 'doc-graph:doc-intro',
        type: 'document',
        label: 'Intro Doc',
        groupId: 'group-1',
        documentId: 'doc-intro',
        weight: 1,
        metadata: {
          path: 'Intro Doc',
          excerpt: 'Introduces the workspace.',
        },
      },
      {
        id: 'doc-graph:doc-roadmap',
        type: 'document',
        label: 'Roadmap',
        groupId: 'group-1',
        documentId: 'doc-roadmap',
        weight: 1,
        metadata: {
          path: 'Specs Hub / Roadmap',
          excerpt: 'Refined plan for the next release.',
        },
      },
      {
        id: 'doc-graph:group-1:tag:planning',
        type: 'tag',
        label: 'planning',
        groupId: 'group-1',
        weight: 1,
        metadata: {},
      },
      {
        id: 'doc-graph:group-1:external:https%3A%2F%2Fdocs.example.com',
        type: 'external-link',
        label: 'docs.example.com',
        groupId: 'group-1',
        weight: 1,
        metadata: {
          url: 'https://docs.example.com',
        },
      },
    ],
    edges: [
      {
        id: 'edge-group-folder',
        source: 'doc-graph:group-1',
        target: 'doc-graph:folder-1',
        type: 'contains',
        weight: 1,
        metadata: {},
      },
      {
        id: 'edge-group-intro',
        source: 'doc-graph:group-1',
        target: 'doc-graph:doc-intro',
        type: 'contains',
        weight: 1,
        metadata: {},
      },
      {
        id: 'edge-folder-roadmap',
        source: 'doc-graph:folder-1',
        target: 'doc-graph:doc-roadmap',
        type: 'contains',
        weight: 1,
        metadata: {},
      },
      {
        id: 'edge-intro-roadmap',
        source: 'doc-graph:doc-intro',
        target: 'doc-graph:doc-roadmap',
        type: 'references',
        weight: 1,
        metadata: {
          documentId: 'doc-intro',
        },
      },
      {
        id: 'edge-roadmap-tag',
        source: 'doc-graph:doc-roadmap',
        target: 'doc-graph:group-1:tag:planning',
        type: 'tagged',
        weight: 1,
        metadata: {
          documentId: 'doc-roadmap',
        },
      },
      {
        id: 'edge-roadmap-external',
        source: 'doc-graph:doc-roadmap',
        target: 'doc-graph:group-1:external:https%3A%2F%2Fdocs.example.com',
        type: 'external-link',
        weight: 1,
        metadata: {
          documentId: 'doc-roadmap',
          url: 'https://docs.example.com',
        },
      },
    ],
    backlinksByDocumentId: {
      'doc-intro': [],
      'doc-roadmap': ['doc-intro'],
    },
    referencesByDocumentId: {
      'doc-intro': ['doc-roadmap'],
      'doc-roadmap': [],
    },
    orphanDocumentIds: [],
    tags: ['planning'],
  }
}

describe('DocumentGraphView', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppStore.setState({ locale: 'en' })
  })

  it('shows selected document details and backlinks', async () => {
    const user = userEvent.setup()
    const onSelectDocument = vi.fn()

    render(<DocumentGraphView graph={createGraph()} selectedDocumentId="doc-roadmap" onSelectDocument={onSelectDocument} />)

    expect(screen.getByText('Refined plan for the next release.')).toBeInTheDocument()
    expect(screen.getByText('Specs Hub / Roadmap')).toBeInTheDocument()

    const backlinksSection = screen.getByText('Backlinks').closest('section')
    expect(backlinksSection).not.toBeNull()

    await user.click(within(backlinksSection as HTMLElement).getByRole('button', { name: /Intro Doc/i }))

    expect(onSelectDocument).toHaveBeenCalledWith('doc-intro')
  })

  it('toggles edge visibility by filter button', async () => {
    const user = userEvent.setup()
    const onSelectDocument = vi.fn()
    const { container } = render(<DocumentGraphView graph={createGraph()} selectedDocumentId={null} onSelectDocument={onSelectDocument} />)

    expect(container.querySelectorAll('svg line')).toHaveLength(6)

    await user.click(screen.getByRole('button', { name: 'references' }))

    expect(container.querySelectorAll('svg line')).toHaveLength(5)
  })

  it('filters graph labels and selects document nodes from the canvas', async () => {
    const user = userEvent.setup()
    const onSelectDocument = vi.fn()
    const { container } = render(<DocumentGraphView graph={createGraph()} selectedDocumentId={null} onSelectDocument={onSelectDocument} />)

    const graphSearch = screen.getByPlaceholderText('Filter graph…')
    await user.type(graphSearch, 'planning')

    const labelsAfterSearch = Array.from(container.querySelectorAll('svg text')).map((label) => label.textContent)
    expect(labelsAfterSearch).toContain('planning')
    expect(labelsAfterSearch).not.toContain('Roadmap')
    expect(container.querySelectorAll('svg line')).toHaveLength(0)

    await user.clear(graphSearch)
    fireEvent.click(screen.getByText('Roadmap'))

    expect(onSelectDocument).toHaveBeenCalledWith('doc-roadmap')
    expect(screen.getByText('Refined plan for the next release.')).toBeInTheDocument()
  })
})