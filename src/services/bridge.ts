export function hasAppBridge() {
  return typeof window !== "undefined" && Boolean(window.app)
}
