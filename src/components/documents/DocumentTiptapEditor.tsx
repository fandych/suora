import { useEffect, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { MathBlock, InlineMath, MermaidBlock } from '@/components/documents/DocumentExtensions'
import { tiptapJsonToMarkdown } from '@/services/documents'
import type { DocumentItem } from '@/types'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function escapeAttr(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inlineMarkdown(value: string) {
  const mathTokens: string[] = []
  const tokenized = value.replace(/\$([^$\n]+)\$/g, (_, latex: string) => {
    mathTokens.push(latex)
    return `\x01M${mathTokens.length - 1}\x01`
  })

  let result = escapeHtml(tokenized)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt: string, src: string) => `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}">`)
    .replace(/\[\[([^\]\n]+)\]\]/g, (_, target: string) => `<a href="#doc:${escapeAttr(target)}">${escapeHtml(target)}</a>`)
    .replace(/\[([^\]\n]+)\]\(([^)]+)\)/g, (_, label: string, href: string) => `<a href="${escapeAttr(href)}">${escapeHtml(label)}</a>`)

  result = result.replace(/\x01M(\d+)\x01/g, (_, i: string) => {
    const latex = mathTokens[parseInt(i)]
    return `<span data-math-inline="${escapeAttr(latex)}"></span>`
  })

  return result
}

function parseTableRow(line: string): string[] {
  return line
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim())
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s|:-]+\|?$/.test(line) && /[-]/.test(line)
}

function markdownToTiptapHtml(markdown: string) {
  const lines = markdown.split('\n')
  const html: string[] = []
  let list: 'ul' | 'ol' | 'ul[data-type="taskList"]' | null = null
  let inCode = false
  let codeLang = ''
  let code: string[] = []
  let inMath = false
  let math: string[] = []
  let tablePending: string[] = []
  let inTable = false

  const closeList = () => {
    if (list) {
      html.push(`</${list === 'ul[data-type="taskList"]' ? 'ul' : list}>`)
      list = null
    }
  }

  const flushTable = () => {
    if (inTable) {
      html.push('</tbody></table>')
      inTable = false
    }
  }

  const flushPendingTable = () => {
    if (tablePending.length > 0) {
      for (const pending of tablePending) {
        html.push(`<p>${inlineMarkdown(pending)}</p>`)
      }
      tablePending = []
    }
  }

  lines.forEach((line) => {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        if (codeLang === 'mermaid') {
          html.push(`<div data-mermaid="${escapeAttr(code.join('\n'))}"></div>`)
        } else {
          html.push(`<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(code.join('\n'))}</code></pre>`)
        }
        code = []
        codeLang = ''
        inCode = false
      } else {
        closeList()
        flushTable()
        flushPendingTable()
        codeLang = line.trim().slice(3).trim()
        inCode = true
      }
      return
    }
    if (inCode) {
      code.push(line)
      return
    }

    if (line.trim() === '$$') {
      if (inMath) {
        html.push(`<div data-math-block="${escapeAttr(math.join('\n'))}"></div>`)
        math = []
        inMath = false
      } else {
        closeList()
        flushTable()
        flushPendingTable()
        inMath = true
      }
      return
    }
    if (inMath) {
      math.push(line)
      return
    }

    const isTableLine = line.trim().startsWith('|') || (line.includes('|') && !line.trim().startsWith('#'))
    if (inTable) {
      if (isTableSeparator(line) || !line.trim()) {
        if (!line.trim()) {
          flushTable()
          return
        }
        return
      }
      if (line.trim().startsWith('|') || line.includes('|')) {
        const cells = parseTableRow(line)
        const row = cells.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join('')
        html.push(`<tr>${row}</tr>`)
        return
      }
      flushTable()
    }
    if (!inTable && tablePending.length === 0 && isTableLine && line.trim().startsWith('|')) {
      tablePending.push(line)
      return
    }
    if (tablePending.length > 0) {
      if (isTableSeparator(line)) {
        closeList()
        const headerCells = parseTableRow(tablePending[0])
        const headerRow = headerCells.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join('')
        html.push(`<table><thead><tr>${headerRow}</tr></thead><tbody>`)
        inTable = true
        tablePending = []
        return
      }
      flushPendingTable()
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      closeList()
      html.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`)
      return
    }

    const taskUnchecked = /^\s*[-*]\s+\[ \]\s+(.*)$/.exec(line)
    if (taskUnchecked) {
      if (list !== 'ul[data-type="taskList"]') {
        closeList()
        list = 'ul[data-type="taskList"]'
        html.push('<ul data-type="taskList">')
      }
      html.push(`<li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>${inlineMarkdown(taskUnchecked[1])}</p></div></li>`)
      return
    }

    const taskChecked = /^\s*[-*]\s+\[x\]\s+(.*)$/i.exec(line)
    if (taskChecked) {
      if (list !== 'ul[data-type="taskList"]') {
        closeList()
        list = 'ul[data-type="taskList"]'
        html.push('<ul data-type="taskList">')
      }
      html.push(`<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked /></label><div><p>${inlineMarkdown(taskChecked[1])}</p></div></li>`)
      return
    }

    const unordered = /^\s*[-*]\s+(.*)$/.exec(line)
    if (unordered) {
      if (list !== 'ul') {
        closeList()
        list = 'ul'
        html.push('<ul>')
      }
      html.push(`<li>${inlineMarkdown(unordered[1])}</li>`)
      return
    }

    const ordered = /^\s*\d+\.\s+(.*)$/.exec(line)
    if (ordered) {
      if (list !== 'ol') {
        closeList()
        list = 'ol'
        html.push('<ol>')
      }
      html.push(`<li>${inlineMarkdown(ordered[1])}</li>`)
      return
    }

    closeList()
    if (line.trim().startsWith('>')) {
      html.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ''))}</blockquote>`)
    } else if (line.trim() === '---') {
      html.push('<hr />')
    } else if (line.trim()) {
      html.push(`<p>${inlineMarkdown(line)}</p>`)
    }
  })

  closeList()
  flushTable()
  flushPendingTable()

  if (inCode) {
    if (codeLang === 'mermaid') {
      html.push(`<div data-mermaid="${escapeAttr(code.join('\n'))}"></div>`)
    } else {
      html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
    }
  }

  if (inMath) html.push(`<div data-math-block="${escapeAttr(math.join('\n'))}"></div>`)
  return html.join('\n') || '<p></p>'
}

