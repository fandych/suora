type SendMailPayload = { to: string; subject: string; content: string }
type BrowserState = { open: boolean; visible: boolean; url: string; loading?: boolean; error?: string }

export const ToolApi = {
  listFiles: (relativePath?: string) =>
    window.app!.tools.listFiles(relativePath) as Promise<
      Array<{ name: string; path: string; type: "file" | "directory" }>
    >,
  readFile: (relativePath: string) =>
    window.app!.tools.readFile(relativePath) as Promise<{ path: string; content: string }>,
  writeFile: (payload: { path: string; content: string }) =>
    window.app!.tools.writeFile(payload) as Promise<{ ok: boolean; path: string }>,
  runCommand: (payload: { command: string; cwd?: string; timeoutMs?: number }) =>
    window.app!.tools.runCommand(payload) as Promise<{
      ok: boolean
      exitCode: number | null
      stdout: string
      stderr: string
    }>,
  browserNavigate: (payload: { sessionId?: string; url?: string; visible?: boolean }) =>
    window.app!.tools.browserNavigate(payload),
  browserState: (sessionId?: string) => window.app!.tools.browserState(sessionId) as Promise<BrowserState>,
  browserPage: (payload: { sessionId?: string; includeText?: boolean; includeLinks?: boolean }) =>
    window.app!.tools.browserPage(payload),
  browserClick: (sessionId: string, selector: string) => window.app!.tools.browserClick({ sessionId, selector }),
  browserFill: (payload: { sessionId?: string; selector: string; value: string }) =>
    window.app!.tools.browserFill(payload),
  saveFile: (payload: {
    defaultName: string
    filters?: Array<{ name: string; extensions: string[] }>
    dataBase64: string
  }) => window.app!.tools.saveFile(payload) as Promise<{ ok: boolean; canceled: boolean; path: string | null }>,
  openExternal: (url: string) => window.app!.tools.openExternal(url) as Promise<{ ok: boolean; url: string }>,
  sendMail: (payload: SendMailPayload) =>
    window.app!.mail.send(payload) as Promise<{ success: boolean; error?: string }>,
}
