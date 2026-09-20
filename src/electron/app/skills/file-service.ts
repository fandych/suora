import path from "node:path"
import type { SkillFileContent, SkillFileRecord, SkillFileTree, SkillFileTreeNode } from "@/types/document"

const topLevelFolders = ["scripts", "references", "assets", "other"] as const
const WINDOWS_RESERVED_FILE_NAMES = new Set([
  "aux",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "con",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
  "nul",
  "prn",
])

export function normalizeSkillPath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/").replace(/\/$/, "")
}

export function getSkillFileType(filePath: string): SkillFileContent["fileType"] {
  const extension = path.posix.extname(filePath).slice(1).toLowerCase()
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp", "avif"].includes(extension)) return "image"
  if (["ts", "tsx", "js", "mjs", "cjs", "sh", "bash", "zsh", "py", "rb", "ps1"].includes(extension)) return "script"
  if (["json", "yaml", "yml", "toml", "xml", "ini", "env", "csv", "tsv"].includes(extension)) return "data"
  if (["md", "markdown", "mdx", "txt", ""].includes(extension)) return "markdown"
  return "binary"
}

function assertNoReservedWindowsPathSegments(parts: string[]) {
  for (const part of parts) {
    const stem = part.split(".")[0]?.trim().toLowerCase()
    if (stem && WINDOWS_RESERVED_FILE_NAMES.has(stem)) {
      throw new Error(`Skill file path contains a reserved Windows file name: ${part}`)
    }
  }
}

export function assertSafeSkillFilePath(value: string, allowSkillManifest = true) {
  const normalized = normalizeSkillPath(value)
  if (!normalized || normalized.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(value))
    throw new Error("Skill file path must be relative.")
  if (normalized === "SKILL.md" && allowSkillManifest) return normalized
  const parts = normalized.split("/")
  assertNoReservedWindowsPathSegments(parts)
  const [topLevel] = normalized.split("/")
  if (
    !topLevelFolders.includes(topLevel as (typeof topLevelFolders)[number]) ||
    parts.some((part) => !part || part === "." || part === "..")
  )
    throw new Error("Skill files must be SKILL.md or located under scripts, references, assets, or other.")
  return normalized
}

export function parseSkillFiles(value: string | undefined): SkillFileRecord[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item): SkillFileRecord[] => {
      if (!item || typeof item !== "object") return []
      const candidate = item as Partial<SkillFileRecord>
      if (typeof candidate.path !== "string" || typeof candidate.content !== "string") return []
      try {
        const filePath = assertSafeSkillFilePath(candidate.path)
        return [
          {
            path: filePath,
            content: candidate.content,
            language: typeof candidate.language === "string" ? candidate.language : "plaintext",
            kind: candidate.kind === "directory" ? "directory" : "file",
            executable: Boolean(candidate.executable),
          },
        ]
      } catch (error) {
        console.warn(`Skipping invalid skill file entry '${candidate.path}'.`, error)
        return []
      }
    })
  } catch (error) {
    console.warn("Failed to parse skill files JSON. Falling back to an empty file list.", error)
    return []
  }
}

export function serializeSkillFiles(files: SkillFileRecord[]) {
  const seen = new Set<string>()
  const normalized = files.map((file) => {
    const filePath = assertSafeSkillFilePath(file.path)
    if (seen.has(filePath)) throw new Error(`Duplicate skill file path: ${filePath}`)
    seen.add(filePath)
    return {
      ...file,
      path: filePath,
      kind: file.kind === "directory" ? "directory" : "file",
      executable: Boolean(file.executable),
    }
  })
  return JSON.stringify(normalized)
}

export function buildSkillFileTree(
  skillId: string,
  skillName: string,
  description: string,
  files: SkillFileRecord[],
): SkillFileTree {
  const root: SkillFileTreeNode = { fileName: skillName, filePath: "", fileType: "directory", children: [] }
  const directories = new Map<string, SkillFileTreeNode>([["", root]])
  for (const file of [...files].sort((left, right) => left.path.localeCompare(right.path))) {
    const filePath = normalizeSkillPath(file.path)
    const parts = filePath.split("/")
    let parentPath = ""
    for (let index = 0; index < parts.length - 1; index += 1) {
      const currentPath = parentPath ? `${parentPath}/${parts[index]}` : parts[index]
      if (!directories.has(currentPath)) {
        const node = { fileName: parts[index], filePath: currentPath, fileType: "directory" as const, children: [] }
        directories.get(parentPath)!.children!.push(node)
        directories.set(currentPath, node)
      }
      parentPath = currentPath
    }
    directories.get(parentPath)!.children!.push({
      fileName: parts.at(-1)!,
      filePath,
      fileType: file.kind === "directory" ? "directory" : getSkillFileType(filePath),
      ...(file.kind === "directory" ? { children: [] } : {}),
    })
  }
  const sort = (nodes: SkillFileTreeNode[]) => {
    nodes.sort((left, right) =>
      left.fileType === "directory" && right.fileType !== "directory"
        ? -1
        : left.fileType !== "directory" && right.fileType === "directory"
          ? 1
          : left.fileName.localeCompare(right.fileName),
    )
    nodes.forEach((node) => node.children && sort(node.children))
  }
  sort(root.children!)
  return { skillId, skillName, description, children: root.children! }
}

export function getSkillFileContent(
  skillId: string,
  skillName: string,
  description: string,
  updatedAt: number,
  files: SkillFileRecord[],
  filePath: string,
): SkillFileContent {
  const normalizedPath = assertSafeSkillFilePath(filePath)
  const file = files.find((item) => normalizeSkillPath(item.path) === normalizedPath)
  if (!file || file.kind === "directory") throw new Error("Skill file was not found.")
  return {
    skillId,
    skillName,
    description,
    fileName: path.posix.basename(normalizedPath),
    filePath: normalizedPath,
    fileContent: file.content,
    fileType: getSkillFileType(normalizedPath),
    lastModifyDate: updatedAt,
  }
}
