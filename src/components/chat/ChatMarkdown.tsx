import { CopyButton, MarkdownRenderer } from '@/components/markdown/MarkdownRenderer'

export { CopyButton }

export function MarkdownContent({ content }: { content: string }) {
  return <MarkdownRenderer content={content} allowHtml />
}
