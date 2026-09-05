import katex from "katex"
import { useEffect, useId, useMemo, useRef, useState } from "react"

import { showToast } from "@/lib/app-toast"
import { copyTextToClipboard } from "@/lib/clipboard"
import { markdownToTiptapHtml } from "@/views/components/document-markdown"

async function renderMermaid(target: HTMLElement, id: string, code: string) {
  const mermaid = (await import("mermaid")).default
  mermaid.initialize({ startOnLoad: false, theme: "default" })
  try {
    const { svg } = await mermaid.render(id, code)
    target.innerHTML = svg
  } catch (error) {
    target.textContent = String(error)
  }
}

type ChatRichContentProps = {
  content: string
  isStreaming?: boolean
}

export function ChatRichContent({ content, isStreaming = false }: ChatRichContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentId = useId().replace(/:/g, "_")
  const [renderContent, setRenderContent] = useState(content)

  useEffect(() => {
    if (!isStreaming) {
      setRenderContent(content)
      return
    }

    const handle = window.setTimeout(() => {
      setRenderContent(content)
    }, 120)

    return () => {
      window.clearTimeout(handle)
    }
  }, [content, isStreaming])

  const html = useMemo(() => markdownToTiptapHtml(renderContent || ""), [renderContent])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const cleanupCallbacks: Array<() => void> = []

    container.querySelectorAll("a").forEach((anchor) => {
      anchor.setAttribute("target", "_blank")
      anchor.setAttribute("rel", "noreferrer noopener")
    })

    container.querySelectorAll("[data-math-inline]").forEach((node) => {
      const contentValue = node.getAttribute("data-math-inline") ?? ""
      try {
        node.innerHTML = katex.renderToString(contentValue, { displayMode: false, throwOnError: false })
        node.classList.add("document-math-inline")
      } catch {
        node.textContent = contentValue
      }
    })

    container.querySelectorAll("[data-math-block]").forEach((node) => {
      const contentValue = node.getAttribute("data-math-block") ?? ""
      try {
        node.innerHTML = katex.renderToString(contentValue, { displayMode: true, throwOnError: false })
        node.classList.add("document-math-block")
      } catch {
        node.textContent = contentValue
      }
    })

    container.querySelectorAll("[data-mermaid]").forEach((node, index) => {
      node.classList.add("document-mermaid-block")
      void renderMermaid(node as HTMLElement, `${contentId}-mermaid-${index}`, node.getAttribute("data-mermaid") ?? "")
    })

    container.querySelectorAll("pre").forEach((pre, index) => {
      if ((pre as HTMLElement).dataset.enhanced === "true") {
        return
      }

      ;(pre as HTMLElement).dataset.enhanced = "true"
      const codeText = pre.textContent ?? ""
      const wrapper = document.createElement("div")
      wrapper.className = "chat-code-block"

      const toolbar = document.createElement("div")
      toolbar.className = "chat-code-toolbar"

      const copyButton = document.createElement("button")
      copyButton.type = "button"
      copyButton.className = "chat-code-copy"
      copyButton.textContent = "Copy code"
      copyButton.addEventListener("click", () => {
        void copyTextToClipboard(codeText)
          .then(() => {
            showToast({ title: "Code copied", description: "The code block was copied to clipboard.", type: "success", timeout: 2000 })
          })
          .catch((error) => {
            showToast({ title: "Copy failed", description: error instanceof Error ? error.message : String(error), type: "error", timeout: 3000 })
          })
      })
      cleanupCallbacks.push(() => copyButton.replaceWith(copyButton.cloneNode(true)))

      toolbar.appendChild(copyButton)
      pre.parentNode?.insertBefore(wrapper, pre)
      wrapper.appendChild(toolbar)
      wrapper.appendChild(pre)

      const codeElement = pre.querySelector("code")
      if (codeElement) {
        const languageMatch = Array.from(codeElement.classList).find((item) => item.startsWith("language-"))
        if (languageMatch) {
          const labelNode = document.createElement("span")
          labelNode.className = "chat-code-language"
          labelNode.textContent = languageMatch.replace("language-", "")
          toolbar.insertBefore(labelNode, copyButton)
        }
      }

      wrapper.dataset.index = String(index)
    })

    return () => {
      cleanupCallbacks.forEach((callback) => callback())
    }
  }, [contentId, html])

  return <div ref={containerRef} className="document-prose chat-prose min-w-0 max-w-none text-sm" dangerouslySetInnerHTML={{ __html: html }} />
}