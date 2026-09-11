import { getChatRuntimeSettings } from "@/data/repositories/chat-settings-repository"
import { getDocumentDetail } from "@/data/repositories/document-repository"
import { executeIntegration } from "@/data/repositories/integration-execution-repository"
import { getIntegrationDetail } from "@/data/repositories/integration-repository"
import { projectIpc } from "@/lib/ipc"
import { streamChatAgentResponse } from "@/services/ai-service"
import type { WorkflowRuntimePorts } from "@/data/domain/workflow-runtime-ports"

export const rendererWorkflowRuntimeAdapter: WorkflowRuntimePorts = {
  getChatRuntimeSettings,
  streamChatAgentResponse,
  getDocumentDetail,
  getIntegrationDetail,
  executeIntegration,
  sendMail: (payload) => projectIpc.mail.send(payload),
  serializeContext: (context) => JSON.stringify(context),
}
