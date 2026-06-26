import { memo, useDeferredValue } from 'react'
import { CopyButton, MarkdownRenderer } from '@/components/markdown/MarkdownRenderer'

export { CopyButton }

export const MarkdownContent = memo(function MarkdownContent({ content, defer = false }: { content: string; defer?: boolean }) {
  const deferredContent = useDeferredValue(content)
  return <MarkdownRenderer content={defer ? deferredContent : content} allowHtml />
})
