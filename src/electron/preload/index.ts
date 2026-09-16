import { registerAgentIpc } from "@/electron/preload/agents/agent-ipc"
import { registerDocumentIpc } from "@/electron/preload/documents/document-ipc"
import { registerChannelIpc } from "@/electron/preload/channels/channel-ipc"
import { registerDomainChannelCatalogIpc } from "@/electron/preload/channels/domain-channel-catalog-ipc"
import { registerModelIpc } from "@/electron/preload/models/model-ipc"
import { registerPreferenceIpc } from "@/electron/preload/preferences/preference-ipc"
import { registerSchedulerIpc } from "@/electron/preload/schedulers/scheduler-ipc"
import { registerSkillIpc } from "@/electron/preload/skills/skill-ipc"
import { registerIntegrationIpc } from "@/electron/preload/integrations/integration-ipc"
import { registerWorkflowIpc } from "@/electron/preload/workflows/workflow-ipc"
import { registerWorkflowRuntimeIpc } from "@/electron/preload/workflows/workflow-runtime-ipc"
import { registerChatIpc } from "@/electron/preload/chats/chat-ipc"
import { registerSystemIpc } from "@/electron/preload/system/system-ipc"
import { registerWorkspaceIpc } from "@/electron/preload/system/workspace-ipc"
import { registerDatabaseIpc } from "@/electron/preload/system/database-ipc"
import { registerAiIpc } from "@/electron/preload/system/ai-ipc"
import { registerUpdaterIpc } from "@/electron/preload/system/updater-ipc"
import { registerMailIpc } from "@/electron/preload/system/mail-ipc"
import { registerBrowserIpc } from "@/electron/preload/tools/browser-ipc"
import { registerFilesystemIpc } from "@/electron/preload/tools/filesystem-ipc"
import { registerCommandIpc } from "@/electron/preload/tools/command-ipc"
import { registerExternalIpc } from "@/electron/preload/tools/external-ipc"

export function setupIpc() {
  registerSystemIpc()
  registerWorkspaceIpc()
  registerDatabaseIpc()
  registerAiIpc()
  registerUpdaterIpc()
  registerMailIpc()
  registerBrowserIpc()
  registerFilesystemIpc()
  registerCommandIpc()
  registerExternalIpc()
  registerAgentIpc()
  registerDocumentIpc()
  registerChannelIpc()
  registerDomainChannelCatalogIpc()
  registerModelIpc()
  registerPreferenceIpc()
  registerSchedulerIpc()
  registerSkillIpc()
  registerIntegrationIpc()
  registerWorkflowIpc()
  registerWorkflowRuntimeIpc()
  registerChatIpc()
}
