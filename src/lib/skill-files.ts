import type { SkillFileRecord } from "@/data/domain/models"

export const SKILL_TOP_LEVEL_FOLDERS = ["scripts", "references", "assets", "other"] as const

export type SkillTreeEntry = {
  path: string
  label: string
  depth: number
  kind: "file" | "directory"
  file?: SkillFileRecord
}

type SkillFrontmatter = {
  name: string
  description: string
}

export function normalizeSkillPath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/")
}

export function isSkillTopLevelFolder(segment: string): segment is (typeof SKILL_TOP_LEVEL_FOLDERS)[number] {
  return (SKILL_TOP_LEVEL_FOLDERS as readonly string[]).includes(segment)
}

export function isSafeSkillResourcePath(path: string) {
  if (!path || path.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(path)) {
    return false
  }

  const normalized = normalizeSkillPath(path)
  const segments = normalized.split("/").filter(Boolean)
  return segments.length > 0 && !segments.includes("..") && !segments.includes(".") && isSkillTopLevelFolder(segments[0])
}

export function getSkillArchivePathError(path: string, kind: "file" | "directory") {
  const normalized = normalizeSkillPath(path)

  if (!normalized) {
    return "Archive entries must include a non-empty relative path."
  }

  if (normalized === "SKILL.md") {
    return kind === "file" ? null : "SKILL.md must be a file, not a directory."
  }

  if (!isSafeSkillResourcePath(normalized)) {
    return "Skill archives can only include SKILL.md or content under scripts, references, assets, or other."
  }

  return null
}

export function getSkillSourceLanguage(path: string, language?: string) {
  if (language) {
    switch (language) {
      case "md":
        return "markdown"
      case "ts":
        return "typescript"
      case "js":
        return "javascript"
      case "json":
        return "json"
      case "yaml":
      case "yml":
        return "yaml"
      case "sh":
        return "shell"
      case "py":
        return "python"
    }
  }

  const extension = normalizeSkillPath(path).split(".").pop()?.toLowerCase() ?? ""
  switch (extension) {
    case "md":
    case "mdx":
    case "markdown":
    case "txt":
      return "markdown"
    case "ts":
    case "tsx":
      return "typescript"
    case "js":
    case "mjs":
    case "cjs":
      return "javascript"
    case "json":
      return "json"
    case "yaml":
    case "yml":
      return "yaml"
    case "sh":
    case "bash":
    case "zsh":
      return "shell"
    case "py":
      return "python"
    default:
      return "plaintext"
  }
}

export function classifySkillFileKind(path: string) {
  const extension = normalizeSkillPath(path).split(".").pop()?.toLowerCase() ?? ""
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp", "avif"].includes(extension)) {
    return "image"
  }
  if (["ts", "tsx", "js", "mjs", "cjs", "sh", "bash", "zsh", "py", "rb", "ps1"].includes(extension)) {
    return "script"
  }
  if (["json", "yaml", "yml", "toml", "xml", "ini", "env", "csv", "tsv"].includes(extension)) {
    return "data"
  }
  if (["md", "markdown", "mdx", "txt", ""].includes(extension)) {
    return "markdown"
  }
  return "binary"
}

export function isEditableSkillFile(path: string) {
  const kind = classifySkillFileKind(path)
  return kind !== "image" && kind !== "binary"
}

export function getDefaultSkillFileName(parentPath: string) {
  const topFolder = normalizeSkillPath(parentPath).split("/")[0]
  switch (topFolder) {
    case "scripts":
      return "helper.ts"
    case "references":
      return "notes.md"
    case "assets":
      return "asset.txt"
    default:
      return "file.md"
  }
}

export function buildSkillMarkdown(name: string, description: string, body?: string) {
  const lines = [
    "---",
    `name: ${JSON.stringify(name || "new-skill")}`,
    `description: ${JSON.stringify(description || "Describe what this skill does")}`,
    "---",
    "",
  ]

  if (body?.trim()) {
    lines.push(body.trim(), "")
  }
  else {
    lines.push(
      "## Purpose",
      "",
      "Describe what this skill does and the outcome it should drive.",
      "",
      "## Triggers",
      "",
      "- Use when the user asks for this capability.",
      "",
      "## Instructions",
      "",
      "1. Gather the minimum context needed.",
      "2. Execute the task directly.",
      "3. Return concise results.",
      ""
    )
  }

  return lines.join("\n")
}

