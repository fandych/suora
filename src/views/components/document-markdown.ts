type TiptapMark = {
  type: string
  attrs?: Record<string, string>
}

type TiptapNode = {
  type: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: TiptapMark[]
  content?: TiptapNode[]
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function inlineMarkdown(value: string) {
  const mathTokens: string[] = []
  const tokenized = value.replace(/\$([^$\n]+)\$/g, (_, latex: string) => {
    mathTokens.push(latex)
    return `__MATH_TOKEN_${mathTokens.length - 1}__`
  })

  let result = escapeHtml(tokenized)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt: string, src: string) => `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}">`)
    .replace(/\[\[([^\]\n]+)\]\]/g, (_, target: string) => `<a href="#doc:${escapeAttr(target)}">${escapeHtml(target)}</a>`)
    .replace(/\[([^\]\n]+)\]\(([^)]+)\)/g, (_, label: string, href: string) => `<a href="${escapeAttr(href)}">${escapeHtml(label)}</a>`)

  result = result.replace(/__MATH_TOKEN_(\d+)__/g, (_, index: string) => `<span data-math-inline="${escapeAttr(mathTokens[Number.parseInt(index, 10)] ?? "")}"></span>`)
  return result
}

function parseTableRow(line: string): string[] {
  return line
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim())
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s|:-]+\|?$/.test(line) && /-/.test(line)
}

export function markdownToTiptapHtml(markdown: string) {
  const lines = markdown.split("\n")
  const html: string[] = []
  let list: "ul" | "ol" | 'ul[data-type="taskList"]' | null = null
  let inCode = false
  let codeLanguage = ""
  let codeLines: string[] = []
  let inMath = false
  let mathLines: string[] = []
  let tablePending: string[] = []
  let inTable = false

  const closeList = () => {
    if (!list) {
      return
    }

    html.push(`</${list === 'ul[data-type="taskList"]' ? "ul" : list}>`)
    list = null
  }

  const flushTable = () => {
    if (!inTable) {
      return
    }

    html.push("</tbody></table>")
    inTable = false
  }

  const flushPendingTable = () => {
    if (tablePending.length === 0) {
      return
    }

    for (const pending of tablePending) {
      html.push(`<p>${inlineMarkdown(pending)}</p>`)
    }
    tablePending = []
  }

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        if (codeLanguage === "mermaid") {
          html.push(`<div data-mermaid="${escapeAttr(codeLines.join("\n"))}"></div>`)
        }
        else {
          html.push(`<pre><code class="language-${escapeHtml(codeLanguage)}">${escapeHtml(codeLines.join("\n"))}</code></pre>`)
        }
        codeLines = []
        codeLanguage = ""
        inCode = false
      }
      else {
        closeList()
        flushTable()
        flushPendingTable()
        codeLanguage = line.trim().slice(3).trim()
        inCode = true
      }
      continue
    }

    if (inCode) {
      codeLines.push(line)
      continue
    }

    if (line.trim() === "$$") {
      if (inMath) {
        html.push(`<div data-math-block="${escapeAttr(mathLines.join("\n"))}"></div>`)
        mathLines = []
        inMath = false
      }
      else {
        closeList()
        flushTable()
        flushPendingTable()
        inMath = true
      }
      continue
    }

    if (inMath) {
      mathLines.push(line)
      continue
    }

    const isTableLine = line.trim().startsWith("|") || (line.includes("|") && !line.trim().startsWith("#"))
    if (inTable) {
      if (isTableSeparator(line) || !line.trim()) {
        if (!line.trim()) {
          flushTable()
        }
        continue
      }
      if (line.trim().startsWith("|") || line.includes("|")) {
        const cells = parseTableRow(line)
        html.push(`<tr>${cells.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`)
        continue
      }
      flushTable()
    }

    if (!inTable && tablePending.length === 0 && isTableLine && line.trim().startsWith("|")) {
      tablePending.push(line)
      continue
    }
    if (tablePending.length > 0) {
      if (isTableSeparator(line)) {
        closeList()
        const headerCells = parseTableRow(tablePending[0])
        html.push(`<table><thead><tr>${headerCells.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>`)
        inTable = true
        tablePending = []
        continue
      }
      flushPendingTable()
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      closeList()
      html.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`)
      continue
    }

    const taskUnchecked = /^\s*[-*]\s+\[ \]\s+(.*)$/.exec(line)
    if (taskUnchecked) {
      if (list !== 'ul[data-type="taskList"]') {
        closeList()
        list = 'ul[data-type="taskList"]'
        html.push('<ul data-type="taskList">')
      }
      html.push(`<li data-type="taskItem" data-checked="false"><label><input type="checkbox" /></label><div><p>${inlineMarkdown(taskUnchecked[1])}</p></div></li>`)
      continue
    }

    const taskChecked = /^\s*[-*]\s+\[x\]\s+(.*)$/i.exec(line)
    if (taskChecked) {
      if (list !== 'ul[data-type="taskList"]') {
        closeList()
        list = 'ul[data-type="taskList"]'
        html.push('<ul data-type="taskList">')
      }
      html.push(`<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked /></label><div><p>${inlineMarkdown(taskChecked[1])}</p></div></li>`)
      continue
    }

    const unordered = /^\s*[-*]\s+(.*)$/.exec(line)
    if (unordered) {
      if (list !== "ul") {
        closeList()
        list = "ul"
        html.push("<ul>")
      }
      html.push(`<li>${inlineMarkdown(unordered[1])}</li>`)
      continue
    }

    const ordered = /^\s*\d+\.\s+(.*)$/.exec(line)
    if (ordered) {
      if (list !== "ol") {
        closeList()
        list = "ol"
        html.push("<ol>")
      }
      html.push(`<li>${inlineMarkdown(ordered[1])}</li>`)
      continue
    }

    closeList()
    if (line.trim().startsWith(">")) {
      html.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ""))}</blockquote>`)
    }
    else if (line.trim() === "---") {
      html.push("<hr />")
    }
    else if (line.trim()) {
      html.push(`<p>${inlineMarkdown(line)}</p>`)
    }
  }

  closeList()
  flushTable()
  flushPendingTable()

  if (inCode) {
    html.push(codeLanguage === "mermaid"
      ? `<div data-mermaid="${escapeAttr(codeLines.join("\n"))}"></div>`
      : `<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`)
  }

  if (inMath) {
    html.push(`<div data-math-block="${escapeAttr(mathLines.join("\n"))}"></div>`)
  }

  return html.join("\n") || "<p></p>"
}

