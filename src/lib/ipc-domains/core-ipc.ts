import { getSuoraBridge } from "@/lib/ipc-utils"

const bridge = () => getSuoraBridge()

export const systemIpc = {
  info: async () => bridge().system.info(),
  diagnostics: async () => bridge().system.diagnostics(),
}

export const workspaceIpc = {
  getPaths: async () => bridge().workspace.getPaths(),
  setProxySettings: async (settings: unknown) => bridge().workspace.setProxySettings(settings),
  getProxySettings: async () => bridge().workspace.getProxySettings(),
}

export const preferencesIpc = {
  get: async () => bridge().preferences.get() as Promise<string | null>,
  save: async (value: string) => bridge().preferences.save(value) as Promise<string>,
}

export const updaterIpc = {
  getState: async () => bridge().updater.getState(),
  check: async () => bridge().updater.check(),
}

type SendMailPayload = {
  to: string
  subject: string
  content: string
}

export const mailIpc = {
  send: async (payload: SendMailPayload) => bridge().mail.send(payload) as Promise<{ success: boolean; error?: string }>,
}
