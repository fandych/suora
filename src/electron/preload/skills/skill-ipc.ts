import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { ipcMain } from "electron"
import { skillService } from "@/electron/app/skills/service"
import { normalizeLegacySkillFiles } from "@/electron/app/skills/file-service"
import { entityIdSchema, parseIpcInput, versionedResourceSaveSchema } from "@/electron/preload/system/ipc-input-schemas"

const externalSources = ["codex", "claude", "agents"] as const
const maxExternalFileSize = 2 * 1024 * 1024

function readManifestField(content: string, key: string) {
  const match = new RegExp(`^${key}:\\s*(.+)$`, "im").exec(content.match(/^---\r?\n([\s\S]*?)\r?\n---/m)?.[1] ?? "")
  return match?.[1]?.trim().replace(/^['"]|['"]$/g, "") ?? ""
}

function getExternalSkillDirectory(skillId: string) {
  const separator = skillId.indexOf(":")
  const source = separator > 0 ? skillId.slice(0, separator) : ""
  const name = separator > 0 ? skillId.slice(separator + 1) : ""
  if (!externalSources.includes(source as (typeof externalSources)[number]) || !name || name.includes("/") || name.includes("\\")) {
    throw new Error("Invalid external skill id.")
  }
  return path.join(os.homedir(), `.${source}`, "skills", name)
}

async function readExternalSkill(skillId: string) {
  const directory = getExternalSkillDirectory(skillId)
  const root = await fs.realpath(directory)
  const files: Array<{ path: string; content: string; language: string; kind: "file" | "directory"; executable: boolean }> = []
  const visit = async (current: string) => {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name)
      const relativePath = path.relative(root, absolutePath).split(path.sep).join("/")
      if (!relativePath || relativePath.startsWith("../") || path.isAbsolute(relativePath)) continue
      if (entry.isDirectory()) {
        files.push({ path: relativePath, content: "", language: "plaintext", kind: "directory", executable: false })
        await visit(absolutePath)
        continue
      }
      const stats = await fs.stat(absolutePath)
      if (stats.size > maxExternalFileSize) continue
      const content = await fs.readFile(absolutePath, "utf8")
      files.push({ path: relativePath, content, language: "plaintext", kind: "file", executable: false })
    }
  }
  await visit(root)
  const normalizedFiles = normalizeLegacySkillFiles(files)
  const manifest = normalizedFiles.find((file) => file.path === "SKILL.md")
  if (!manifest) throw new Error("External skill is missing SKILL.md.")
  const name = skillId.slice(skillId.indexOf(":") + 1)
  const manifestName = readManifestField(manifest.content, "name")
  const summary = readManifestField(manifest.content, "description")
  const now = Date.now()
  return {
    skill: { id: skillId, title: manifestName || name, source: skillId.slice(0, skillId.indexOf(":")), summary, updatedAt: now },
    files: normalizedFiles,
  }
}

export function registerSkillIpc() {
  ipcMain.handle("skills:list", () => skillService.list())
  ipcMain.handle("skills:listExternal", async () => {
    const results: Array<{ id: string; title: string; source: string; summary: string }> = []
    for (const source of externalSources) {
      const directory = path.join(os.homedir(), `.${source}`, "skills")
      try {
        for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
          if (entry.isDirectory() && (await fs.readdir(path.join(directory, entry.name))).includes("SKILL.md"))
            results.push({
              id: `${source}:${entry.name}`,
              title: entry.name,
              source,
              summary: path.join(directory, entry.name),
            })
        }
      } catch {
        /* optional */
      }
    }
    return results
  })
  ipcMain.handle("skills:getExternal", (_event, value: unknown) => readExternalSkill(parseIpcInput(entityIdSchema, value)))
  ipcMain.handle("skills:get", (_event, value: unknown) => skillService.get(parseIpcInput(entityIdSchema, value)))
  ipcMain.handle("skills:getFileTree", (_event, skillId: unknown) =>
    skillService.getFileTree(parseIpcInput(entityIdSchema, skillId)),
  )
  ipcMain.handle("skills:getFile", (_event, skillId: unknown, filePath: unknown) =>
    skillService.getFile(
      parseIpcInput(entityIdSchema, skillId),
      parseIpcInput(entityIdSchema, filePath),
    ),
  )
  ipcMain.handle("skills:create", () => skillService.create())
  ipcMain.handle("skills:save", (_event, value: unknown) =>
    skillService.save(parseIpcInput(versionedResourceSaveSchema, value)),
  )
  ipcMain.handle("skills:delete", (_event, value: unknown) => skillService.remove(parseIpcInput(entityIdSchema, value)))
}