const MARK_ORDER = ["code", "bold", "italic", "strike", "link"] as const

function serializeMarks(text: string, marks: TiptapMark[]) {
  const markMap = new Map(marks.map((mark) => [mark.type, mark]))
  let output = text
  for (const type of MARK_ORDER) {
    const mark = markMap.get(type)
    if (!mark) {
      continue
    }
    if (type === "code") output = `\`${output}\``
    else if (type === "bold") output = `**${output}**`
    else if (type === "italic") output = `*${output}*`
    else if (type === "strike") output = `~~${output}~~`
    else if (type === "link") output = `[${output}](${mark.attrs?.href ?? ""})`
  }
  return output
}

function serializeNode(node: TiptapNode, listPrefix = ""): string {
  if (node.type === "text") {
    const raw = node.text ?? ""
    return node.marks?.length ? serializeMarks(raw, node.marks) : raw
  }

  const children = node.content ?? []
  switch (node.type) {
    case "doc":
      return `${children.map((child) => serializeNode(child)).join("").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`
    case "paragraph": {
      const text = children.map((child) => serializeNode(child)).join("")
      return listPrefix ? `${listPrefix}${text}\n` : text ? `${text}\n\n` : "\n"
    }
    case "heading": {
      const level = (node.attrs?.level as number) ?? 1
      const text = children.map((child) => serializeNode(child)).join("")
      return `${"#".repeat(level)} ${text}\n\n`
    }
    case "bulletList":
      return `${children.map((child) => serializeNode(child, "- ")).join("")}\n`
    case "orderedList":
      return `${children.map((child, index) => serializeNode(child, `${index + 1}. `)).join("")}\n`
    case "listItem": {
      const first = children[0]
      const rest = children.slice(1)
      return `${first ? serializeNode(first, listPrefix) : ""}${rest.map((child) => serializeNode(child)).join("")}`
    }
    case "blockquote": {
      const text = children.map((child) => serializeNode(child)).join("")
      return `${text.split("\n").filter(Boolean).map((line) => `> ${line}`).join("\n")}\n\n`
    }
    case "codeBlock": {
      const language = (node.attrs?.language as string) ?? ""
      const code = children.filter((child) => child.type === "text").map((child) => child.text ?? "").join("")
      return `\`\`\`${language}\n${code}\n\`\`\`\n\n`
    }
    case "horizontalRule":
      return "---\n\n"
    case "hardBreak":
      return "\n"
    case "image": {
      const src = (node.attrs?.src as string) ?? ""
      const alt = (node.attrs?.alt as string) ?? ""
      const title = (node.attrs?.title as string) ?? ""
      return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`
    }
    case "mathBlock":
      return `$$\n${(node.attrs?.content as string) ?? ""}\n$$\n\n`
    case "inlineMath":
      return `$${(node.attrs?.content as string) ?? ""}$`
    case "mermaidBlock":
      return `\`\`\`mermaid\n${(node.attrs?.code as string) ?? ""}\n\`\`\`\n\n`
    case "table": {
      if (!children.length) {
        return ""
      }
      const [header, ...body] = children
      const headerMarkdown = serializeNode(header, "__tableHeader__")
      const separator = `${(header.content ?? []).map(() => "| --- ").join("")}|\n`
      const bodyMarkdown = body.map((row) => serializeNode(row, "__tableRow__")).join("")
      return `${headerMarkdown}${separator}${bodyMarkdown}\n`
    }
    case "tableRow":
      return `|${children.map((cell) => ` ${(cell.content ?? []).map((child) => serializeNode(child)).join("").replace(/\n+$/, "")} `).join("|")}|\n`
    case "tableHeader":
    case "tableCell":
      return children.map((child) => serializeNode(child)).join("").replace(/\n+$/, "")
    case "taskList":
      return `${children.map((child) => serializeNode(child, "- ")).join("")}\n`
    case "taskItem": {
      const checked = (node.attrs?.checked as boolean) ?? false
      const checkbox = checked ? "[x]" : "[ ]"
      const first = children[0]
      const rest = children.slice(1)
      return `${first ? serializeNode(first, `- ${checkbox} `) : ""}${rest.map((child) => serializeNode(child)).join("")}`
    }
    default:
      return children.map((child) => serializeNode(child)).join("")
  }
}

export function tiptapJsonToMarkdown(json: TiptapNode) {
  return serializeNode(json)
}