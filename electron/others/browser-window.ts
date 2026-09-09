import { BrowserWindow } from "electron"

import { appState, setBrowserWindow } from "@electron/others/app-state"
import { assertSafeHttpUrl } from "@electron/others/url-security"
import type { BrowserPageSnapshot, BrowserWindowState } from "@electron/types"

const MAX_PAGE_TEXT = 50_000
const MAX_LINKS = 200

function getPageSnapshot(browserWindow: BrowserWindow, sessionId: string, error?: string): BrowserPageSnapshot {
  return {
    ...getBrowserWindowState(sessionId, error),
    title: browserWindow.isDestroyed() ? "" : browserWindow.getTitle(),
  }
}

function publishBrowserWindowState(sessionId = "global", error?: string) {
  if (!appState.mainWindow || appState.mainWindow.isDestroyed() || appState.mainWindow.webContents.isDestroyed()) {
    return
  }
  appState.mainWindow.webContents.send("tools:browserStateChanged", { sessionId, ...getBrowserWindowState(sessionId, error) })
}

function createBrowserWindow(sessionId: string) {
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
  const publishNavigationState = () => publishBrowserWindowState(sessionId)
  browserWindow.webContents.on("did-start-loading", publishNavigationState)
  browserWindow.webContents.on("did-finish-load", publishNavigationState)
  browserWindow.webContents.on("did-navigate", publishNavigationState)
  browserWindow.webContents.on("did-navigate-in-page", publishNavigationState)
  browserWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    publishBrowserWindowState(sessionId, `${errorDescription} (${errorCode})`)
  })
  browserWindow.webContents.on("will-redirect", (event, url) => {
    event.preventDefault()
    void assertSafeHttpUrl(url).then((safeUrl) => browserWindow.loadURL(safeUrl.toString())).catch((error) => {
      publishBrowserWindowState(sessionId, error instanceof Error ? error.message : String(error))
    })
  })
  browserWindow.on("closed", () => {
    if (appState.browserWindows.get(sessionId) === browserWindow) {
      appState.browserWindows.delete(sessionId)
      setBrowserWindow(null)
      publishBrowserWindowState(sessionId)
    }
  })

  appState.browserWindows.set(sessionId, browserWindow)
  setBrowserWindow(browserWindow)
  return browserWindow
}

function getBrowserWindow(sessionId: string) {
  const current = appState.browserWindows.get(sessionId)
  if (current && !current.isDestroyed()) {
    return current
  }

  return createBrowserWindow(sessionId)
}

export function closeBrowserWindow() {
  for (const browserWindow of appState.browserWindows.values()) {
    if (!browserWindow.isDestroyed()) {
      browserWindow.destroy()
    }
  }
  appState.browserWindows.clear()
  setBrowserWindow(null)
  publishBrowserWindowState()
}

export async function navigateBrowserWindow(payload: { sessionId?: string; url?: string; visible?: boolean }) {
  const sessionId = payload.sessionId || "global"
  const browserWindow = getBrowserWindow(sessionId)

  if (payload.visible === false) {
    browserWindow.hide()
  }

  if (payload.url) {
    const url = await assertSafeHttpUrl(payload.url)
    await browserWindow.loadURL(url.toString())
  }

  if (payload.visible === true) {
    browserWindow.show()
    browserWindow.focus()
  }

  publishBrowserWindowState(sessionId)

  return {
    ok: true,
    url: browserWindow.webContents.getURL(),
    visible: browserWindow.isVisible(),
  }
}

export function getBrowserWindowState(sessionId = "global", error?: string): BrowserWindowState {
  const browserWindow = appState.browserWindows.get(sessionId)
  if (!browserWindow || browserWindow.isDestroyed()) {
    return {
      open: false,
      visible: false,
      url: "",
      error,
    }
  }

  return {
    open: true,
    visible: browserWindow.isVisible(),
    url: browserWindow.webContents.getURL(),
    loading: browserWindow.webContents.isLoading(),
    error,
  }
}

export async function getBrowserPageSnapshot(options: { sessionId?: string; includeText?: boolean; includeLinks?: boolean } = {}) {
  const sessionId = options.sessionId || "global"
  const browserWindow = appState.browserWindows.get(sessionId)
  if (!browserWindow || browserWindow.isDestroyed()) {
    return { ...getBrowserWindowState(sessionId), title: "" }
  }

  const snapshot = getPageSnapshot(browserWindow, sessionId)
  if (!browserWindow.webContents.getURL()) {
    return snapshot
  }

  const result = await browserWindow.webContents.executeJavaScript(`(() => {
    const text = document.body?.innerText || ""
    const links = Array.from(document.querySelectorAll("a[href]"), (node) => ({
      text: (node.textContent || "").trim().slice(0, 300),
      href: node.href,
    }))
    return { text, links }
  })()`, true) as { text?: string; links?: Array<{ text?: string; href?: string }> }

  return {
    ...snapshot,
    ...(options.includeText ? { text: (result.text ?? "").slice(0, MAX_PAGE_TEXT) } : {}),
    ...(options.includeLinks ? { links: (result.links ?? []).slice(0, MAX_LINKS).map((link) => ({ text: link.text ?? "", href: link.href ?? "" })) } : {}),
  }
}

function serializeBrowserArgument(value: string) {
  return JSON.stringify(value)
}

export async function clickBrowserElement(selector: string, sessionId = "global") {
  const browserWindow = appState.browserWindows.get(sessionId)
  if (!browserWindow || browserWindow.isDestroyed()) {
    throw new Error("Browser window is not open.")
  }
  const result = await browserWindow.webContents.executeJavaScript(`(() => {
    const element = document.querySelector(${serializeBrowserArgument(selector)})
    if (!element) return { ok: false, error: "Element was not found." }
    element.scrollIntoView({ block: "center", inline: "center" })
    element.click()
    return { ok: true, tagName: element.tagName }
  })()`, true) as { ok: boolean; error?: string; tagName?: string }
  if (!result.ok) throw new Error(result.error ?? "Unable to click browser element.")
  publishBrowserWindowState()
  return { ...getPageSnapshot(browserWindow, sessionId), clicked: result.tagName ?? "element" }
}

export async function fillBrowserElement(selector: string, value: string, sessionId = "global") {
  const browserWindow = appState.browserWindows.get(sessionId)
  if (!browserWindow || browserWindow.isDestroyed()) {
    throw new Error("Browser window is not open.")
  }
  const result = await browserWindow.webContents.executeJavaScript(`(() => {
    const element = document.querySelector(${serializeBrowserArgument(selector)})
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) return { ok: false, error: "Element is not a form field." }
    element.focus()
    element.value = ${serializeBrowserArgument(value)}
    element.dispatchEvent(new Event("input", { bubbles: true }))
    element.dispatchEvent(new Event("change", { bubbles: true }))
    return { ok: true, tagName: element.tagName }
  })()`, true) as { ok: boolean; error?: string; tagName?: string }
  if (!result.ok) throw new Error(result.error ?? "Unable to fill browser element.")
  return { ...getPageSnapshot(browserWindow, sessionId), filled: result.tagName ?? "field" }
}
