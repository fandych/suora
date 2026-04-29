import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'
import katex from 'katex'
import type { NodeViewProps } from '@tiptap/react'
import 'katex/dist/katex.min.css'

// ── Math Block (display mode) ─────────────────────────────────────────────────

function MathBlockView({ node }: NodeViewProps) {
  const content = node.attrs.content as string
  const [html, setHtml] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      setHtml(katex.renderToString(content, { displayMode: true, throwOnError: false }))
      setError('')
    } catch (err) {
      setError(String(err))
      setHtml('')
    }
  }, [content])

  return (
    <NodeViewWrapper>
      <div className="document-math-block" contentEditable={false}>
        {error
          ? <code className="text-danger text-xs">{error}</code>
          : <span dangerouslySetInnerHTML={{ __html: html }} />
        }
      </div>
    </NodeViewWrapper>
  )
}

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      content: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-math-block]',
        getAttrs: (el) => ({ content: (el as HTMLElement).getAttribute('data-math-block') ?? '' }),
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-math-block': HTMLAttributes.content as string })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView)
  },
})

// ── Inline Math ───────────────────────────────────────────────────────────────

function InlineMathView({ node }: NodeViewProps) {
  const content = node.attrs.content as string
  const [html, setHtml] = useState('')

  useEffect(() => {
    try {
      setHtml(katex.renderToString(content, { displayMode: false, throwOnError: false }))
    } catch {
      setHtml(content)
    }
  }, [content])

  return (
    <NodeViewWrapper as="span" className="document-math-inline">
      <span dangerouslySetInnerHTML={{ __html: html }} contentEditable={false} />
    </NodeViewWrapper>
  )
}

export const InlineMath = Node.create({
  name: 'inlineMath',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      content: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-math-inline]',
        getAttrs: (el) => ({ content: (el as HTMLElement).getAttribute('data-math-inline') ?? '' }),
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-math-inline': HTMLAttributes.content as string })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineMathView)
  },
})

// ── Mermaid Block ─────────────────────────────────────────────────────────────

let mermaidInitialized = false
let mermaidCounter = 0

async function renderMermaid(id: string, code: string): Promise<string> {
  const mermaidLib = (await import('mermaid')).default
  if (!mermaidInitialized) {
    mermaidLib.initialize({ startOnLoad: false, theme: 'dark' })
    mermaidInitialized = true
  }
  try {
    const { svg } = await mermaidLib.render(id, code)
    return svg
  } catch (err) {
    return `<pre style="color:var(--t-danger);font-size:0.75rem">${String(err)}</pre>`
  }
}

function MermaidBlockView({ node }: NodeViewProps) {
  const code = node.attrs.code as string
  const containerRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(`mermaid-${++mermaidCounter}`)

  useEffect(() => {
    const id = idRef.current
    renderMermaid(id, code).then((svg) => {
      if (containerRef.current) containerRef.current.innerHTML = svg
    }).catch(() => {
      if (containerRef.current) containerRef.current.textContent = 'Mermaid render error'
    })
  }, [code])

  return (
    <NodeViewWrapper>
      <div ref={containerRef} className="document-mermaid-block" contentEditable={false} />
    </NodeViewWrapper>
  )
}

export const MermaidBlock = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      code: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-mermaid]',
        getAttrs: (el) => ({ code: (el as HTMLElement).getAttribute('data-mermaid') ?? '' }),
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-mermaid': HTMLAttributes.code as string })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidBlockView)
  },
})
