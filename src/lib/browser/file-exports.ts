import { jsPDF } from "jspdf"
import { Document, Packer, Paragraph, TextRun } from "docx"
import { ToolApi } from "@/services/tool-service"

function downloadHref(filename: string, href: string) {
  const anchor = document.createElement("a")
  anchor.href = href
  anchor.download = filename
  anchor.rel = "noopener"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function downloadBlob(filename: string, blob: Blob) {
  const href = URL.createObjectURL(blob)
  downloadHref(filename, href)
  URL.revokeObjectURL(href)
}

export function downloadText(filename: string, content: string, type = "text/plain;charset=utf-8") {
  downloadBlob(filename, new Blob([content], { type }))
}

export const downloadJson = (filename: string, value: unknown) =>
  downloadText(filename, JSON.stringify(value, null, 2), "application/json;charset=utf-8")

export function downloadStoredContent(filename: string, content: string) {
  if (content.startsWith("data:")) {
    downloadHref(filename, content)
    return
  }
  downloadText(filename, content)
}

function isTextExtension(name: string) {
  return [
    "md",
    "mdx",
    "txt",
    "json",
    "yaml",
    "yml",
    "toml",
    "xml",
    "html",
    "css",
    "js",
    "mjs",
    "cjs",
    "ts",
    "tsx",
    "py",
    "sh",
    "bash",
    "zsh",
    "csv",
    "tsv",
    "sql",
  ].includes(name.split(".").pop()?.toLowerCase() ?? "")
}

export async function readBrowserFile(file: File) {
  if (isTextExtension(file.name)) return file.text()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}`))
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
    reader.readAsDataURL(file)
  })
}

type SaveFileResult = { canceled: boolean; ok: boolean; path: string | null }

function encodeArrayBufferToBase64(value: ArrayBuffer) {
  let binary = ""
  const bytes = new Uint8Array(value)
  for (let index = 0; index < bytes.length; index += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

async function saveArrayBuffer(
  defaultName: string,
  filters: Array<{ name: string; extensions: string[] }>,
  value: ArrayBuffer,
): Promise<SaveFileResult> {
  if (!window.app?.tools?.saveFile) {
    downloadBlob(defaultName, new Blob([value]))
    return { ok: true, canceled: false, path: defaultName }
  }
  return ToolApi.saveFile({ defaultName, filters, dataBase64: encodeArrayBufferToBase64(value) })
}

export async function saveTextFile(defaultName: string, content: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type })
  return saveArrayBuffer(
    defaultName,
    [{ name: "Text files", extensions: [defaultName.split(".").pop() ?? "txt"] }],
    await blob.arrayBuffer(),
  )
}

export async function savePdfFile(filename: string, content: string) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" })
  let y = 48
  for (const line of pdf.splitTextToSize(content || "", 520)) {
    if (y > 780) {
      pdf.addPage()
      y = 48
    }
    pdf.text(line, 40, y)
    y += 16
  }
  return saveArrayBuffer(filename, [{ name: "PDF", extensions: ["pdf"] }], pdf.output("arraybuffer"))
}

export async function saveDocxFile(filename: string, content: string) {
  const document = new Document({
    sections: [
      { children: (content || "").split(/\r?\n/).map((line) => new Paragraph({ children: [new TextRun(line)] })) },
    ],
  })
  const blob = await Packer.toBlob(document)
  return saveArrayBuffer(filename, [{ name: "Word document", extensions: ["docx"] }], await blob.arrayBuffer())
}
