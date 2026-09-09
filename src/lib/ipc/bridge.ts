export function getProjectBridge() {
  const bridge = window.project
  if (!bridge) {
    throw new Error("Project IPC bridge is not available.")
  }
  return bridge
}

export function hasProjectBridge() {
  return typeof window !== "undefined" && Boolean(window.project)
}
