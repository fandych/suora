import { registerWorkflowIpc } from "@electron/ipc/domain/workflow-ipc"
import { registerIntegrationIpc } from "@electron/ipc/domain/integration-ipc"
import { registerSchedulerIpc } from "@electron/ipc/domain/scheduler-ipc"
import { registerPreferenceIpc } from "@electron/ipc/system/preference-ipc"
import { registerChatIpc } from "@electron/ipc/domain/chat-ipc"
import { registerDocumentIpc } from "@electron/ipc/domain/document-ipc"
import { registerAgentIpc } from "@electron/ipc/domain/agent-ipc"
import { registerSkillIpc } from "@electron/ipc/domain/skill-ipc"
import { registerModelIpc } from "@electron/ipc/domain/model-ipc"
import { registerSystemIpc } from "@electron/ipc/system/system-ipc"
import { registerWorkspaceIpc } from "@electron/ipc/system/workspace-ipc"
import { registerDatabaseIpc } from "@electron/ipc/system/database-ipc"
import { registerAiIpc } from "@electron/ipc/system/ai-ipc"
import { registerUpdaterIpc } from "@electron/ipc/system/updater-ipc"
import { registerMailIpc } from "@electron/ipc/system/mail-ipc"
import { registerChannelIpc } from "@electron/ipc/domain/channel-ipc"
import { registerToolFilesystemIpc } from "@electron/ipc/tools/tools-filesystem-ipc"
import { registerToolBrowserIpc } from "@electron/ipc/tools/tools-browser-ipc"
import { registerToolCommandIpc } from "@electron/ipc/tools/tools-command-ipc"
import { registerToolExternalIpc } from "@electron/ipc/tools/tools-external-ipc"

export function setupIpc() {
  registerSystemIpc()
  registerWorkspaceIpc()
  registerDatabaseIpc()
  registerAiIpc()
  registerUpdaterIpc()
  registerMailIpc()
  registerChatIpc()
  registerDocumentIpc()
  registerAgentIpc()
  registerSkillIpc()
  registerModelIpc()
  registerChannelIpc()
  registerToolFilesystemIpc()
  registerToolBrowserIpc()
  registerToolCommandIpc()
  registerToolExternalIpc()
  registerWorkflowIpc()
  registerIntegrationIpc()
  registerSchedulerIpc()
  registerPreferenceIpc()
}
