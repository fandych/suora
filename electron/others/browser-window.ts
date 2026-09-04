import { BrowserWindow } from "electron"

import { appState, setBrowserWindow } from "@electron/others/app-state"

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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

export async function captureBrowserPagePreview(payload: { url: string; width?: number; height?: number; waitMs?: number }) {
  const browserWindow = new BrowserWindow({
    width: payload.width ?? 960,
    height: payload.height ?? 960,
    show: false,
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  try {
    await browserWindow.loadURL(payload.url)
    await browserWindow.webContents.executeJavaScript(`new Promise((resolve) => {
      if (document.readyState === "complete") {
        resolve(true)
        return
      }

      window.addEventListener("load", () => resolve(true), { once: true })
    })`, true).catch(() => undefined)

    if ((payload.waitMs ?? 0) > 0) {
      await wait(payload.waitMs ?? 0)
    }

    const image = await browserWindow.webContents.capturePage()
    return {
      ok: true,
      image: image.toPNG().toString("base64"),
      format: "png",
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    if (!browserWindow.isDestroyed()) {
      browserWindow.destroy()
    }
  }
}