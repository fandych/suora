import type { AgentPipeline, ChannelConfig, DocumentGroup, EmailConfig, PluginInfo } from '@/types'

export interface PipelineValidationWorkspaceState {
  emailConfig: EmailConfig
  channels: ChannelConfig[]
  installedPlugins: PluginInfo[]
  pluginTools: Record<string, string[]>
  documentGroups: DocumentGroup[]
  agentPipelines: AgentPipeline[]
}

const EMPTY_PIPELINE_VALIDATION_STATE: PipelineValidationWorkspaceState = {
  emailConfig: {
    smtpHost: '',
    smtpPort: 587,
    secure: false,
    username: '',
    password: '',
    fromName: '',
    fromAddress: '',
    enabled: false,
  },
  channels: [],
  installedPlugins: [],
  pluginTools: {},
  documentGroups: [],
  agentPipelines: [],
}

let livePipelineValidationStoreAccessor: (() => PipelineValidationWorkspaceState) | null = null

export function setPipelineValidationStoreAccessor(accessor: (() => PipelineValidationWorkspaceState) | null): void {
  livePipelineValidationStoreAccessor = accessor
}

export function readPipelineValidationStoreState(): PipelineValidationWorkspaceState {
  if (!livePipelineValidationStoreAccessor) return EMPTY_PIPELINE_VALIDATION_STATE
  try {
    return livePipelineValidationStoreAccessor()
  } catch {
    return EMPTY_PIPELINE_VALIDATION_STATE
  }
}