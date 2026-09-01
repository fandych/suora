function downloadHref(filename: string, href: string) {
  const anchor = document.createElement("a")
  anchor.href = href
  anchor.download = filename
  anchor.rel = "noopener"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export function downloadBlob(filename: string, blob: Blob) {
  const href = URL.createObjectURL(blob)
  downloadHref(filename, href)
  URL.revokeObjectURL(href)
}

export function downloadText(filename: string, content: string, type = "text/plain;charset=utf-8") {
  downloadBlob(filename, new Blob([content], { type }))
}

export function downloadJson(filename: string, value: unknown) {
  downloadText(filename, JSON.stringify(value, null, 2), "application/json;charset=utf-8")
}

export function downloadStoredContent(filename: string, content: string) {
  if (content.startsWith("data:")) {
    downloadHref(filename, content)
    return
  }

  downloadText(filename, content)
}

function isTextExtension(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() ?? ""
  return ["md", "mdx", "txt", "json", "yaml", "yml", "toml", "xml", "html", "css", "js", "mjs", "cjs", "ts", "tsx", "py", "sh", "bash", "zsh", "csv", "tsv", "sql"].includes(extension)
}

export async function readBrowserFile(file: File) {
  if (isTextExtension(file.name)) {
    return file.text()
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}`))
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
    reader.readAsDataURL(file)
  })
}