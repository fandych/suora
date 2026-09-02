import { app } from "electron"
import type { AppState } from "@electron/types"

export const appState: AppState = {
  isDev: !app.isPackaged,
  mainWindow: null,
  browserWindow: null,
  sqlite: null,
  activeAiRequests: new Map(),
  currentProxySettings: {
    enabled: false,
    type: "http",
    host: "",
    port: 0,
  },
}

export function setMainWindow(mainWindow: AppState["mainWindow"]) {
  appState.mainWindow = mainWindow
}

export function setBrowserWindow(browserWindow: AppState["browserWindow"]) {
  appState.browserWindow = browserWindow
}
