import type { AgentPipelineStep } from '@/types'

export type PipelineNodeType = NonNullable<AgentPipelineStep['nodeType']>

export interface PipelineNodeLibraryItem {
  category: string
  value: PipelineNodeType
  label: string
  description: string
}

export const PIPELINE_NODE_LIBRARY: PipelineNodeLibraryItem[] = [
  { category: 'Flow', value: 'start', label: 'Start', description: 'Entry node with workflow params.' },
  { category: 'Flow', value: 'end', label: 'End', description: 'Exit node with output mapping.' },
  { category: 'Control', value: 'condition', label: 'If / Else', description: 'Conditional branching.' },
  { category: 'Control', value: 'parallel', label: 'Parallel', description: 'Concurrent branch orchestration.' },
  { category: 'Control', value: 'join', label: 'Join', description: 'Merge branches before continuing.' },
  { category: 'Execution', value: 'agent', label: 'Agent', description: 'Agent task execution.' },
  { category: 'Execution', value: 'code', label: 'Code', description: 'Inline JavaScript transformation in a sandbox.' },
  { category: 'Execution', value: 'template', label: 'Template', description: 'Render structured output from workflow variables and node results.' },
  { category: 'Execution', value: 'variable', label: 'Variable Assigner', description: 'Set, append, extend, or clear workflow variables.' },
  { category: 'Execution', value: 'iteration', label: 'Iteration', description: 'Run a child pipeline for each item in an input array and collect results.' },
  { category: 'Execution', value: 'toolset', label: 'Toolset', description: 'Run a workspace tool from an installed toolset.' },
  { category: 'Execution', value: 'pipeline', label: 'Other pipeline', description: 'Nested pipeline call.' },
  { category: 'Execution', value: 'script', label: 'Script Execution', description: 'Shell, Node.js, or Python script execution.' },
  { category: 'Knowledge', value: 'rag', label: 'Document Retrieval', description: 'Retrieve context from a knowledge base group.' },
  { category: 'Knowledge', value: 'wiki', label: 'Wiki Search', description: 'Search a workspace wiki/document group.' },
  { category: 'Integration', value: 'http', label: 'HTTP / API', description: 'External API request.' },
  { category: 'Integration', value: 'webhook', label: 'Webhook', description: 'Send an outgoing webhook to a saved channel or custom URL.' },
  { category: 'Integration', value: 'email', label: 'SMTP Email', description: 'Email delivery step.' },
]