export function parseSkillFrontmatter(content: string): SkillFrontmatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/m.exec(content)
  if (!match) {
    return { name: "", description: "" }
  }

  const meta = match[1]
  const name = /^name:\s*(.+)$/im.exec(meta)?.[1]?.trim().replace(/^['"]|['"]$/g, "") ?? ""
  const description = /^description:\s*(.+)$/im.exec(meta)?.[1]?.trim().replace(/^['"]|['"]$/g, "") ?? ""
  return { name, description }
}

function createFile(path: string, content: string, language?: string, executable = false): SkillFileRecord {
  return {
    path,
    content,
    language: language ?? getSkillSourceLanguage(path),
    kind: "file",
    executable,
  }
}

function createDirectory(path: string): SkillFileRecord {
  return { path, content: "", language: "plaintext", kind: "directory", executable: false }
}

export function ensureSkillFiles(files: SkillFileRecord[], title: string, summary: string) {
  const normalized = new Map<string, SkillFileRecord>()

  for (const file of files) {
    const path = normalizeSkillPath(file.path)
    if (!path) {
      continue
    }

    normalized.set(path, {
      ...file,
      path,
      kind: file.kind ?? "file",
      language: file.language || getSkillSourceLanguage(path),
      executable: file.executable ?? path.toLowerCase().startsWith("scripts/"),
    })
  }

  for (const folder of SKILL_TOP_LEVEL_FOLDERS) {
    if (!normalized.has(folder)) {
      normalized.set(folder, createDirectory(folder))
    }
  }

  const skillMarkdown = normalized.get("SKILL.md")
  if (!skillMarkdown) {
    normalized.set("SKILL.md", createFile("SKILL.md", buildSkillMarkdown(title, summary), "md"))
  }
  else if (!/^---\r?\n/.test(skillMarkdown.content)) {
    normalized.set("SKILL.md", createFile("SKILL.md", buildSkillMarkdown(title, summary, skillMarkdown.content), "md"))
  }

  if (!normalized.has("references/README.md")) {
    normalized.set("references/README.md", createFile("references/README.md", "# References\n\nCapture supporting material, examples, and usage notes here.\n", "md"))
  }
  if (!normalized.has("assets/.gitkeep")) {
    normalized.set("assets/.gitkeep", createFile("assets/.gitkeep", "", "txt"))
  }
  if (!normalized.has("scripts/main.ts")) {
    normalized.set("scripts/main.ts", createFile("scripts/main.ts", "export async function main(input: unknown) {\n  return { ok: true, input }\n}\n", "ts", true))
  }
  if (!normalized.has("other/notes.md")) {
    normalized.set("other/notes.md", createFile("other/notes.md", "# Notes\n\nPut extra implementation notes or snippets here.\n", "md"))
  }

  return Array.from(normalized.values()).sort((left, right) => left.path.localeCompare(right.path))
}

export function buildSkillTree(files: SkillFileRecord[]): SkillTreeEntry[] {
  const entries: SkillTreeEntry[] = []
  const added = new Set<string>()

  const pushEntry = (path: string, kind: "file" | "directory", file?: SkillFileRecord) => {
    if (added.has(path)) {
      return
    }

    const parts = normalizeSkillPath(path).split("/")
    entries.push({
      path,
      label: parts[parts.length - 1],
      depth: parts.length - 1,
      kind,
      file,
    })
    added.add(path)
  }

  const skillFile = files.find((file) => normalizeSkillPath(file.path) === "SKILL.md")
  if (skillFile) {
    pushEntry("SKILL.md", "file", skillFile)
  }

  for (const folder of SKILL_TOP_LEVEL_FOLDERS) {
    pushEntry(folder, "directory", files.find((file) => normalizeSkillPath(file.path) === folder))
    for (const file of files
      .filter((candidate) => normalizeSkillPath(candidate.path).startsWith(`${folder}/`))
      .sort((left, right) => normalizeSkillPath(left.path).localeCompare(normalizeSkillPath(right.path)))) {
      const parts = normalizeSkillPath(file.path).split("/")
      for (let index = 0; index < parts.length - 1; index += 1) {
        const folderPath = parts.slice(0, index + 1).join("/")
        pushEntry(folderPath, "directory", files.find((candidate) => normalizeSkillPath(candidate.path) === folderPath))
      }

      pushEntry(file.path, (file.kind ?? "file") === "directory" ? "directory" : "file", file)
    }
  }

  return entries
}