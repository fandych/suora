export type ResourcePreviewKind = "markdown" | "data" | "script" | "image" | "video" | "audio" | "binary"

const textExtensions = new Set([
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
])
const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp", "avif"])
const videoExtensions = new Set(["mp4", "webm", "mov", "m4v"])
const audioExtensions = new Set(["mp3", "wav", "ogg", "m4a", "flac", "aac"])
const dataExtensions = new Set(["json", "yaml", "yml", "toml", "xml", "csv", "tsv"])
const scriptExtensions = new Set(["ts", "tsx", "js", "mjs", "cjs", "py", "sh", "bash", "zsh", "ps1", "rb"])

function getExtension(path: string) {
  const normalized = path.split(/[\\/]/).pop() ?? path
  const dotIndex = normalized.lastIndexOf(".")
  return dotIndex > -1 ? normalized.slice(dotIndex + 1).toLowerCase() : ""
}

export const isDataUrl = (value: string) => value.startsWith("data:")

export function getResourcePreviewKind(path: string, content: string): ResourcePreviewKind {
  const extension = getExtension(path)
  if (imageExtensions.has(extension) || content.startsWith("data:image/")) return "image"
  if (videoExtensions.has(extension) || content.startsWith("data:video/")) return "video"
  if (audioExtensions.has(extension) || content.startsWith("data:audio/")) return "audio"
  if (dataExtensions.has(extension)) return "data"
  if (scriptExtensions.has(extension)) return "script"
  return textExtensions.has(extension) ? "markdown" : "binary"
}
