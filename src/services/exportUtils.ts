/**
 * Export Utilities
 *
 * Shared helpers for exporting documents and chat conversations
 * to Markdown, PDF, and Word (.docx) formats.
 *
 * PDF: uses the same unified/remark/rehype pipeline as the UI renderer
 *      (remark-gfm for tables, remark-math + rehype-katex for formulas).
 * DOCX: parses markdown to AST and maps to docx elements including tables.
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Packer,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  Math as DocxMath,
  MathRun,
  MathFraction,
  MathSuperScript,
  MathSubScript,
  MathSubSuperScript,
  MathRadical,
  MathRoundBrackets,
  MathCurlyBrackets,
  MathSquareBrackets,
  type MathComponent,
} from 'docx'
import katex from 'katex'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeKatex from 'rehype-katex'
import rehypeStringify from 'rehype-stringify'
import type { Message, Session } from '@/types'

/** Safe base64 encoding for any size ArrayBuffer — avoids call-stack limits. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}
function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Trigger a browser-side download of binary content */
function downloadBinaryBlob(buffer: Blob, filename: string) {
  const url = URL.createObjectURL(buffer)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Electron save dialog helpers ───────────────────────────────────

async function saveViaElectron(
  content: string,
  defaultName: string,
  filters: { name: string; extensions: string[] }[],
  encoding: 'utf8' | 'base64' = 'utf8',
): Promise<{ success?: boolean; canceled?: boolean; error?: string; filePath?: string }> {
  if (typeof window === 'undefined' || !window.electron?.invoke) {
    return { error: 'Not running in Electron' }
  }
  return window.electron.invoke('export:saveFileDialog', { defaultName, filters, content, encoding }) as Promise<{ success?: boolean; canceled?: boolean; error?: string; filePath?: string }>
}

async function savePdfViaElectron(
  htmlContent: string,
  defaultName: string,
): Promise<{ success?: boolean; canceled?: boolean; error?: string; filePath?: string }> {
  if (typeof window === 'undefined' || !window.electron?.invoke) {
    return { error: 'Not running in Electron' }
  }
  return window.electron.invoke('export:printToPDF', htmlContent, defaultName) as Promise<{ success?: boolean; canceled?: boolean; error?: string; filePath?: string }>
}

// ─── PDF HTML template ───────────────────────────────────────────────

function buildPdfHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
    font-size: 14px;
    line-height: 1.7;
    color: #1a1a1a;
    max-width: 800px;
    margin: 0 auto;
    padding: 32px 40px;
  }
  h1 { font-size: 1.9em; font-weight: 700; margin: 0 0 12px; line-height: 1.25; }
  h2 { font-size: 1.4em; font-weight: 600; margin: 24px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
  h3 { font-size: 1.15em; font-weight: 600; margin: 18px 0 6px; }
  h4 { font-size: 1em; font-weight: 600; margin: 14px 0 4px; }
  p { margin: 0 0 12px; }
  pre { background: #f4f4f5; border-radius: 6px; padding: 12px 14px; overflow: auto; font-size: 12px; border: 1px solid #e5e7eb; }
  code { font-family: "Fira Code", "JetBrains Mono", "Consolas", monospace; font-size: 0.88em; background: #f4f4f5; padding: 1px 4px; border-radius: 3px; }
  pre code { background: none; padding: 0; font-size: inherit; }
  blockquote { margin: 12px 0; padding: 10px 16px; border-left: 3px solid #d1d5db; background: #f9fafb; color: #4b5563; }
  /* GFM tables */
  table { border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 13px; }
  thead tr { background: #f4f4f5; }
  th { font-weight: 600; text-align: left; }
  th, td { border: 1px solid #e5e7eb; padding: 7px 10px; vertical-align: top; }
  tbody tr:nth-child(even) { background: #fafafa; }
  /* GFM task lists */
  ul.contains-task-list { list-style: none; padding-left: 4px; }
  li.task-list-item input[type="checkbox"] { margin-right: 6px; }
  /* GFM strikethrough */
  del { color: #6b7280; }
  /* Math (MathML) */
  math { font-size: 1.1em; }
  math[display="block"] { display: block; margin: 16px auto; text-align: center; overflow-x: auto; }
  /* Chat message wrappers */
  .msg-user { background: #eff6ff; border-radius: 8px; padding: 12px 16px; margin: 10px 0; }
  .msg-assistant { background: #f9fafb; border-radius: 8px; padding: 12px 16px; margin: 10px 0; border: 1px solid #e5e7eb; }
  .msg-role { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 6px; }
  .msg-time { font-size: 11px; color: #9ca3af; margin-left: 8px; font-weight: 400; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 20px 0; }
  img { max-width: 100%; }
  ul, ol { padding-left: 20px; margin: 0 0 12px; }
  a { color: #2563eb; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── Markdown → HTML via unified pipeline (same as UI) ──────────────

/**
 * Pre-built, frozen processor — constructed once, reused for all calls.
 * Avoids re-chaining plugins on every export invocation.
 *
 * remark-gfm  : GFM tables, strikethrough, task lists, auto-links
 * remark-math + rehype-katex: $...$ and $$...$$ → MathML (no external CSS)
 */
const mdProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeKatex, { output: 'mathml' })
  .use(rehypeStringify, { allowDangerousHtml: true })
  .freeze()

async function markdownToHtml(md: string): Promise<string> {
  const file = await mdProcessor.process(md)
  return String(file)
}

// ─── Word (docx) helpers ─────────────────────────────────────────────

// ── MathML → docx MathComponent converter ────────────────────────────
//
// KaTeX outputs MathML; we walk that DOM and map it to the docx math
// object tree (OMML), which Word renders natively as proper equations.

function getChildEls(el: Element): Element[] {
  return Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1)
}

function mathmlChildrenToComponents(el: Element): MathComponent[] {
  const out: MathComponent[] = []
  for (const child of el.childNodes) {
    if (child.nodeType === 3) { // TEXT_NODE
      const t = child.textContent?.trim() ?? ''
      if (t) out.push(new MathRun(t))
    } else if (child.nodeType === 1) {
      out.push(...mathmlElToComponents(child as Element))
    }
  }
  return out.length > 0 ? out : []
}

function mathmlElToComponents(node: Element): MathComponent[] {
  const tag = (node.localName ?? node.tagName).replace(/^.*:/, '').toLowerCase()
  switch (tag) {
    // Pass-through grouping elements
    case 'math':
    case 'mrow':
    case 'mstyle':
    case 'mpadded':
    case 'menclose':
    case 'mphantom':
      return mathmlChildrenToComponents(node)

    // Leaf text nodes
    case 'mn': case 'mi': case 'mo': case 'mtext': case 'ms': case 'mglyph':
      return [new MathRun(node.textContent ?? '')]

    case 'mspace':
      return []

    // Fraction: \frac{a}{b}
    case 'mfrac': {
      const [num, den] = getChildEls(node)
      if (!num || !den) return fallbackText(node)
      return [new MathFraction({
        numerator: mathmlChildrenToComponents(num),
        denominator: mathmlChildrenToComponents(den),
      })]
    }

    // Superscript: x^2
    case 'msup': {
      const [base, sup] = getChildEls(node)
      if (!base || !sup) return fallbackText(node)
      return [new MathSuperScript({
        children: mathmlChildrenToComponents(base),
        superScript: mathmlChildrenToComponents(sup),
      })]
    }

    // Subscript: x_i
    case 'msub': {
      const [base, sub] = getChildEls(node)
      if (!base || !sub) return fallbackText(node)
      return [new MathSubScript({
        children: mathmlChildrenToComponents(base),
        subScript: mathmlChildrenToComponents(sub),
      })]
    }

    // Sub+superscript: x_i^2
    case 'msubsup': {
      const [base, sub, sup] = getChildEls(node)
      if (!base || !sub || !sup) return fallbackText(node)
      return [new MathSubSuperScript({
        children: mathmlChildrenToComponents(base),
        subScript: mathmlChildrenToComponents(sub),
        superScript: mathmlChildrenToComponents(sup),
      })]
    }

    // Square root: \sqrt{x}
    case 'msqrt':
      return [new MathRadical({ children: mathmlChildrenToComponents(node) })]

    // Nth root: \sqrt[n]{x}
    case 'mroot': {
      const [radicand, degree] = getChildEls(node)
      if (!radicand) return fallbackText(node)
      return [new MathRadical({
        children: mathmlChildrenToComponents(radicand),
        degree: degree ? mathmlChildrenToComponents(degree) : undefined,
      })]
    }

    // Overscript/underscript — represent as super/sub (approximate)
    case 'mover': {
      const [base, over] = getChildEls(node)
      if (!base) return fallbackText(node)
      return [new MathSuperScript({
        children: mathmlChildrenToComponents(base),
        superScript: over ? mathmlChildrenToComponents(over) : [new MathRun('')],
      })]
    }
    case 'munder': {
      const [base, under] = getChildEls(node)
      if (!base) return fallbackText(node)
      return [new MathSubScript({
        children: mathmlChildrenToComponents(base),
        subScript: under ? mathmlChildrenToComponents(under) : [new MathRun('')],
      })]
    }
    case 'munderover': {
      const [base, under, over] = getChildEls(node)
      if (!base) return fallbackText(node)
      return [new MathSubSuperScript({
        children: mathmlChildrenToComponents(base),
        subScript: under ? mathmlChildrenToComponents(under) : [new MathRun('')],
        superScript: over ? mathmlChildrenToComponents(over) : [new MathRun('')],
      })]
    }

    // Brackets: ( ) [ ] { }
    case 'mfenced': {
      const open = node.getAttribute('open') ?? '('
      const close = node.getAttribute('close') ?? ')'
      const inner = mathmlChildrenToComponents(node)
      if (open === '(' && close === ')') return [new MathRoundBrackets({ children: inner })]
      if (open === '{' && close === '}') return [new MathCurlyBrackets({ children: inner })]
      if (open === '[' && close === ']') return [new MathSquareBrackets({ children: inner })]
      return [new MathRun(open), ...inner, new MathRun(close)]
    }

    // semantics: first non-annotation child is the real math
    case 'semantics': {
      const first = getChildEls(node).find((el) => {
        const n = (el.localName ?? el.tagName).replace(/^.*:/, '')
        return n !== 'annotation' && n !== 'annotation-xml'
      })
      return first ? mathmlElToComponents(first) : []
    }

    case 'annotation': case 'annotation-xml':
      return []

    default:
      return fallbackText(node)
  }
}

function fallbackText(node: Element): MathComponent[] {
  const text = node.textContent?.trim() ?? ''
  return text ? [new MathRun(text)] : []
}

/**
 * Convert a LaTeX string to docx MathComponent[].
 * Uses KaTeX to produce MathML then maps to native OMML objects.
 */
function latexToDocxComponents(rawLatex: string): MathComponent[] {
  try {
    const mathmlStr = katex.renderToString(rawLatex, { output: 'mathml', throwOnError: false })
    const dom = new DOMParser().parseFromString(mathmlStr, 'text/html')
    const mathEl = dom.querySelector('math')
    if (!mathEl) return [new MathRun(rawLatex)]
    const result = mathmlChildrenToComponents(mathEl)
    return result.length > 0 ? result : [new MathRun(rawLatex)]
  } catch {
    return [new MathRun(rawLatex)]
  }
}

function parseInlineRuns(text: string, forceBold = false): Array<TextRun | InstanceType<typeof DocxMath>> {
  type RunOpts = { text: string; bold?: boolean; italics?: boolean; strike?: boolean; font?: string; size?: number; color?: string }
  const result: Array<TextRun | InstanceType<typeof DocxMath>> = []
  // Covers: $$...$$ block math, $...$ inline math, **bold**, *italic*,
  // ~~strikethrough~~, `code`, and any remaining text (including lone ~ chars).
  const tokenPattern = /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|`[^`]+`|[\s\S]+?(?=\$\$|\$|\*\*|\*|~~|`|$))/g
  let match: RegExpExecArray | null
  while ((match = tokenPattern.exec(text)) !== null) {
    const token = match[1]
    if (!token) continue
    if (token.startsWith('$$') && token.endsWith('$$')) {
      // Block-style inline math ($$...$$ used inside a line)
      result.push(new DocxMath({ children: latexToDocxComponents(token.slice(2, -2).trim()) }))
    } else if (token.startsWith('$') && token.endsWith('$')) {
      // Inline math: $...$  → native Word equation
      result.push(new DocxMath({ children: latexToDocxComponents(token.slice(1, -1).trim()) }))
    } else {
      // Plain text with optional formatting
      let opts: RunOpts
      if (token.startsWith('**') && token.endsWith('**')) {
        opts = { bold: true, text: token.slice(2, -2) }
      } else if (token.startsWith('*') && token.endsWith('*')) {
        opts = { italics: true, text: token.slice(1, -1) }
      } else if (token.startsWith('~~') && token.endsWith('~~')) {
        opts = { strike: true, text: token.slice(2, -2) }
      } else if (token.startsWith('`') && token.endsWith('`')) {
        opts = { text: token.slice(1, -1), font: 'Consolas', size: 22 }
      } else {
        opts = { text: token }
      }
      result.push(new TextRun(forceBold ? { ...opts, bold: true } : opts))
    }
  }
  return result.length > 0 ? result : [new TextRun(forceBold ? { text, bold: true } : { text })]
}

function parseGfmTableLine(line: string): string[] {
  return line
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim())
}

function isGfmTableSeparator(line: string): boolean {
  return /^\|?[\s:|*-]+\|?$/.test(line) && /[-]/.test(line)
}

function buildDocxTable(headerCells: string[], bodyRows: string[][]): Table {
  const colCount = headerCells.length
  const colWidthPct = Math.floor(9000 / colCount) // docx table width unit (twips, 9000 = ~100%)

  const headerRow = new TableRow({
    tableHeader: true,
    children: headerCells.map((cell) =>
      new TableCell({
        shading: { fill: 'F4F4F5' },
        width: { size: colWidthPct, type: WidthType.DXA },
        children: [new Paragraph({ children: parseInlineRuns(cell, true) })],
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
          left: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
          right: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
        },
      }),
    ),
  })

  const dataRows = bodyRows.map((row, rowIdx) =>
    new TableRow({
      children: row.slice(0, colCount).map((cell) =>
        new TableCell({
          shading: rowIdx % 2 === 1 ? { fill: 'FAFAFA' } : undefined,
          width: { size: colWidthPct, type: WidthType.DXA },
          children: [new Paragraph({ children: parseInlineRuns(cell) })],
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
            left: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
            right: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
          },
        }),
      ),
    }),
  )

  return new Table({ rows: [headerRow, ...dataRows], width: { size: 9000, type: WidthType.DXA } })
}

function markdownToParagraphs(md: string): (Paragraph | Table)[] {
  const result: (Paragraph | Table)[] = []
  const lines = md.split('\n')
  let inCode = false
  let codeLines: string[] = []
  let inMathBlock = false
  let mathLines: string[] = []
  // Table accumulator
  let tableHeader: string[] | null = null
  let tableBodyRows: string[][] = []

  const flushTable = () => {
    if (tableHeader && tableBodyRows.length > 0) {
      result.push(buildDocxTable(tableHeader, tableBodyRows))
      result.push(new Paragraph({ text: '' }))
    } else if (tableHeader) {
      // Header with no body – just emit as a heading row
      result.push(new Paragraph({ children: tableHeader.map((c) => new TextRun({ text: c, bold: true })), spacing: { after: 80 } }))
    }
    tableHeader = null
    tableBodyRows = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // ── Math block ($$...$$) ────────────────────────────────────────
    if (line.trim() === '$$') {
      if (inMathBlock) {
        const latex = mathLines.join('\n').trim()
        result.push(new Paragraph({
          // Centred display math — native Word equation rendered from KaTeX MathML
          children: [new DocxMath({ children: latexToDocxComponents(latex) })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 160, after: 160 },
        }))
        inMathBlock = false
        mathLines = []
      } else {
        flushTable()
        inMathBlock = true
      }
      continue
    }
    if (inMathBlock) { mathLines.push(line); continue }

    // ── Code block ─────────────────────────────────────────────────
    if (line.trim().startsWith('```')) {
      if (inCode) {
        result.push(new Paragraph({
          children: [new TextRun({ text: codeLines.join('\n'), font: 'Consolas', size: 20 })],
          indent: { left: 360 },
          spacing: { before: 80, after: 80 },
        }))
        inCode = false
        codeLines = []
      } else {
        flushTable()
        inCode = true
      }
      continue
    }
    if (inCode) { codeLines.push(line); continue }

    // ── GFM Table detection ─────────────────────────────────────────
    const isTableRow = line.includes('|')
    if (isTableRow) {
      if (tableHeader === null) {
        // Peek at the next line to confirm it's a table separator
        const nextLine = lines[i + 1] ?? ''
        if (nextLine.includes('|') && isGfmTableSeparator(nextLine)) {
          tableHeader = parseGfmTableLine(line)
          i++ // skip the separator line
          continue
        }
      } else if (!isGfmTableSeparator(line)) {
        tableBodyRows.push(parseGfmTableLine(line))
        continue
      }
    } else if (tableHeader !== null) {
      // Exiting the table block
      flushTable()
    }

    const h1 = line.match(/^# (.+)/)
    const h2 = line.match(/^## (.+)/)
    const h3 = line.match(/^### (.+)/)
    const h4 = line.match(/^#### (.+)/)
    const ulItem = line.match(/^[\s]*[-*+] (.+)/)
    const olItem = line.match(/^\d+\. (.+)/)
    const quote = line.match(/^> (.+)/)
    const hr = /^[-*_]{3,}$/.test(line.trim())

    if (h1) {
      result.push(new Paragraph({ text: h1[1], heading: HeadingLevel.HEADING_1 }))
    } else if (h2) {
      result.push(new Paragraph({ text: h2[1], heading: HeadingLevel.HEADING_2 }))
    } else if (h3) {
      result.push(new Paragraph({ text: h3[1], heading: HeadingLevel.HEADING_3 }))
    } else if (h4) {
      result.push(new Paragraph({ text: h4[1], heading: HeadingLevel.HEADING_4 }))
    } else if (hr) {
      result.push(new Paragraph({ text: '', border: { bottom: { color: 'E5E7EB', style: BorderStyle.SINGLE, size: 6, space: 4 } } }))
    } else if (ulItem) {
      result.push(new Paragraph({ children: parseInlineRuns(ulItem[1]), bullet: { level: 0 } }))
    } else if (olItem) {
      result.push(new Paragraph({ children: parseInlineRuns(olItem[1]), numbering: { reference: 'default-numbering', level: 0 } }))
    } else if (quote) {
      result.push(new Paragraph({
        children: [new TextRun({ text: quote[1], italics: true, color: '4B5563' })],
        indent: { left: 480 },
        border: { left: { color: 'D1D5DB', space: 8, size: 12, style: BorderStyle.SINGLE } },
      }))
    } else if (line.trim() === '') {
      result.push(new Paragraph({ text: '' }))
    } else {
      result.push(new Paragraph({ children: parseInlineRuns(line) }))
    }
  }

  // Flush any pending table / code block at EOF
  flushTable()
  if (inCode && codeLines.length > 0) {
    result.push(new Paragraph({
      children: [new TextRun({ text: codeLines.join('\n'), font: 'Consolas', size: 20 })],
      indent: { left: 360 },
    }))
  }
  if (inMathBlock && mathLines.length > 0) {
    result.push(new Paragraph({
      children: [new DocxMath({ children: latexToDocxComponents(mathLines.join('\n').trim()) })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: 160 },
    }))
  }

  return result
}

async function buildDocxBlob(title: string, paragraphs: (Paragraph | Table)[]): Promise<Blob> {
  const doc = new Document({
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [{
          level: 0,
          format: 'decimal',
          text: '%1.',
          alignment: AlignmentType.LEFT,
        }],
      }],
    },
    sections: [{
      children: [
        new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
        ...paragraphs,
      ],
    }],
  })
  const buffer = await Packer.toBlob(doc)
  return buffer
}

// ─── Document export ─────────────────────────────────────────────────

export type ExportFormat = 'markdown' | 'pdf' | 'docx'

export interface DocumentExportRequest {
  title: string
  markdown: string
  format: ExportFormat
}

export async function exportDocument(req: DocumentExportRequest): Promise<{ success: boolean; message?: string }> {
  const safeName = req.title.replace(/[<>:"/\\|?*]/g, '_').trim() || 'document'
  const isElectron = typeof window !== 'undefined' && typeof window.electron?.invoke === 'function'

  if (req.format === 'markdown') {
    if (isElectron) {
      const result = await saveViaElectron(
        req.markdown,
        `${safeName}.md`,
        [{ name: 'Markdown', extensions: ['md'] }, { name: 'Text', extensions: ['txt'] }],
      )
      if (result.canceled) return { success: false }
      if (result.error) return { success: false, message: result.error }
      return { success: true }
    } else {
      downloadBlob(req.markdown, `${safeName}.md`, 'text/markdown')
      return { success: true }
    }
  }

  if (req.format === 'pdf') {
    const bodyHtml = `<h1>${escapeHtml(req.title)}</h1>\n${await markdownToHtml(req.markdown)}`
    const html = buildPdfHtml(req.title, bodyHtml)
    if (isElectron) {
      const result = await savePdfViaElectron(html, `${safeName}.pdf`)
      if (result.canceled) return { success: false }
      if (result.error) return { success: false, message: result.error }
      return { success: true }
    } else {
      // Fallback: open in new tab for user to print
      const win = window.open()
      if (win) { win.document.write(html); win.document.close() }
      return { success: true }
    }
  }

  if (req.format === 'docx') {
    const paragraphs = markdownToParagraphs(req.markdown)
    const blob = await buildDocxBlob(req.title, paragraphs)
    if (isElectron) {
      const base64 = arrayBufferToBase64(await blob.arrayBuffer())
      const result = await saveViaElectron(
        base64,
        `${safeName}.docx`,
        [{ name: 'Word Document', extensions: ['docx'] }],
        'base64',
      )
      if (result.canceled) return { success: false }
      if (result.error) return { success: false, message: result.error }
      return { success: true }
    } else {
      downloadBinaryBlob(blob, `${safeName}.docx`)
      return { success: true }
    }
  }

  return { success: false, message: 'Unknown format' }
}

// ─── Chat export ─────────────────────────────────────────────────────

export interface ChatExportRequest {
  session: Session
  messages: Message[]
  format: ExportFormat
  /** 'all' = full conversation, 'single' = one specific message */
  scope: 'all' | 'single'
  singleMessageId?: string
}

function getChatExportMessages(req: ChatExportRequest): Message[] {
  return req.scope === 'single'
    ? req.messages.filter((m) => m.id === req.singleMessageId)
    : req.messages.filter((m) => m.role !== 'tool')
}

function formatTimestamp(ts: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ts)
}

function chatToMarkdown(req: ChatExportRequest): string {
  const msgs = getChatExportMessages(req)

  const lines: string[] = [
    `# ${req.session.title}`,
    '',
    `> 导出时间：${formatTimestamp(Date.now())}`,
    '',
    '---',
    '',
  ]

  for (const msg of msgs) {
    const role = msg.role === 'user' ? '用户' : '助手'
    const time = formatTimestamp(msg.timestamp)
    lines.push(`## ${role}  <sup>${time}</sup>`)
    lines.push('')
    lines.push(msg.content.trim())
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

async function chatToHtml(req: ChatExportRequest): Promise<string> {
  const msgs = getChatExportMessages(req)

  const bodyParts: string[] = [
    `<h1>${escapeHtml(req.session.title)}</h1>`,
    `<p style="color:#9ca3af;font-size:12px;">导出时间：${formatTimestamp(Date.now())}</p>`,
    '<hr>',
  ]

  // Convert all messages concurrently — avoids sequential awaits for long chats
  const renderedContents = await Promise.all(msgs.map((m) => markdownToHtml(m.content)))

  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i]
    const isUser = msg.role === 'user'
    const role = isUser ? '用户' : '助手'
    const time = formatTimestamp(msg.timestamp)
    const cls = isUser ? 'msg-user' : 'msg-assistant'
    bodyParts.push(`<div class="${cls}">`)
    bodyParts.push(`<div class="msg-role">${escapeHtml(role)}<span class="msg-time">${time}</span></div>`)
    bodyParts.push(renderedContents[i])
    bodyParts.push('</div>')
  }

  return buildPdfHtml(req.session.title, bodyParts.join('\n'))
}

async function chatToDocx(req: ChatExportRequest): Promise<Blob> {
  const msgs = getChatExportMessages(req)

  const paragraphs: (Paragraph | Table)[] = []

  for (const msg of msgs) {
    const isUser = msg.role === 'user'
    const role = isUser ? '用户' : '助手'
    const time = formatTimestamp(msg.timestamp)

    paragraphs.push(new Paragraph({
      children: [
        new TextRun({ text: role, bold: true, color: isUser ? '2563EB' : '059669', size: 22 }),
        new TextRun({ text: `  ${time}`, color: '9CA3AF', size: 18 }),
      ],
    }))

    const contentParagraphs = markdownToParagraphs(msg.content)
    paragraphs.push(...contentParagraphs)
    paragraphs.push(new Paragraph({ text: '', border: { bottom: { color: 'E5E7EB', style: BorderStyle.SINGLE, size: 6, space: 4 } } }))
    paragraphs.push(new Paragraph({ text: '' }))
  }

  return buildDocxBlob(req.session.title, paragraphs)
}

export async function exportChat(req: ChatExportRequest): Promise<{ success: boolean; message?: string }> {
  const safeName = (req.session.title || 'chat').replace(/[<>:"/\\|?*]/g, '_').trim()
  const isElectron = typeof window !== 'undefined' && typeof window.electron?.invoke === 'function'
  const exportMessages = getChatExportMessages(req)

  if (exportMessages.length === 0) {
    return { success: false, message: 'Nothing to export for the selected scope.' }
  }

  if (req.format === 'markdown') {
    const md = chatToMarkdown(req)
    if (isElectron) {
      const result = await saveViaElectron(
        md,
        `${safeName}.md`,
        [{ name: 'Markdown', extensions: ['md'] }, { name: 'Text', extensions: ['txt'] }],
      )
      if (result.canceled) return { success: false }
      if (result.error) return { success: false, message: result.error }
      return { success: true }
    } else {
      downloadBlob(md, `${safeName}.md`, 'text/markdown')
      return { success: true }
    }
  }

  if (req.format === 'pdf') {
    const html = await chatToHtml(req)
    if (isElectron) {
      const result = await savePdfViaElectron(html, `${safeName}.pdf`)
      if (result.canceled) return { success: false }
      if (result.error) return { success: false, message: result.error }
      return { success: true }
    } else {
      const win = window.open()
      if (win) { win.document.write(html); win.document.close() }
      return { success: true }
    }
  }

  if (req.format === 'docx') {
    const blob = await chatToDocx(req)
    if (isElectron) {
      const base64 = arrayBufferToBase64(await blob.arrayBuffer())
      const result = await saveViaElectron(
        base64,
        `${safeName}.docx`,
        [{ name: 'Word Document', extensions: ['docx'] }],
        'base64',
      )
      if (result.canceled) return { success: false }
      if (result.error) return { success: false, message: result.error }
      return { success: true }
    } else {
      downloadBinaryBlob(blob, `${safeName}.docx`)
      return { success: true }
    }
  }

  return { success: false, message: 'Unknown format' }
}
