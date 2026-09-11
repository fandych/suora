import { beforeEach, describe, expect, it, vi } from "vitest"

const handlers = new Map<string, unknown>()

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn((channel: string, handler: unknown) => handlers.set(channel, handler)) },
  app: { isPackaged: false },
}))

const registrationModules = [
  "@electron/ipc/domain/workflow-ipc",
  "@electron/ipc/domain/integration-ipc",
  "@electron/ipc/domain/scheduler-ipc",
  "@electron/ipc/system/preference-ipc",
  "@electron/ipc/domain/catalog-ipc",
  "@electron/ipc/system/domain-channel-catalog-ipc",
  "@electron/ipc/domain/chat-ipc",
  "@electron/ipc/domain/document-ipc",
  "@electron/ipc/domain/agent-ipc",
  "@electron/ipc/domain/skill-ipc",
  "@electron/ipc/domain/model-ipc",
  "@electron/ipc/system/domain-database-ipc",
  "@electron/ipc/system/mail-ipc",
]

vi.mock("@electron/others/infrastructure/db-core", () => ({ applyMigrations: vi.fn(), openDatabase: vi.fn() }))
vi.mock("@electron/others/infrastructure/workspace-service", () => ({ ensureWorkspace: vi.fn() }))
vi.mock("@electron/others/infrastructure/preference-service", () => ({ getPreferenceSettingsSnapshot: vi.fn() }))
vi.mock("@electron/others/infrastructure/credential-vault", () => ({ protectCredential: (value: string) => value, revealCredential: (value: unknown) => value }))
vi.mock("@electron/others/integrations/integration-executor", () => ({ executeIntegration: vi.fn() }))
vi.mock("@electron/others/services/model-discovery", () => ({ discoverProviderModels: vi.fn() }))
vi.mock("@electron/others/services/workflow-definition", () => ({ createDefaultWorkflowDefinition: vi.fn(() => ({ nodes: [], edges: [] })), validateWorkflowDefinitionJson: vi.fn() }))

const namesByModule = [
  ["workflows:list", "workflows:get", "workflows:recordInvocation"],
  ["integration:execute", "integrations:list", "integrations:get"],
  ["schedulers:list", "schedulers:get", "schedulers:save"],
  ["preferences:get", "preferences:save"],
  ["catalog:list", "catalog:get"],
  ["database:ping", "database:ensureSeeded"],
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
      const register = Object.values(module).find((value) => typeof value === "function" && String(value).startsWith("function register")) as (() => void) | undefined
      register?.()
    }

    for (const expectedNames of namesByModule) {
      expect(expectedNames.some((name) => handlers.has(name))).toBe(true)
    }
  })
})
