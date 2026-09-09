import type { SkillFileRecord, SkillSummary } from "@/data/domain/skill-document-models"
import type { VersionOption } from "@/data/domain/version-models"

export type ProviderModelCapability = "toolcalling" | "vision" | "embedding" | "structuredOutput"
export type ProviderApiMode = "messages" | "responses" | "completions"
export type ProviderModelRecord = { id: string; name: string; enabled: boolean; capabilities?: ProviderModelCapability[]; apiModes?: ProviderApiMode[]; contextWindow?: number; maxOutputTokens?: number; supportsParallelToolCalls?: boolean; supportsReasoning?: boolean }
export type ProviderConfigRecord = { id: string; title: string; providerType: string; baseUrl: string; apiKey: string; enabled: boolean; models: ProviderModelRecord[]; updatedAt: number }
export type ProviderPreset = { providerType: string; title: string; description: string; baseUrl: string; docsUrl?: string; models: ProviderModelRecord[] }
export type SkillConfigRecord = { skill: SkillSummary; versions: VersionOption[]; latestVersion: VersionOption; selectedVersion: VersionOption; files: SkillFileRecord[] }
export type AgentConfigRecord = { instructions: string; providerId: string; modelId: string; maxSteps?: number; workflowIds?: string[]; skillIds: string[]; toolsetIds: string[]; documentIds?: string[]; privateToolIds?: string[] }
export type AgentSummary = { id: string; title: string; kind: string; summary: string; updatedAt: number; isDisabled?: boolean; source?: "custom" | "system" }
export type AgentDetail = { agent: AgentSummary; versions: VersionOption[]; latestVersion: VersionOption; selectedVersion: VersionOption; config: AgentConfigRecord }
