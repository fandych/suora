/**
 * Backward-compatible domain type barrel.
 * New code should import from the business-specific model file directly.
 */
export type { SidebarGroupData, SidebarItemData, SimpleCatalogItem } from "@/data/domain/navigation-models"
export type { ChatSummary, ChatMessageRecord, ChatDetail } from "@/data/domain/chat-models"
export type { VersionOption } from "@/data/domain/version-models"
export type { WorkflowNodeData, WorkflowInputParameter, WorkflowEdgeData, WorkflowVariable, WorkflowBudget, WorkflowNotificationSettings, WorkflowDefinition, WorkflowSummary, WorkflowInvocationRecord, WorkflowNodeTraceRecord, WorkflowTraceSnapshot, WorkflowDetail } from "@/data/domain/workflow-models"
export type { SkillFileRecord, SkillSummary, SkillDetail, DocumentPageRecord, DocumentGraphEdge, DocumentSettings, DocumentSummary, DocumentDetail } from "@/data/domain/skill-document-models"
export type { HttpIntegrationAuthType, HttpEndpointBodyMode, HttpEndpointParameterLocation, HttpEndpointParameter, HttpEndpointConfig, HttpIntegrationConfig, ScriptWorkbenchItem, ScriptIntegrationConfig, McpToolRecord, McpIntegrationConfig, IntegrationConfig, IntegrationSummary, IntegrationDetail, IntegrationExecutionRecord } from "@/data/domain/integration-models"
export type { ProviderModelCapability, ProviderApiMode, ProviderModelRecord, ProviderConfigRecord, ProviderPreset, SkillConfigRecord, AgentConfigRecord, AgentSummary, AgentDetail } from "@/data/domain/provider-agent-models"
export type { SchedulerTargetType, SchedulerMissedRunPolicy, SchedulerDetail, SchedulerRunRecord } from "@/data/domain/scheduler-models"
export type { ChannelPlatform, ChannelStatus, ChannelConnectionMode, WeChatPersonalBindingStatus, WeChatPersonalQrUiStatus, ChannelBindingState, EmailFilterField, EmailFilterOperator, EmailActionType, EmailFilterRule, EmailAction, ChannelMessageRecord, ChannelConversationEntry, ChannelUserRecord, ChannelHealthRecord, ChannelDebugEntry, ChannelConfigRecord, ChannelRuntimeState, ChannelSummary, ChannelDetail } from "@/data/domain/channel-models"
