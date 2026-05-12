import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildDocumentImportFromDataTransferItems,
  buildDocumentImportFromFolderFiles,
  createDocumentNodesFromImport,
} from './documentImport'

describe('documentImport', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('builds a folder-backed import bundle from webkitRelativePath files', async () => {
    const files = [
      new File(['# Overview'], 'overview.md', { type: 'text/markdown' }),
      new File(['console.log("ship")'], 'deploy.ts', { type: 'text/typescript' }),
      new File(['PNG'], 'logo.png', { type: 'image/png' }),
    ] as Array<File & { webkitRelativePath?: string }>
    files[0].webkitRelativePath = 'product-docs/overview.md'
    files[1].webkitRelativePath = 'product-docs/scripts/deploy.ts'
    files[2].webkitRelativePath = 'product-docs/assets/logo.png'

    const list = Object.assign(files, {
      item: (index: number) => files[index] ?? null,
    }) as unknown as FileList

    const bundle = await buildDocumentImportFromFolderFiles(list)

    expect(bundle).toEqual({
      files: [
        { path: 'product-docs/overview.md', content: '# Overview', size: 10 },
        { path: 'product-docs/scripts/deploy.ts', content: 'console.log("ship")', size: 19 },
      ],
      skippedPaths: ['product-docs/assets/logo.png'],
    })
  })

  it('builds a dropped import bundle from directory entries', async () => {
    const makeFileEntry = (name: string, content: string, type = 'text/plain'): FileSystemFileEntry => ({
      name,
      fullPath: `/${name}`,
      isFile: true,
      isDirectory: false,
      file: (resolve: (file: File) => void) => resolve(new File([content], name, { type })),
    } as unknown as FileSystemFileEntry)
    const introEntry = makeFileEntry('intro.md', '# Intro', 'text/markdown')
    const configEntry = makeFileEntry('settings.json', '{"ok":true}', 'application/json')
    const imageEntry = makeFileEntry('diagram.png', 'PNG', 'image/png')
    const nestedDir = {
      name: 'config',
      fullPath: '/config',
      isFile: false,
      isDirectory: true,
      createReader: () => ({
        readEntries: vi.fn()
          .mockImplementationOnce((resolve: (entries: FileSystemEntry[]) => void) => resolve([configEntry, imageEntry]))
          .mockImplementationOnce((resolve: (entries: FileSystemEntry[]) => void) => resolve([])),
      }),
    } as unknown as FileSystemDirectoryEntry
    const rootEntry = {
      name: 'knowledge',
      fullPath: '/knowledge',
      isFile: false,
      isDirectory: true,
      createReader: () => ({
        readEntries: vi.fn()
          .mockImplementationOnce((resolve: (entries: FileSystemEntry[]) => void) => resolve([introEntry, nestedDir]))
          .mockImplementationOnce((resolve: (entries: FileSystemEntry[]) => void) => resolve([])),
      }),
    } as unknown as FileSystemDirectoryEntry
    const items = Object.assign([{
      webkitGetAsEntry: () => rootEntry,
    }], {
      item: (index: number) => index === 0 ? { webkitGetAsEntry: () => rootEntry } : null,
    }) as unknown as DataTransferItemList

    const bundle = await buildDocumentImportFromDataTransferItems(items)

    expect(bundle).toEqual({
      files: [
        { path: 'knowledge/intro.md', content: '# Intro', size: 7 },
        { path: 'knowledge/config/settings.json', content: '{"ok":true}', size: 11 },
      ],
      skippedPaths: ['knowledge/config/diagram.png'],
    })
  })

  it('creates folders and documents under the selected parent folder', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_725_000_000_000)
    vi.spyOn(Math, 'random').mockReturnValue(0.123456)

    const result = createDocumentNodesFromImport(
      [
        { path: 'product-docs/overview.md', content: '# Overview', size: 10 },
        { path: 'product-docs/scripts/deploy.ts', content: 'console.log("ship")', size: 19 },
      ],
      { groupId: 'group-1', parentId: 'folder-root', createdAt: 42 },
    )

    expect(result.folderCount).toBe(2)
    expect(result.documentCount).toBe(2)
    expect(result.firstDocument).toMatchObject({
      groupId: 'group-1',
      title: 'overview.md',
      parentId: expect.any(String),
      markdown: '# Overview',
    })
    expect(result.nodes).toEqual([
      expect.objectContaining({
        type: 'folder',
        title: 'product-docs',
        groupId: 'group-1',
        parentId: 'folder-root',
        createdAt: 42,
      }),
      expect.objectContaining({
        type: 'document',
        title: 'overview.md',
        groupId: 'group-1',
        markdown: '# Overview',
        createdAt: 42,
      }),
      expect.objectContaining({
        type: 'folder',
        title: 'scripts',
        groupId: 'group-1',
        createdAt: 42,
      }),
      expect.objectContaining({
        type: 'document',
        title: 'deploy.ts',
        groupId: 'group-1',
        markdown: 'console.log("ship")',
        createdAt: 42,
      }),
    ])
  })
})
