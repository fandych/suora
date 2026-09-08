import { registerWorkflowIpc } from "@electron/ipc/workflow/workflow-ipc"
import { registerIntegrationIpc } from "@electron/ipc/integration/integration-ipc"
import { registerSchedulerIpc } from "@electron/ipc/scheduler/scheduler-ipc"
import { registerPreferenceIpc } from "@electron/ipc/preference/preference-ipc"
import { registerChatIpc } from "@electron/ipc/chat/chat-ipc"
import { registerDocumentIpc } from "@electron/ipc/document/document-ipc"
import { registerAgentIpc } from "@electron/ipc/agent/agent-ipc"
import { registerSkillIpc } from "@electron/ipc/skill/skill-ipc"
import { registerModelIpc } from "@electron/ipc/model/model-ipc"
import { registerSystemIpc } from "@electron/ipc/system/system-ipc"
import { registerWorkspaceIpc } from "@electron/ipc/workspace/workspace-ipc"
import { registerDatabaseIpc } from "@electron/ipc/database/database-ipc"
import { registerAiIpc } from "@electron/ipc/ai/ai-ipc"
import { registerUpdaterIpc } from "@electron/ipc/updater/updater-ipc"
import { registerMailIpc } from "@electron/ipc/mail/mail-ipc"
import { registerChannelIpc } from "@electron/ipc/channel/channel-ipc"
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
