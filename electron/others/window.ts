import path from "node:path"

import { BrowserWindow, nativeImage } from "electron"

import { appState, setMainWindow } from "@electron/others/app-state"

export async function createWindow() {
  const icon = nativeImage.createFromPath(path.join(process.cwd(), "resources", "icons", "icon-256x256.png"))

  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    title: "SUORA",
    icon,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  setMainWindow(mainWindow)

  if (appState.isDev) {
    const rendererUrl = process.env.ELECTRON_RENDERER_URL
    if (!rendererUrl) {
      throw new Error("ELECTRON_RENDERER_URL is not available in development mode.")
    }
    await mainWindow.loadURL(rendererUrl)
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"))
  }

  return mainWindow
}
