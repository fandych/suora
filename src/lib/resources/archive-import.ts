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

export type ArchiveImportStrategy = "overwrite" | "skip" | "rename"

export type ArchiveImportIssue = {
  path: string
  message: string
  severity: "error" | "warning"
}

export type ArchiveImportPlanEntry = ImportedArchiveEntry & {
  conflictSource?: "archive" | "workspace"
  message?: string
  normalizedPath: string
  resolvedPath: string | null
  status: "ready" | "renamed" | "overwritten" | "skipped" | "error"
}

export type ArchiveImportPlan = {
  entries: ArchiveImportPlanEntry[]
  issues: ArchiveImportIssue[]
  importCount: number
  hasBlockingIssues: boolean
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

function normalizeArchivePath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/g, "").replace(/\/+/g, "/")
}

function getArchivePathExtension(path: string) {
  const slashIndex = path.lastIndexOf("/")
  const dotIndex = path.lastIndexOf(".")
  return dotIndex > slashIndex ? path.slice(dotIndex) : ""
}

function getArchivePathStem(path: string) {
  const extension = getArchivePathExtension(path)
  return extension ? path.slice(0, -extension.length) : path
}

function getUniqueArchivePath(path: string, usedPaths: Set<string>) {
  if (!usedPaths.has(path)) {
    return path
  }

  const extension = getArchivePathExtension(path)
  const stem = getArchivePathStem(path)
  let index = 2
  let candidate = `${stem}-${index}${extension}`

  while (usedPaths.has(candidate)) {
    index += 1
    candidate = `${stem}-${index}${extension}`
  }

  return candidate
}

export function createArchiveImportPlan(
  entries: ImportedArchiveEntry[],
  options: {
    existingPaths?: Iterable<string>
    strategy: ArchiveImportStrategy
    validatePath: (path: string, kind: ImportedArchiveEntry["kind"]) => string | null
  },
) {
  const issues: ArchiveImportIssue[] = []
  const plannedEntries: ArchiveImportPlanEntry[] = []
  const activeEntryByPath = new Map<string, number>()
  const usedPaths = new Set<string>(Array.from(options.existingPaths ?? [], (path) => normalizeArchivePath(path)).filter(Boolean))

  for (const entry of entries) {
    const normalizedPath = normalizeArchivePath(entry.path)
    const validationError = options.validatePath(normalizedPath, entry.kind)

    if (validationError) {
      plannedEntries.push({
        ...entry,
        conflictSource: "archive",
        normalizedPath,
        resolvedPath: null,
        status: "error",
        message: validationError,
      })
      issues.push({ path: normalizedPath, message: validationError, severity: "error" })
      continue
    }

    const previousEntryIndex = activeEntryByPath.get(normalizedPath)
    if (previousEntryIndex !== undefined) {
      if (options.strategy === "skip") {
        const message = "Skipped because the archive already contains the same normalized path."
        plannedEntries.push({
          ...entry,
          conflictSource: "archive",
          normalizedPath,
          resolvedPath: null,
          status: "skipped",
          message,
        })
        issues.push({ path: normalizedPath, message, severity: "warning" })
        continue
      }

      if (options.strategy === "rename") {
        const resolvedPath = getUniqueArchivePath(normalizedPath, usedPaths)
        const message = `Renamed from ${normalizedPath} to avoid a duplicate path in the archive.`
        plannedEntries.push({
          ...entry,
          conflictSource: "archive",
          normalizedPath,
          resolvedPath,
          status: "renamed",
          message,
        })
        usedPaths.add(resolvedPath)
        activeEntryByPath.set(resolvedPath, plannedEntries.length - 1)
        issues.push({ path: normalizedPath, message, severity: "warning" })
        continue
      }

      plannedEntries[previousEntryIndex] = {
        ...plannedEntries[previousEntryIndex],
        conflictSource: "archive",
        resolvedPath: null,
        status: "skipped",
        message: "Overwritten by a later archive entry with the same normalized path.",
      }
      const message = "This entry overwrites an earlier archive entry with the same normalized path."
      plannedEntries.push({
        ...entry,
        conflictSource: "archive",
        normalizedPath,
        resolvedPath: normalizedPath,
        status: "overwritten",
        message,
      })
      activeEntryByPath.set(normalizedPath, plannedEntries.length - 1)
      issues.push({ path: normalizedPath, message, severity: "warning" })
      continue
    }

    if (usedPaths.has(normalizedPath)) {
      if (options.strategy === "skip") {
        const message = "Skipped because the workspace already contains this path."
        plannedEntries.push({
          ...entry,
          conflictSource: "workspace",
          normalizedPath,
          resolvedPath: null,
          status: "skipped",
          message,
        })
        issues.push({ path: normalizedPath, message, severity: "warning" })
        continue
      }

      if (options.strategy === "rename") {
        const resolvedPath = getUniqueArchivePath(normalizedPath, usedPaths)
        const message = `Renamed from ${normalizedPath} because the workspace already contains that path.`
        plannedEntries.push({
          ...entry,
          conflictSource: "workspace",
          normalizedPath,
          resolvedPath,
          status: "renamed",
          message,
        })
        usedPaths.add(resolvedPath)
        activeEntryByPath.set(resolvedPath, plannedEntries.length - 1)
        issues.push({ path: normalizedPath, message, severity: "warning" })
        continue
      }

      const message = "This entry will overwrite an existing workspace path."
      plannedEntries.push({
        ...entry,
        conflictSource: "workspace",
        normalizedPath,
        resolvedPath: normalizedPath,
        status: "overwritten",
        message,
      })
      activeEntryByPath.set(normalizedPath, plannedEntries.length - 1)
      issues.push({ path: normalizedPath, message, severity: "warning" })
      continue
    }

    plannedEntries.push({
      ...entry,
      normalizedPath,
      resolvedPath: normalizedPath,
      status: "ready",
    })
    usedPaths.add(normalizedPath)
    activeEntryByPath.set(normalizedPath, plannedEntries.length - 1)
  }

  if (!plannedEntries.some((entry) => entry.kind === "file" && entry.resolvedPath)) {
    issues.push({ path: "", message: "The archive does not contain any importable files.", severity: "error" })
  }

  return {
    entries: plannedEntries,
    issues,
    importCount: plannedEntries.filter((entry) => entry.kind === "file" && entry.resolvedPath).length,
    hasBlockingIssues: issues.some((issue) => issue.severity === "error"),
  } satisfies ArchiveImportPlan
}

export function getImportableArchiveEntries(plan: ArchiveImportPlan) {
  return plan.entries
    .filter((entry) => entry.resolvedPath)
    .map((entry) => ({
      path: entry.resolvedPath ?? entry.normalizedPath,
      content: entry.content,
      kind: entry.kind,
    }))
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