export function DocumentTiptapEditor({ document, onUpdate }: { document: DocumentItem; onUpdate: (markdown: string) => void }) {
  const isSyncingFromPropsRef = useRef(false)
  const lastEmittedMarkdownRef = useRef(document.markdown)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing…' }),
      Image.configure({ inline: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      MathBlock,
      InlineMath,
      MermaidBlock,
    ],
    content: markdownToTiptapHtml(document.markdown),
    editable: true,
    editorProps: {
      attributes: {
        class: 'document-prose min-h-full focus:outline-none',
      },
    },
    onUpdate: ({ editor: ed }: { editor: { getJSON: () => unknown } }) => {
      if (isSyncingFromPropsRef.current) return
      const json = ed.getJSON()
      const markdown = tiptapJsonToMarkdown(json as Parameters<typeof tiptapJsonToMarkdown>[0])
      lastEmittedMarkdownRef.current = markdown
      onUpdate(markdown)
    },
  })

  const previousDocumentIdRef = useRef(document.id)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const documentChanged = previousDocumentIdRef.current !== document.id
    if (!documentChanged && document.markdown === lastEmittedMarkdownRef.current) return
    isSyncingFromPropsRef.current = true
    editor.commands.setContent(markdownToTiptapHtml(document.markdown), { emitUpdate: false })
    lastEmittedMarkdownRef.current = document.markdown
    previousDocumentIdRef.current = document.id
    isSyncingFromPropsRef.current = false
  }, [document.id, document.markdown, editor])

  return <EditorContent editor={editor} className="document-tiptap-wysiwyg h-full" />
}
