import { describe, expect, it, vi } from "vitest"

const registerChatIpc = vi.hoisted(() => vi.fn())

vi.mock("@/electron/preload/chats/chat-ipc", () => ({ registerChatIpc }))
vi.mock("@/electron/preload/agents/agent-ipc", () => ({ registerAgentIpc: vi.fn() }))
vi.mock("@/electron/preload/documents/document-ipc", () => ({ registerDocumentIpc: vi.fn() }))
vi.mock("@/electron/preload/channels/channel-ipc", () => ({ registerChannelIpc: vi.fn() }))
vi.mock("@/electron/preload/channels/domain-channel-catalog-ipc", () => ({
  registerDomainChannelCatalogIpc: vi.fn(),
}))
vi.mock("@/electron/preload/models/model-ipc", () => ({ registerModelIpc: vi.fn() }))
vi.mock("@/electron/preload/preferences/preference-ipc", () => ({ registerPreferenceIpc: vi.fn() }))
vi.mock("@/electron/preload/schedulers/scheduler-ipc", () => ({ registerSchedulerIpc: vi.fn() }))
vi.mock("@/electron/preload/skills/skill-ipc", () => ({ registerSkillIpc: vi.fn() }))
vi.mock("@/electron/preload/integrations/integration-ipc", () => ({ registerIntegrationIpc: vi.fn() }))
vi.mock("@/electron/preload/workflows/workflow-ipc", () => ({ registerWorkflowIpc: vi.fn() }))
vi.mock("@/electron/preload/workflows/workflow-runtime-ipc", () => ({ registerWorkflowRuntimeIpc: vi.fn() }))
vi.mock("@/electron/preload/system/system-ipc", () => ({ registerSystemIpc: vi.fn() }))
vi.mock("@/electron/preload/system/workspace-ipc", () => ({ registerWorkspaceIpc: vi.fn() }))
vi.mock("@/electron/preload/system/database-ipc", () => ({ registerDatabaseIpc: vi.fn() }))
vi.mock("@/electron/preload/system/ai-ipc", () => ({ registerAiIpc: vi.fn() }))
vi.mock("@/electron/preload/system/updater-ipc", () => ({ registerUpdaterIpc: vi.fn() }))
vi.mock("@/electron/preload/system/mail-ipc", () => ({ registerMailIpc: vi.fn() }))
vi.mock("@/electron/preload/tools/browser-ipc", () => ({ registerBrowserIpc: vi.fn() }))
vi.mock("@/electron/preload/tools/filesystem-ipc", () => ({ registerFilesystemIpc: vi.fn() }))
vi.mock("@/electron/preload/tools/command-ipc", () => ({ registerCommandIpc: vi.fn() }))
vi.mock("@/electron/preload/tools/external-ipc", () => ({ registerExternalIpc: vi.fn() }))

import { setupIpc as setupPreloadIpc } from "@/electron/preload/index"

describe("preload IPC entrypoint", () => {
  it("registers chat handlers from the preload IPC entrypoint", () => {
    setupPreloadIpc()

    expect(registerChatIpc).toHaveBeenCalledOnce()
  })
})
