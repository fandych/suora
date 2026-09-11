import type { ChatMessageRecord, DocumentDetail, IntegrationDetail } from "@/data/domain/models"
import type { ChatRuntimeSettings } from "@/data/repositories/chat-settings-repository"
import type { IntegrationConfig } from "@/data/domain/models"
import type { IntegrationExecutionResult } from "@/data/repositories/integration-execution-repository"
import type { ChatAgentEvent } from "@/services/chat/types"
import type { WorkflowExecutionContext } from "@/data/repositories/workflow-execution-context"

export type WorkflowRuntimePorts = {
  getChatRuntimeSettings: () => Promise<ChatRuntimeSettings>
  streamChatAgentResponse: (history: ChatMessageRecord[], runtime: ChatRuntimeSettings, options: { selectedAgentId?: string }) => AsyncIterable<ChatAgentEvent>
  getDocumentDetail: (documentId: string) => Promise<DocumentDetail>
  getIntegrationDetail: (integrationId: string) => Promise<IntegrationDetail>
  executeIntegration: (config: IntegrationConfig, inputJson: string) => Promise<IntegrationExecutionResult>
  sendMail: (payload: { to: string; subject: string; content: string }) => Promise<{ success: boolean; error?: string }>
  serializeContext: (context: WorkflowExecutionContext) => string
}
