import fs from "node:fs/promises"
import path from "node:path"

import { app } from "electron"

import { getWorkspacePath } from "@/electron/infrastructure/workspace-paths"

export async function ensureWorkspace() {
  await fs.mkdir(getWorkspacePath(), { recursive: true })
}

export function configureAppStoragePaths() {
  const customUserDataPath = process.env.SUORA_USER_DATA_PATH?.trim()
  if (customUserDataPath) {
    app.setPath("userData", path.resolve(customUserDataPath))
  }

  if (!app.isPackaged) {
    app.commandLine.appendSwitch("disable-http-cache")
    if (process.env.SUORA_REMOTE_DEBUG_PORT) {
      app.commandLine.appendSwitch("remote-debugging-port", process.env.SUORA_REMOTE_DEBUG_PORT)
      app.commandLine.appendSwitch("remote-allow-origins", "*")
    }
  }
  app.commandLine.appendSwitch("disable-gpu-shader-disk-cache")
}
