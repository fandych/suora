import { BrowserWindow } from "electron"

import { appState, setBrowserWindow } from "@electron/others/app-state"

function createBrowserWindow() {
  const browserWindow = new BrowserWindow({
    width: 1280,
    height: 880,
    minWidth: 960,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    title: "SUORA Browser",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  browserWindow.setMenuBarVisibility(false)
  browserWindow.setAutoHideMenuBar(true)
  browserWindow.on("closed", () => {
    if (appState.browserWindow === browserWindow) {
      setBrowserWindow(null)
    }
  })

  setBrowserWindow(browserWindow)
  return browserWindow
}

function getBrowserWindow() {
  const current = appState.browserWindow
  if (current && !current.isDestroyed()) {
    return current
  }

  return createBrowserWindow()
}

export async function navigateBrowserWindow(payload: { url?: string; visible?: boolean }) {
  const browserWindow = getBrowserWindow()

  if (payload.url) {
    await browserWindow.loadURL(payload.url)
  }

  if (payload.visible === false) {
    browserWindow.hide()
  } else {
    browserWindow.show()
    browserWindow.focus()
  }

  return {
    ok: true,
    url: browserWindow.webContents.getURL(),
    visible: browserWindow.isVisible(),
  }
}