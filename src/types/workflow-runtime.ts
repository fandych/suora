import type { WorkflowNodeData, WorkflowRunMode, WorkflowExecutionContext } from "@/types/workflow"
import type { ChatRuntimeSettings } from "@/types/chat"
import type { IntegrationConfig, IntegrationExecutionResult } from "@/types/integration"

export type WorkflowExecutionMode = WorkflowRunMode
export type { WorkflowExecutionContext } from "@/types/workflow"
export type WorkflowNode = { id: string; type?: string; data: WorkflowNodeData }
export type WorkflowNodeExecutor = (
  node: WorkflowNode,
  context: WorkflowExecutionContext,
  mode: WorkflowExecutionMode,
) => Promise<unknown>

export type WorkflowExecutionRuntime = {
  getChatRuntimeSettings: () => Promise<ChatRuntimeSettings>
  executeAgent: (input: {
    prompt: string
    systemPrompt?: string
    modelId?: string
    selectedAgentId?: string
  }) => Promise<unknown>
  getDocumentDetail: (documentId: string) => Promise<unknown>
  executeIntegration: (
    config: IntegrationConfig,
    inputJson: string,
    integrationId?: string,
  ) => Promise<IntegrationExecutionResult>
  sendMail: (payload: { to: string; subject: string; content: string }) => Promise<{ success: boolean; error?: string }>
}

export type WorkflowExecutionContextWithRuntime = WorkflowExecutionContext & {
  runtime: WorkflowExecutionRuntime
}
