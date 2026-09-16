import path from "node:path"

import { app } from "electron"

export function getWorkspacePath() {
  return path.join(app.getPath("userData"), "workspace")
}

export function getDatabasePath() {
  return path.join(getWorkspacePath(), "suora.sqlite")
}
