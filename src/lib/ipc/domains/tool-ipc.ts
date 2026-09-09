import { buildCommandEnvironment, markWorkspaceCommandConfirmed, shouldConfirmWorkspaceCommand, type ToolPreferenceSettings } from "@/lib/security/command-guardrail"
import { getProjectBridge } from "@/lib/ipc/bridge"
import { parseObjectJson } from "@/lib/serialization/json"

async function readToolPreferenceSettings(bridge: ReturnType<typeof getProjectBridge>): Promise<ToolPreferenceSettings> {
  try {
    const raw = await bridge.preferences.get() as string | null
    if (raw) return parseObjectJson<ToolPreferenceSettings>(raw, {})
  } catch {
    // Fall through to renderer-local settings.
  }
  if (typeof window === "undefined") return {}
  try { return parseObjectJson<ToolPreferenceSettings>(window.localStorage.getItem("suora:preference-settings"), {}) } catch { return {} }
}

export const toolIpc = {
  listFiles: async (relativePath?: string) => getProjectBridge().tools.listFiles(relativePath) as Promise<Array<{ name: string; path: string; type: "file" | "directory" }>>,
  readFile: async (relativePath: string) => getProjectBridge().tools.readFile(relativePath) as Promise<{ path: string; content: string }>,
  writeFile: async (payload: { path: string; content: string }) => getProjectBridge().tools.writeFile(payload) as Promise<{ ok: boolean; path: string }>,
  runCommand: async (payload: { command: string; cwd?: string; timeoutMs?: number }) => {
    const bridge = getProjectBridge()
    const preferences = await readToolPreferenceSettings(bridge)
    const mode = preferences.commandConfirmationMode === "never" || preferences.commandConfirmationMode === "always" ? preferences.commandConfirmationMode : "daily"
    if (shouldConfirmWorkspaceCommand(mode) && typeof window !== "undefined" && typeof window.confirm === "function") {
      const confirmed = window.confirm(["SUORA command guardrail", "", `Command: ${payload.command}`, payload.cwd ? `Directory: ${payload.cwd}` : "Directory: workspace root", "", "Continue execution?"].join("\n"))
      if (!confirmed) return { ok: false, exitCode: null, stdout: "", stderr: "Command cancelled by preference guardrail." }
      markWorkspaceCommandConfirmed(mode)
    }
    return bridge.tools.runCommand({ ...payload, env: buildCommandEnvironment(preferences) }) as Promise<{ ok: boolean; exitCode: number | null; stdout: string; stderr: string }>
  },
  browserNavigate: async (payload: { sessionId?: string; url?: string; visible?: boolean }) => getProjectBridge().tools.browserNavigate(payload) as Promise<{ ok: boolean; url: string; visible: boolean; loading?: boolean; error?: string }>,
  browserState: async (sessionId?: string) => getProjectBridge().tools.browserState(sessionId) as Promise<{ open: boolean; visible: boolean; url: string; loading?: boolean; error?: string }>,
  browserPage: async (payload: { sessionId?: string; includeText?: boolean; includeLinks?: boolean }) => getProjectBridge().tools.browserPage(payload),
  browserClick: async (sessionId: string, selector: string) => getProjectBridge().tools.browserClick({ sessionId, selector }),
  browserFill: async (payload: { sessionId?: string; selector: string; value: string }) => getProjectBridge().tools.browserFill(payload),
  saveFile: async (payload: { defaultName: string; filters?: Array<{ name: string; extensions: string[] }>; dataBase64: string }) => getProjectBridge().tools.saveFile(payload) as Promise<{ ok: boolean; canceled: boolean; path: string | null }>,
  openExternal: async (url: string) => getProjectBridge().tools.openExternal(url) as Promise<{ ok: boolean; url: string }>,
}
