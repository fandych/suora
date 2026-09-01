import fs from "node:fs/promises"

import { app } from "electron"

import { getWorkspacePath } from "@electron/others/paths"

export async function ensureWorkspace() {
  await fs.mkdir(getWorkspacePath(), { recursive: true })
}

export function configureAppStoragePaths() {
  app.commandLine.appendSwitch("disable-gpu-shader-disk-cache")
}
