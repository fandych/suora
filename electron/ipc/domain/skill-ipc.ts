import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { ipcMain } from "electron"
import { createSkillWithDrizzle, deleteSkillWithDrizzle, getSkillWithDrizzle, listSkillsWithDrizzle, saveSkillWithDrizzle } from "@electron/database/drizzle/skill-scheduler-repository"
import { entityIdSchema, parseIpcInput, versionedResourceSaveSchema } from "@electron/ipc/system/ipc-input-schemas"

export function registerSkillIpc() {
  ipcMain.handle("skills:list", () => listSkillsWithDrizzle())
  ipcMain.handle("skills:listExternal", async () => { const results: Array<{ id: string; title: string; source: string; summary: string }> = []; for (const source of ["codex", "claude", "agents"]) { const directory = path.join(os.homedir(), `.${source}`, "skills"); try { for (const entry of await fs.readdir(directory, { withFileTypes: true })) if (entry.isDirectory()) results.push({ id: `${source}:${entry.name}`, title: entry.name, source, summary: path.join(directory, entry.name) }) } catch { /* optional */ } } return results })
  ipcMain.handle("skills:get", (_event, value: unknown) => getSkillWithDrizzle(parseIpcInput(entityIdSchema, value)))
  ipcMain.handle("skills:create", () => createSkillWithDrizzle())
  ipcMain.handle("skills:save", (_event, value: unknown) => saveSkillWithDrizzle(parseIpcInput(versionedResourceSaveSchema, value)))
  ipcMain.handle("skills:delete", (_event, value: unknown) => deleteSkillWithDrizzle(parseIpcInput(entityIdSchema, value)))
}
