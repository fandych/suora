import "katex/dist/katex.min.css"

import { Node, mergeAttributes } from "@tiptap/core"
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react"
import katex from "katex"
import { useEffect, useId, useRef, useState } from "react"

function MathBlockView({ node }: NodeViewProps) {
  const content = node.attrs.content as string
  const [html, setHtml] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    try {
      setHtml(katex.renderToString(content, { displayMode: true, throwOnError: false }))
      setError("")
    }
    catch (nextError) {
      setError(String(nextError))
      setHtml("")
    }
  }, [content])

  return (
    <NodeViewWrapper>
      <div className="document-math-block" contentEditable={false}>
        {error ? <code className="text-xs text-destructive">{error}</code> : <span dangerouslySetInnerHTML={{ __html: html }} />}
      </div>
    </NodeViewWrapper>
  )
}

export const MathBlock = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { content: { default: "" } }
  },
  parseHTML() {
    return [{ tag: "div[data-math-block]", getAttrs: (element) => ({ content: (element as HTMLElement).getAttribute("data-math-block") ?? "" }) }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-math-block": HTMLAttributes.content as string })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView)
  },
})

function InlineMathView({ node }: NodeViewProps) {
  const content = node.attrs.content as string
  const [html, setHtml] = useState("")

  useEffect(() => {
    try {
      setHtml(katex.renderToString(content, { displayMode: false, throwOnError: false }))
    }
    catch {
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
  name: "inlineMath",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return { content: { default: "" } }
  },
  parseHTML() {
    return [{ tag: "span[data-math-inline]", getAttrs: (element) => ({ content: (element as HTMLElement).getAttribute("data-math-inline") ?? "" }) }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes({ "data-math-inline": HTMLAttributes.content as string })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(InlineMathView)
  },
})

let lastMermaidTheme: string | null = null

async function renderMermaid(id: string, code: string) {
  const mermaid = (await import("mermaid")).default
  if (lastMermaidTheme !== "default") {
    mermaid.initialize({ startOnLoad: false, theme: "default" })
    lastMermaidTheme = "default"
  }
  try {
    const { svg } = await mermaid.render(id, code)
    return svg
  }
  catch (error) {
    return `<pre style="color:var(--color-destructive);font-size:0.75rem">${String(error)}</pre>`
  }
}

function MermaidBlockView({ node }: NodeViewProps) {
  const code = node.attrs.code as string
  const containerRef = useRef<HTMLDivElement>(null)
  const reactId = useId()
  const mermaidId = `mermaid${reactId.replace(/:/g, "_")}`

  useEffect(() => {
    renderMermaid(mermaidId, code).then((svg) => {
      if (containerRef.current) {
        containerRef.current.innerHTML = svg
      }
    }).catch(() => {
      if (containerRef.current) {
        containerRef.current.textContent = "Mermaid render error"
      }
    })
  }, [code, mermaidId])

  return (
    <NodeViewWrapper>
      <div ref={containerRef} className="document-mermaid-block" contentEditable={false} />
    </NodeViewWrapper>
  )
}

export const MermaidBlock = Node.create({
  name: "mermaidBlock",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { code: { default: "" } }
  },
  parseHTML() {
    return [{ tag: "div[data-mermaid]", getAttrs: (element) => ({ code: (element as HTMLElement).getAttribute("data-mermaid") ?? "" }) }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-mermaid": HTMLAttributes.code as string })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(MermaidBlockView)
  },
})