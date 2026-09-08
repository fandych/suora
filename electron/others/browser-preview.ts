import { BrowserWindow } from "electron"

import { assertSafeHttpUrl } from "@electron/others/url-security"

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export async function captureBrowserPagePreview(payload: { url: string; width?: number; height?: number; waitMs?: number }) {
  const browserWindow = new BrowserWindow({
    width: payload.width ?? 960,
    height: payload.height ?? 960,
    show: false,
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })

  try {
    const url = await assertSafeHttpUrl(payload.url)
    await browserWindow.loadURL(url.toString())
    await browserWindow.webContents.executeJavaScript(`new Promise((resolve) => {
      if (document.readyState === "complete") { resolve(true); return }
      window.addEventListener("load", () => resolve(true), { once: true })
    })`, true).catch(() => undefined)
    if ((payload.waitMs ?? 0) > 0) await wait(payload.waitMs ?? 0)
    const image = await browserWindow.webContents.capturePage()
    return { ok: true, image: image.toPNG().toString("base64"), format: "png" }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  } finally {
    if (!browserWindow.isDestroyed()) browserWindow.destroy()
  }
}
