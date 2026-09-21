import type { SkillFileRecord } from "@/types/document"

export const SKILL_ROOT_PATH = "__skill_root__"
const coreTopLevelFolders = ["scripts", "references", "assets"] as const
const allowedTopLevelFolders = [...coreTopLevelFolders, "other"] as const
export type SkillTreeEntry = {
  path: string
  label: string
  depth: number
  kind: "file" | "directory"
  file?: SkillFileRecord
}

export const normalizeSkillPath = (path: string) => path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/")

export function isSafeSkillResourcePath(path: string) {
  if (!path || path.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(path)) return false
  const parts = normalizeSkillPath(path).split("/").filter(Boolean)
  return Boolean(parts.length && !parts.includes(".") && !parts.includes("..") && allowedTopLevelFolders.includes(parts[0] as (typeof allowedTopLevelFolders)[number]))
}

export function getSkillSourceLanguage(path: string, language?: string) {
  if (language)
    return (
      (
        {
          md: "markdown",
          ts: "typescript",
          js: "javascript",
          json: "json",
          yaml: "yaml",
          yml: "yaml",
          sh: "shell",
          py: "python",
        } as Record<string, string>
      )[language] ?? language
    )
  const extension = normalizeSkillPath(path).split(".").pop()?.toLowerCase()
  if (["md", "mdx", "markdown", "txt"].includes(extension ?? "")) return "markdown"
  if (["ts", "tsx"].includes(extension ?? "")) return "typescript"
  if (["js", "mjs", "cjs"].includes(extension ?? "")) return "javascript"
  if (extension === "json") return "json"
  if (["yaml", "yml"].includes(extension ?? "")) return "yaml"
  if (["sh", "bash", "zsh"].includes(extension ?? "")) return "shell"
  if (extension === "py") return "python"
  return "plaintext"
}

export function isEditableSkillFile(path: string) {
  const extension = normalizeSkillPath(path).split(".").pop()?.toLowerCase() ?? ""
  return (
    !["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp", "avif"].includes(extension) &&
    !["bin", "exe", "pdf"].includes(extension)
  )
}

export function getDefaultSkillFileName(parentPath: string) {
  return normalizeSkillPath(parentPath).startsWith("scripts/")
    ? "helper.ts"
    : normalizeSkillPath(parentPath).startsWith("references/")
      ? "notes.md"
      : normalizeSkillPath(parentPath).startsWith("assets/")
        ? "asset.txt"
        : "file.md"
}

export function parseSkillFrontmatter(content: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/m.exec(content)
  const read = (key: string) =>
    match
      ? (new RegExp(`^${key}:\\s*(.+)$`, "im")
          .exec(match[1])?.[1]
          ?.trim()
          .replace(/^['"]|['"]$/g, "") ?? "")
      : ""
  return { name: read("name"), description: read("description") }
}

export function buildSkillTree(files: SkillFileRecord[], skillName = "Skill"): SkillTreeEntry[] {
  const entries: SkillTreeEntry[] = [{ path: SKILL_ROOT_PATH, label: skillName, depth: 0, kind: "directory" }]
  const added = new Set([SKILL_ROOT_PATH])
  const normalizedFiles = files.map((file) => ({ ...file, path: normalizeSkillPath(file.path) }))
  const fileMap = new Map(normalizedFiles.map((file) => [file.path, file] as const))
  const push = (path: string, kind: "file" | "directory", file?: SkillFileRecord) => {
    if (!added.has(path)) {
      const parts = normalizeSkillPath(path).split("/")
      entries.push({ path, label: parts.at(-1) ?? path, depth: parts.length, kind, file })
      added.add(path)
    }
  }

  const appendBranch = (topLevelPath: string, forceDirectory: boolean) => {
    const topLevelFile = fileMap.get(topLevelPath)
    push(topLevelPath, forceDirectory ? "directory" : (topLevelFile?.kind === "directory" ? "directory" : "file"), topLevelFile)
    for (const file of normalizedFiles
      .filter((item) => item.path.startsWith(`${topLevelPath}/`))
      .sort((left, right) => left.path.localeCompare(right.path))) {
      const parts = file.path.split("/")
      for (let index = 0; index < parts.length - 1; index += 1) {
        const currentPath = parts.slice(0, index + 1).join("/")
        push(currentPath, "directory", fileMap.get(currentPath))
      }
      push(file.path, file.kind === "directory" ? "directory" : "file", file)
    }
  }

  const manifest = fileMap.get("SKILL.md")
  if (manifest) {
    push("SKILL.md", "file", manifest)
  }

  for (const folder of coreTopLevelFolders) appendBranch(folder, true)

  const extraTopLevelPaths = Array.from(
    new Set(
      normalizedFiles
        .map((file) => file.path.split("/")[0] ?? "")
        .filter((path) => path && path !== "SKILL.md" && !coreTopLevelFolders.includes(path as (typeof coreTopLevelFolders)[number])),
    ),
  ).sort((left, right) => left.localeCompare(right))

  for (const path of extraTopLevelPaths) appendBranch(path, normalizedFiles.some((file) => file.path.startsWith(`${path}/`)))

  return entries
}
