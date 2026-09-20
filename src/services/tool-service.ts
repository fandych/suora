import { requireAppBridge } from "@/services/bridge"

type SendMailPayload = { to: string; subject: string; content: string }
type BrowserState = { open: boolean; visible: boolean; url: string; loading?: boolean; error?: string }

export const ToolApi = {
  listFiles: (relativePath?: string) =>
    requireAppBridge().tools.listFiles(relativePath) as Promise<
      Array<{ name: string; path: string; type: "file" | "directory" }>
    >,
  readFile: (relativePath: string) =>
    requireAppBridge().tools.readFile(relativePath) as Promise<{ path: string; content: string }>,
  writeFile: (payload: { path: string; content: string }) =>
    requireAppBridge().tools.writeFile(payload) as Promise<{ ok: boolean; path: string }>,
  runCommand: (payload: { command: string; cwd?: string; timeoutMs?: number }) =>
    requireAppBridge().tools.runCommand(payload) as Promise<{
      ok: boolean
      exitCode: number | null
      stdout: string
      stderr: string
    }>,
  browserNavigate: (payload: { sessionId?: string; url?: string; visible?: boolean }) =>
    requireAppBridge().tools.browserNavigate(payload),
  browserState: (sessionId?: string) => requireAppBridge().tools.browserState(sessionId) as Promise<BrowserState>,
  browserPage: (payload: { sessionId?: string; includeText?: boolean; includeLinks?: boolean }) =>
    requireAppBridge().tools.browserPage(payload),
  browserClick: (sessionId: string, selector: string) => requireAppBridge().tools.browserClick({ sessionId, selector }),
  browserFill: (payload: { sessionId?: string; selector: string; value: string }) =>
    requireAppBridge().tools.browserFill(payload),
  saveFile: (payload: {
    defaultName: string
    filters?: Array<{ name: string; extensions: string[] }>
    dataBase64: string
  }) => requireAppBridge().tools.saveFile(payload) as Promise<{ ok: boolean; canceled: boolean; path: string | null }>,
  openExternal: (url: string) => requireAppBridge().tools.openExternal(url) as Promise<{ ok: boolean; url: string }>,
  sendMail: (payload: SendMailPayload) =>
    requireAppBridge().mail.send(payload) as Promise<{ success: boolean; error?: string }>,
}
