import type { ChatMessageRecord } from "@/data/domain/chat-models"
import type { DocumentDetail } from "@/data/domain/skill-document-models"
import type { IntegrationConfig, IntegrationDetail } from "@/data/domain/integration-models"
import type { ChatRuntimeSettings } from "@/data/domain/chat-runtime-models"
import type { IntegrationExecutionResult } from "@/data/domain/integration-runtime-models"
import type { WorkflowExecutionContext } from "@/data/domain/workflow-runtime-context"

export type WorkflowChatAgentEvent = { type: "text-delta" | "error" | string; text?: string; error?: string; [key: string]: unknown }

export type WorkflowRuntimePorts = {
  getChatRuntimeSettings: () => Promise<ChatRuntimeSettings>
  streamChatAgentResponse: (history: ChatMessageRecord[], runtime: ChatRuntimeSettings, options: { selectedAgentId?: string }) => AsyncIterable<WorkflowChatAgentEvent>
  getDocumentDetail: (documentId: string) => Promise<DocumentDetail>
  getIntegrationDetail: (integrationId: string) => Promise<IntegrationDetail>
  executeIntegration: (config: IntegrationConfig, inputJson: string) => Promise<IntegrationExecutionResult>
  sendMail: (payload: { to: string; subject: string; content: string }) => Promise<{ success: boolean; error?: string }>
  serializeContext: (context: WorkflowExecutionContext) => string
}