import type { AgentPipelineStep } from '@/types'

export type PipelineNodeType = NonNullable<AgentPipelineStep['nodeType']>

export function getPipelineNodeType(step: Pick<AgentPipelineStep, 'nodeType'> | null | undefined): PipelineNodeType {
  return step?.nodeType ?? 'agent'
}

export function nodeTypeRequiresTask(nodeType: PipelineNodeType): boolean {
  return nodeType !== 'start' && nodeType !== 'end' && nodeType !== 'parallel' && nodeType !== 'join' && nodeType !== 'iteration'
}

export function nodeTypeSupportsAgentBinding(nodeType: PipelineNodeType): boolean {
  return nodeType === 'agent' || nodeType === 'condition'
}

export function nodeTypeSupportsRunIf(nodeType: PipelineNodeType): boolean {
  return nodeType !== 'start' && nodeType !== 'end'
}

export function nodeTypeUsesAgentRuntime(nodeType: PipelineNodeType): boolean {
  return nodeType === 'agent' || nodeType === 'condition'
}

export function nodeTypeIsStructural(nodeType: PipelineNodeType): boolean {
  return !nodeTypeRequiresTask(nodeType)
}

export function getMissingNodeRequirements(step: AgentPipelineStep): string[] {
  const nodeType = getPipelineNodeType(step)
  const missing: string[] = []

  if (nodeTypeRequiresTask(nodeType) && !step.task.trim()) missing.push('Task')
  if (nodeType === 'start' && (!step.startParams || step.startParams.length === 0)) missing.push('Params')
  if (nodeType === 'end' && (!step.endOutputs || step.endOutputs.length === 0)) missing.push('Outputs')
  if (nodeType === 'pipeline' && !(step.pipelineTargetId?.trim())) missing.push('Target pipeline id')
  if (nodeType === 'script' && !(step.scriptPath?.trim())) missing.push('Script path')
  if (nodeType === 'code' && !(step.codeSource?.trim())) missing.push('Code')
  if (nodeType === 'template' && !(step.templateBody?.trim())) missing.push('Template body')
  if (nodeType === 'variable' && (!step.variableAssignments || step.variableAssignments.length === 0)) missing.push('Assignments')
  if (nodeType === 'iteration' && !(step.iterationSource?.trim())) missing.push('Array source')
  if (nodeType === 'iteration' && !(step.iterationPipelineTargetId?.trim())) missing.push('Target pipeline')
  if (nodeType === 'http' && !(step.httpUrl?.trim())) missing.push('Request URL')
  if (nodeType === 'webhook' && !(step.webhookChannelId?.trim()) && !(step.webhookUrl?.trim())) missing.push('Webhook target')
  if (nodeType === 'toolset') {
    if (!(step.toolsetId?.trim())) missing.push('Toolset')
    if (!(step.toolName?.trim())) missing.push('Tool')
  }
  if (nodeType === 'rag') {
    if (!(step.ragKnowledgeBaseId?.trim())) missing.push('Knowledge base')
    if (!(step.ragQuery?.trim())) missing.push('Search query')
  }
  if (nodeType === 'wiki') {
    if (!(step.wikiId?.trim())) missing.push('Wiki')
    if (!(step.wikiQuery?.trim())) missing.push('Search query')
  }
  if (nodeType === 'email') {
    if (!(step.emailTo?.trim())) missing.push('To')
    if (!(step.emailSubject?.trim())) missing.push('Subject')
  }

  return missing
}

export function isNodeConfigurationReady(step: AgentPipelineStep): boolean {
  return getMissingNodeRequirements(step).length === 0
}