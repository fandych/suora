import JSZip from "jszip"

export type ResourcePreviewKind = "markdown" | "data" | "script" | "image" | "video" | "audio" | "binary"

const TEXT_EXTENSIONS = new Set(["md", "mdx", "txt", "json", "yaml", "yml", "toml", "xml", "html", "css", "js", "mjs", "cjs", "ts", "tsx", "py", "sh", "bash", "zsh", "csv", "tsv", "sql"])
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp", "avif"])
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "ogg", "mov", "m4v"])
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "m4a", "flac", "aac"])
const DATA_EXTENSIONS = new Set(["json", "yaml", "yml", "toml", "xml", "csv", "tsv"])
const SCRIPT_EXTENSIONS = new Set(["ts", "tsx", "js", "mjs", "cjs", "py", "sh", "bash", "zsh", "ps1", "rb"])

export type ImportedArchiveEntry = {
  path: string
  content: string
  kind: "file" | "directory"
}

function getExtension(path: string) {
  const normalized = path.split(/[\\/]/).pop() ?? path
  const dotIndex = normalized.lastIndexOf(".")
  return dotIndex > -1 ? normalized.slice(dotIndex + 1).toLowerCase() : ""
}

export function guessMimeType(path: string) {
  const extension = getExtension(path)
  switch (extension) {
    case "png":
      return "image/png"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "gif":
      return "image/gif"
    case "svg":
      return "image/svg+xml"
    case "webp":
      return "image/webp"
    case "ico":
      return "image/x-icon"
    case "bmp":
      return "image/bmp"
    case "avif":
      return "image/avif"
    case "mp4":
      return "video/mp4"
    case "webm":
      return "video/webm"
    case "ogg":
      return "video/ogg"
    case "mov":
      return "video/quicktime"
    case "m4v":
      return "video/x-m4v"
    case "mp3":
      return "audio/mpeg"
    case "wav":
      return "audio/wav"
    case "m4a":
      return "audio/mp4"
    case "flac":
      return "audio/flac"
    case "pdf":
      return "application/pdf"
    case "json":
      return "application/json"
    default:
      return "application/octet-stream"
  }
}

export function isDataUrl(value: string) {
  return value.startsWith("data:")
}

export function isTextPath(path: string) {
  return TEXT_EXTENSIONS.has(getExtension(path))
}

export function getResourcePreviewKind(path: string, content: string): ResourcePreviewKind {
  const extension = getExtension(path)

  if (IMAGE_EXTENSIONS.has(extension) || content.startsWith("data:image/")) {
    return "image"
  }
  if (VIDEO_EXTENSIONS.has(extension) || content.startsWith("data:video/")) {
    return "video"
  }
  if (AUDIO_EXTENSIONS.has(extension) || content.startsWith("data:audio/")) {
    return "audio"
  }
  if (DATA_EXTENSIONS.has(extension)) {
    return "data"
  }
  if (SCRIPT_EXTENSIONS.has(extension)) {
    return "script"
  }
  if (isTextPath(path)) {
    return "markdown"
  }
  return "binary"
}

function toDataUrl(path: string, base64: string) {
  return `data:${guessMimeType(path)};base64,${base64}`
}

export async function readArchiveEntries(file: File) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const entries: ImportedArchiveEntry[] = []

  for (const [path, entry] of Object.entries(zip.files)) {
    const normalizedPath = path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/g, "")
    if (!normalizedPath) {
      continue
    }

    if (entry.dir) {
      entries.push({ path: normalizedPath, content: "", kind: "directory" })
      continue
    }

    const content = isTextPath(normalizedPath)
      ? await entry.async("string")
      : toDataUrl(normalizedPath, await entry.async("base64"))

    entries.push({ path: normalizedPath, content, kind: "file" })
  }

  return entries.sort((left, right) => left.path.localeCompare(right.path))
}
