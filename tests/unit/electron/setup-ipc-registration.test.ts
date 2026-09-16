import { beforeEach, describe, expect, it, vi } from "vitest"

const handlers = new Map<string, unknown>()

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn((channel: string, handler: unknown) => handlers.set(channel, handler)) },
  app: { isPackaged: false },
}))

const registrationModules = [
  "@/electron/preload/workflows/workflow-ipc",
  "@/electron/preload/workflows/workflow-runtime-ipc",
  "@/electron/preload/integrations/integration-ipc",
  "@/electron/preload/schedulers/scheduler-ipc",
  "@/electron/preload/preferences/preference-ipc",
  "@/electron/preload/channels/domain-channel-catalog-ipc",
  "@/electron/preload/chats/chat-ipc",
  "@/electron/preload/documents/document-ipc",
  "@/electron/preload/agents/agent-ipc",
  "@/electron/preload/skills/skill-ipc",
  "@/electron/preload/models/model-ipc",
  "@/electron/preload/system/database-ipc",
  "@/electron/preload/system/mail-ipc",
]

vi.mock("@/electron/infrastructure/db-core", () => ({ applyMigrations: vi.fn(), openDatabase: vi.fn() }))
vi.mock("@/electron/infrastructure/workspace-service", () => ({ ensureWorkspace: vi.fn() }))
vi.mock("@/electron/app/preferences/runtime", () => ({ getPreferenceSettingsSnapshot: vi.fn() }))
vi.mock("@/electron/infrastructure/credential-vault", () => ({
  protectCredential: (value: string) => value,
  revealCredential: (value: unknown) => value,
}))
vi.mock("@/electron/app/integrations/executor", () => ({ executeIntegration: vi.fn() }))
vi.mock("@/electron/app/models/discovery", () => ({ discoverProviderModels: vi.fn() }))
vi.mock("@/electron/app/workflows/definition", () => ({
  createDefaultWorkflowDefinition: vi.fn(() => ({ nodes: [], edges: [] })),
  validateWorkflowDefinitionJson: vi.fn(),
}))

const namesByModule = [
  ["workflows:list", "workflows:get", "workflows:recordInvocation"],
  ["integration:execute", "integrations:list", "integrations:get"],
  ["schedulers:list", "schedulers:get", "schedulers:save"],
  ["preferences:get", "preferences:save"],
  ["database:ping"],
  ["chats:list", "chats:get"],
  ["documents:list", "documents:get"],
  ["agents:list", "agents:get"],
  ["skills:list", "skills:get"],
  ["models:list", "models:get"],
  ["mail:send"],
]

describe("IPC registration contract", () => {
  beforeEach(() => handlers.clear())

  it("registers representative handlers for every core domain", async () => {
    for (const moduleName of registrationModules) {
      const module = await import(moduleName)
      const register = Object.values(module).find(
        (value) => typeof value === "function" && String(value).startsWith("function register"),
      ) as (() => void) | undefined
      register?.()
    }

    for (const expectedNames of namesByModule) {
      expect(expectedNames.some((name) => handlers.has(name))).toBe(true)
    }
  }, 15_000)
})
