export function hasAppBridge() {
  return typeof window !== "undefined" && Boolean(window.app)
}

export function requireAppBridge() {
  if (!hasAppBridge()) {
    throw new Error("The Electron app bridge is unavailable in this environment.")
  }

  return window.app as NonNullable<Window["app"]>
}
