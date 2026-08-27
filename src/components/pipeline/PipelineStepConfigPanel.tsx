import { Button as UiButton } from '@/components/shared/button'
import { Checkbox } from '@/components/shared/checkbox'
import { Input as UiInput, Select as UiSelect, TextArea as UiTextArea } from '@/components/shared/form-controls'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import type { AgentPipelineProgressStep } from '@/services/agentPipelineService'
import type { AgentPipelineStep, Model } from '@/types'
import { useAppStore } from '@/store/appStore'
import { getMissingNodeRequirements, getPipelineNodeType, nodeTypeIsStructural, nodeTypeRequiresTask, nodeTypeSupportsAgentBinding, nodeTypeSupportsRunIf } from './pipelineNodeBehaviors'

const REQUEST_AUTH_OPTIONS: Array<{ value: NonNullable<AgentPipelineStep['httpAuthType']>; label: string }> = [
  { value: 'none', label: 'No auth' },
  { value: 'bearer', label: 'Bearer token' },
  { value: 'basic', label: 'Basic auth' },
  { value: 'api-key', label: 'API key' },
  { value: 'custom-header', label: 'Custom header' },
]

function getNodePanelTitle(step: AgentPipelineStep, agentNameMap: Record<string, string>, t: (key: string, defaultValue?: string) => string): string {
  if (step.name?.trim()) return step.name.trim()

  switch (step.nodeType) {
    case 'condition':
      return t('agents.pipelineConditionNode', 'Condition')
    case 'pipeline':
      return t('agents.pipelineNestedPipelineNode', 'Other pipeline')
    case 'script':
      return t('agents.pipelineScriptNode', 'Script')
    case 'code':
      return t('agents.pipelineCodeNode', 'Code')
    case 'template':
      return t('agents.pipelineTemplateNode', 'Template')
    case 'variable':
      return t('agents.pipelineVariableNode', 'Variable Assigner')
    case 'iteration':
      return t('agents.pipelineIterationNode', 'Iteration')
    case 'toolset':
      return t('agents.pipelineToolsetNode', 'Toolset')
    case 'http':
      return t('agents.pipelineHttpNode', 'HTTP / API')
    case 'webhook':
      return t('agents.pipelineWebhookNode', 'Webhook')
    case 'email':
      return t('agents.pipelineEmailNode', 'SMTP Email')
    case 'rag':
      return t('agents.pipelineRagNode', 'Document retrieval')
    case 'wiki':
      return t('agents.pipelineWikiNode', 'Wiki search')
    case 'parallel':
      return t('agents.pipelineParallelNode', 'Parallel')
    case 'join':
      return t('agents.pipelineJoinNode', 'Join')
    case 'start':
      return t('agents.pipelineStartNode', 'Start')
    case 'end':
      return t('agents.pipelineEndNode', 'End')
    case 'agent':
    default:
      return agentNameMap[step.agentId] || t('agents.pipelineUnknownAgent', 'Unknown agent')
  }
}

function getNodePanelHint(nodeType: AgentPipelineStep['nodeType'], t: (key: string, defaultValue?: string) => string): string {
  switch (nodeType) {
    case 'condition':
      return t('agents.pipelineConditionHint', 'Define the branch condition and the prompt context used to evaluate it.')
    case 'pipeline':
      return t('agents.pipelineNestedPipelineHint', 'Configure how this node hands work off to another pipeline.')
    case 'script':
      return t('agents.pipelineScriptHint', 'Configure the local script task and its execution constraints.')
    case 'code':
      return t('agents.pipelineCodeHint', 'Execute inline JavaScript inside a restricted sandbox and expose returned fields downstream.')
    case 'template':
      return t('agents.pipelineTemplateHint', 'Render text with workflow variables, conditionals, and simple loops before handing it downstream.')
    case 'variable':
      return t('agents.pipelineVariableHint', 'Assign or mutate workflow variables so later nodes can branch on or reuse them.')
    case 'iteration':
      return t('agents.pipelineIterationHint', 'Process each array element by running a child pipeline and aggregating the results.')
    case 'toolset':
      return t('agents.pipelineToolsetHint', 'Choose a workspace toolset and the exact tool to execute.')
    case 'http':
      return t('agents.pipelineHttpHint', 'Configure the request details and how the response is routed downstream.')
    case 'webhook':
      return t('agents.pipelineWebhookHint', 'Send an outgoing webhook to a saved channel target or a custom URL.')
    case 'email':
      return t('agents.pipelineEmailHint', 'Configure the delivery task and the content passed into this email step.')
    case 'rag':
      return t('agents.pipelineRagHint', 'Search a selected knowledge base and pass the retrieved context downstream.')
    case 'wiki':
      return t('agents.pipelineWikiHint', 'Search a wiki/document group and pass matching notes downstream.')
    case 'parallel':
      return t('agents.pipelineParallelHint', 'Use this structural node to fan work out into parallel branches.')
    case 'join':
      return t('agents.pipelineJoinHint', 'Use this structural node to merge parallel branches before continuing.')
    case 'start':
      return t('agents.pipelineStartHint', 'This node marks where the workflow begins.')
    case 'end':
      return t('agents.pipelineEndHint', 'This node marks where the workflow completes.')
    case 'agent':
    default:
      return t('agents.pipelineStepConfigHint', 'Edit the selected step directly from the flow-driven configuration panel.')
  }
}

interface PipelineStepConfigPanelProps {
  step: AgentPipelineStep | null
  stepIndex: number | null
  totalSteps: number
  enabledAgents: Array<{ id: string; name: string }>
  agentNameMap: Record<string, string>
  models: Model[]
  previousOutput?: string
  previewStep?: AgentPipelineProgressStep
  onUpdateStep: (idx: number, updates: Partial<AgentPipelineStep>) => void
  onMoveStep: (idx: number, direction: -1 | 1) => void
  onDuplicateStep: (idx: number) => void
  onRemoveStep: (idx: number) => void
  onAppendReference: (idx: number, token: string) => void
  formatDuration: (durationMs?: number, t?: (key: string, defaultValue?: string) => string) => string
  normalizeRetryCount: (value?: number) => number
  t: (key: string, defaultValue?: string) => string
}

const DEFAULT_NODE_TYPE_OPTIONS: Array<{ value: NonNullable<AgentPipelineStep['nodeType']>; label: string }> = [
  { value: 'condition', label: 'If / Else' },
  { value: 'agent', label: 'Agent' },
  { value: 'code', label: 'Code' },
  { value: 'template', label: 'Template' },
  { value: 'variable', label: 'Variable Assigner' },
  { value: 'iteration', label: 'Iteration' },
  { value: 'toolset', label: 'Toolset' },
  { value: 'pipeline', label: 'Other pipeline' },
  { value: 'script', label: 'Script Execution' },
  { value: 'rag', label: 'Document Retrieval' },
  { value: 'wiki', label: 'Wiki Search' },
  { value: 'http', label: 'HTTP / API' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'email', label: 'SMTP Email' },
  { value: 'parallel', label: 'Parallel' },
  { value: 'join', label: 'Join' },
]

function getNodeTypeOptions(nodeType: NonNullable<AgentPipelineStep['nodeType']>) {
  if (nodeType === 'start') {
    return [{ value: 'start' as const, label: 'Start' }, ...DEFAULT_NODE_TYPE_OPTIONS]
  }
  if (nodeType === 'end') {
    return [{ value: 'end' as const, label: 'End' }, ...DEFAULT_NODE_TYPE_OPTIONS]
  }
  return DEFAULT_NODE_TYPE_OPTIONS
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">{children}</div>
}

function CompactField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 rounded-xl border border-border-subtle bg-surface-2/45 px-3 py-2">
      <div className="text-[11px] font-medium text-text-secondary">{label}</div>
      {children}
    </label>
  )
}

function KeyValueListEditor({
  items,
  keyPlaceholder,
  valuePlaceholder,
  addLabel,
  onChange,
}: {
  items: Array<{ key: string; value?: string; defaultValue?: string }>
  keyPlaceholder: string
  valuePlaceholder: string
  addLabel: string
  onChange: (items: Array<{ key: string; value?: string; defaultValue?: string }>) => void
}) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={`${item.key || 'row'}-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <UiInput value={item.key} onChange={(event) => onChange(items.map((entry, entryIndex) => entryIndex === index ? { ...entry, key: event.target.value } : entry))} placeholder={keyPlaceholder} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
          <UiInput value={item.value ?? item.defaultValue ?? ''} onChange={(event) => onChange(items.map((entry, entryIndex) => entryIndex === index ? { ...entry, value: event.target.value, defaultValue: event.target.value } : entry))} placeholder={valuePlaceholder} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
          <UiButton unstyled type="button" onClick={() => onChange(items.filter((_, entryIndex) => entryIndex !== index))} className="rounded-lg border border-border-subtle/70 bg-surface-1/70 px-2 py-1 text-[11px] text-text-secondary transition-colors hover:border-red-300 hover:text-red-500">×</UiButton>
        </div>
      ))}
      <UiButton unstyled type="button" onClick={() => onChange([...items, { key: '', value: '' }])} className="rounded-lg border border-border-subtle/70 bg-surface-1/80 px-2.5 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-accent/25 hover:text-text-primary">{addLabel}</UiButton>
    </div>
  )
}

function toggleSelection(values: string[], value: string, checked: boolean): string[] {
  if (!value.trim()) return values
  if (checked) return Array.from(new Set([...values, value]))
  return values.filter((entry) => entry !== value)
}

interface PipelineConfigContext {
  webhookTargets: Array<{ id: string; label: string; url: string }>
  toolsets: Array<{ id: string; name: string; tools: string[] }>
  documentGroups: Array<{ id: string; name: string }>
  savedPipelines: Array<{ id: string; name: string }>
  emailAvailable: boolean
}

function renderNodeSpecificFields(
  step: AgentPipelineStep,
  stepIndex: number,
  onUpdateStep: (idx: number, updates: Partial<AgentPipelineStep>) => void,
  context: PipelineConfigContext,
  t: (key: string, defaultValue?: string) => string,
) {
  const nodeType = getPipelineNodeType(step)
  const selectedToolset = context.toolsets.find((toolset) => toolset.id === step.toolsetId)

  switch (nodeType) {
    case 'condition':
      return (
        <div className="space-y-2.5">
          <SectionLabel>{t('agents.pipelineBranchLogic', 'Branch logic')}</SectionLabel>
          <CompactField label={t('agents.pipelineConditionMode', 'Condition mode')}>
              <UiSelect value={step.conditionMode ?? 'all'} onChange={(event) => onUpdateStep(stepIndex, { conditionMode: event.target.value as AgentPipelineStep['conditionMode'] })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary">
                <option value="all">{t('agents.pipelineConditionModeAll', 'All rules must match')}</option>
                <option value="any">{t('agents.pipelineConditionModeAny', 'Any rule may match')}</option>
              </UiSelect>
          </CompactField>
          <div className="grid gap-2 sm:grid-cols-2">
            <CompactField label={t('agents.pipelineConditionTrueLabel', 'If branch label')}>
              <UiInput value={step.conditionTrueLabel ?? ''} onChange={(event) => onUpdateStep(stepIndex, { conditionTrueLabel: event.target.value || undefined })} placeholder="Approved" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
            </CompactField>
            <CompactField label={t('agents.pipelineConditionFalseLabel', 'Else branch label')}>
              <UiInput value={step.conditionFalseLabel ?? ''} onChange={(event) => onUpdateStep(stepIndex, { conditionFalseLabel: event.target.value || undefined })} placeholder="Rejected" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
            </CompactField>
          </div>
          <div className="rounded-xl border border-border-subtle bg-surface-2/45 px-3 py-2">
            <div className="text-[11px] font-medium text-text-secondary">{t('agents.pipelineConditionBranches', 'Named branches')}</div>
            <div className="mt-1 text-[10px] text-text-muted">{t('agents.pipelineConditionBranchesHint', 'Optional. When present, the condition output can route by branch key or label instead of only true / false.')}</div>
            <div className="mt-2">
              <KeyValueListEditor
                items={(step.conditionBranches ?? []).map((branch) => ({ key: branch.key, value: branch.label ?? '' }))}
                keyPlaceholder="approved"
                valuePlaceholder="Approved branch"
                addLabel={t('agents.pipelineAddBranch', '+ Add branch')}
                onChange={(items) => onUpdateStep(stepIndex, {
                  conditionBranches: items
                    .map((item) => ({ key: item.key.trim(), label: item.value?.trim() || undefined }))
                    .filter((item) => item.key),
                })}
              />
            </div>
          </div>
        </div>
      )
    case 'toolset':
      return (
        <div className="space-y-2.5">
          <SectionLabel>{t('agents.pipelineToolsetSettings', 'Tool invocation')}</SectionLabel>
          <div className="grid gap-2 sm:grid-cols-2">
            <CompactField label={t('agents.pipelineToolsetPicker', 'Toolset')}>
              <UiSelect value={step.toolsetId ?? ''} onChange={(event) => onUpdateStep(stepIndex, { toolsetId: event.target.value || undefined, toolName: undefined })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary">
                <option value="">{t('agents.pipelineSelectToolset', 'Select a toolset')}</option>
                {context.toolsets.map((toolset) => <option key={toolset.id} value={toolset.id}>{toolset.name}</option>)}
              </UiSelect>
            </CompactField>
            <CompactField label={t('agents.pipelineToolPicker', 'Tool')}>
              <UiSelect value={step.toolName ?? ''} onChange={(event) => onUpdateStep(stepIndex, { toolName: event.target.value || undefined })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" disabled={!selectedToolset}>
                <option value="">{t('agents.pipelineSelectTool', 'Select a tool')}</option>
                {(selectedToolset?.tools ?? []).map((toolName) => <option key={toolName} value={toolName}>{toolName}</option>)}
              </UiSelect>
            </CompactField>
          </div>
          <CompactField label={t('agents.pipelineToolInput', 'Tool input JSON')}>
            <UiTextArea value={step.toolInput ?? ''} onChange={(event) => onUpdateStep(stepIndex, { toolInput: event.target.value || undefined })} rows={4} placeholder='{"query":"open tickets"}' controlClassName="rounded-lg border border-border bg-surface-1 px-2 py-2 text-xs text-text-primary" />
          </CompactField>
        </div>
      )
    case 'pipeline':
      return (
        <div className="space-y-2.5">
          <SectionLabel>{t('agents.pipelineNestedPipelineSettings', 'Pipeline handoff')}</SectionLabel>
          <CompactField label={t('agents.pipelineTargetPipeline', 'Target pipeline id')}>
            <UiInput value={step.pipelineTargetId ?? ''} onChange={(event) => onUpdateStep(stepIndex, { pipelineTargetId: event.target.value || undefined })} placeholder="pipeline-sales-review" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
          </CompactField>
          <CompactField label={t('agents.pipelineInputMapping', 'Input mapping')}>
            <UiTextArea value={step.pipelineInputMapping ?? ''} onChange={(event) => onUpdateStep(stepIndex, { pipelineInputMapping: event.target.value || undefined })} rows={3} placeholder="topic={{vars.topic}}" controlClassName="rounded-lg border border-border bg-surface-1 px-2 py-2 text-xs text-text-primary" />
          </CompactField>
        </div>
      )
    case 'script':
      return (
        <div className="space-y-2.5">
          <SectionLabel>{t('agents.pipelineScriptSettings', 'Script runtime')}</SectionLabel>
          <div className="grid gap-2 sm:grid-cols-2">
            <CompactField label={t('agents.pipelineScriptRuntime', 'Runtime')}>
              <UiSelect value={step.scriptRuntime ?? 'nodejs'} onChange={(event) => onUpdateStep(stepIndex, { scriptRuntime: event.target.value as AgentPipelineStep['scriptRuntime'] })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary">
                <option value="nodejs">Node.js</option>
                <option value="python">Python</option>
                <option value="shell">Shell</option>
              </UiSelect>
            </CompactField>
            <CompactField label={t('agents.pipelineScriptPath', 'Script path')}>
              <UiInput value={step.scriptPath ?? ''} onChange={(event) => onUpdateStep(stepIndex, { scriptPath: event.target.value || undefined })} placeholder="scripts/process.ts" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
            </CompactField>
          </div>
          <CompactField label={t('agents.pipelineScriptArgs', 'Arguments')}>
            <UiInput value={step.scriptArgs ?? ''} onChange={(event) => onUpdateStep(stepIndex, { scriptArgs: event.target.value || undefined })} placeholder="--mode live --limit 20" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
          </CompactField>
          <CompactField label={t('agents.pipelineScriptInputMapping', 'Input mapping')}>
            <UiTextArea value={step.scriptInputMapping ?? ''} onChange={(event) => onUpdateStep(stepIndex, { scriptInputMapping: event.target.value || undefined })} rows={3} placeholder="payload={{previous.output}}" controlClassName="rounded-lg border border-border bg-surface-1 px-2 py-2 text-xs text-text-primary" />
          </CompactField>
          <CompactField label={t('agents.pipelineScriptOutputSchema', 'Output schema keys')}>
            <UiInput value={step.scriptOutputSchema ?? ''} onChange={(event) => onUpdateStep(stepIndex, { scriptOutputSchema: event.target.value || undefined })} placeholder="result,summary,status" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
          </CompactField>
        </div>
      )
    case 'code':
      return (
        <div className="space-y-2.5">
          <SectionLabel>{t('agents.pipelineCodeSettings', 'Code execution')}</SectionLabel>
          <CompactField label={t('agents.pipelineCodeLanguage', 'Language')}>
            <UiSelect value={step.codeLanguage ?? 'javascript'} onChange={(event) => onUpdateStep(stepIndex, { codeLanguage: event.target.value as AgentPipelineStep['codeLanguage'] })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary">
              <option value="javascript">JavaScript</option>
            </UiSelect>
          </CompactField>
          <CompactField label={t('agents.pipelineCodeInputMapping', 'Input mapping')}>
            <UiTextArea value={step.codeInputMapping ?? ''} onChange={(event) => onUpdateStep(stepIndex, { codeInputMapping: event.target.value || undefined })} rows={3} placeholder={"items={{step1.output}}\nmode={{vars.mode}}"} controlClassName="rounded-lg border border-border bg-surface-1 px-2 py-2 text-xs text-text-primary" />
          </CompactField>
          <CompactField label={t('agents.pipelineCodeOutputSchema', 'Output variables')}>
            <UiInput value={step.codeOutputSchema ?? ''} onChange={(event) => onUpdateStep(stepIndex, { codeOutputSchema: event.target.value || undefined })} placeholder="result, summary, count" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
          </CompactField>
          <CompactField label={t('agents.pipelineCodeSource', 'Code')}>
            <UiTextArea value={step.codeSource ?? ''} onChange={(event) => onUpdateStep(stepIndex, { codeSource: event.target.value || undefined })} rows={10} placeholder={"function main(inputs) {\n  const items = Array.isArray(inputs.items) ? inputs.items : [];\n  return { result: items.length };\n}"} controlClassName="rounded-lg border border-border bg-surface-1 px-2 py-2 font-mono text-xs text-text-primary" />
          </CompactField>
          <div className="rounded-xl border border-border-subtle bg-surface-2/45 px-3 py-2 text-[10px] text-text-muted">{t('agents.pipelineCodeResultHint', 'Return an object from main(inputs). Top-level keys become downstream workflow variables automatically, and result is used as this node output when present.')}</div>
        </div>
      )
    case 'template':
      return (
        <div className="space-y-2.5">
          <SectionLabel>{t('agents.pipelineTemplateSettings', 'Template rendering')}</SectionLabel>
          <CompactField label={t('agents.pipelineTemplateInputMapping', 'Input mapping')}>
            <UiTextArea value={step.templateInputMapping ?? ''} onChange={(event) => onUpdateStep(stepIndex, { templateInputMapping: event.target.value || undefined })} rows={3} placeholder={"items={{step1.output}}\nheadline={{vars.title}}"} controlClassName="rounded-lg border border-border bg-surface-1 px-2 py-2 text-xs text-text-primary" />
          </CompactField>
          <CompactField label={t('agents.pipelineTemplateBody', 'Template body')}>
            <UiTextArea value={step.templateBody ?? ''} onChange={(event) => onUpdateStep(stepIndex, { templateBody: event.target.value || undefined })} rows={10} placeholder={"{% if vars.title %}\n# {{ vars.title }}\n{% endif %}\n{% for item in items %}- {{ item }}\n{% endfor %}"} controlClassName="rounded-lg border border-border bg-surface-1 px-2 py-2 font-mono text-xs text-text-primary" />
          </CompactField>
          <div className="rounded-xl border border-border-subtle bg-surface-2/45 px-3 py-2 text-[10px] text-text-muted">{t('agents.pipelineTemplateSyntaxHint', 'Supports {{ value }}, {% if condition %}...{% else %}...{% endif %}, {% for item in items %}...{% endfor %}, plus filters like upper, lower, join, json, default, length, round.')}</div>
        </div>
      )
    case 'variable':
      return (
        <div className="space-y-2.5">
          <SectionLabel>{t('agents.pipelineVariableSettings', 'Variable assignments')}</SectionLabel>
          <div className="space-y-2">
            {(step.variableAssignments ?? []).map((assignment, assignmentIndex) => (
              <div key={`${assignment.variable || 'assignment'}-${assignmentIndex}`} className="grid gap-2 rounded-xl border border-border-subtle bg-surface-2/45 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)_auto]">
                <UiInput value={assignment.variable} onChange={(event) => onUpdateStep(stepIndex, { variableAssignments: (step.variableAssignments ?? []).map((entry, entryIndex) => entryIndex === assignmentIndex ? { ...entry, variable: event.target.value } : entry) })} placeholder="resultList" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
                <UiSelect value={assignment.mode} onChange={(event) => onUpdateStep(stepIndex, { variableAssignments: (step.variableAssignments ?? []).map((entry, entryIndex) => entryIndex === assignmentIndex ? { ...entry, mode: event.target.value as NonNullable<typeof entry.mode> } : entry) })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary">
                  <option value="overwrite">Overwrite</option>
                  <option value="append">Append</option>
                  <option value="extend">Extend</option>
                  <option value="clear">Clear</option>
                </UiSelect>
                <UiInput value={assignment.value ?? ''} onChange={(event) => onUpdateStep(stepIndex, { variableAssignments: (step.variableAssignments ?? []).map((entry, entryIndex) => entryIndex === assignmentIndex ? { ...entry, value: event.target.value } : entry) })} placeholder="{{previous.output}}" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" disabled={assignment.mode === 'clear'} />
                <UiButton unstyled type="button" onClick={() => onUpdateStep(stepIndex, { variableAssignments: (step.variableAssignments ?? []).filter((_, entryIndex) => entryIndex !== assignmentIndex) })} className="rounded-lg border border-border-subtle/70 bg-surface-1/70 px-2 py-1 text-[11px] text-text-secondary transition-colors hover:border-red-300 hover:text-red-500">×</UiButton>
              </div>
            ))}
          </div>
          <UiButton unstyled type="button" onClick={() => onUpdateStep(stepIndex, { variableAssignments: [...(step.variableAssignments ?? []), { variable: '', mode: 'overwrite', value: '{{previous.output}}' }] })} className="rounded-lg border border-border-subtle/70 bg-surface-1/80 px-2.5 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-accent/25 hover:text-text-primary">{t('agents.pipelineAddAssignment', '+ Add assignment')}</UiButton>
          <div className="rounded-xl border border-border-subtle bg-surface-2/45 px-3 py-2 text-[10px] text-text-muted">{t('agents.pipelineVariableAssignHint', 'Append and extend store JSON arrays under the target workflow variable. Clear removes the variable for downstream nodes.')}</div>
        </div>
      )
    case 'iteration':
      return (
        <div className="space-y-2.5">
          <SectionLabel>{t('agents.pipelineIterationSettings', 'Iteration settings')}</SectionLabel>
          <CompactField label={t('agents.pipelineIterationSource', 'Array source')}>
            <UiInput value={step.iterationSource ?? ''} onChange={(event) => onUpdateStep(stepIndex, { iterationSource: event.target.value || undefined })} placeholder="{{vars.items}}" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
          </CompactField>
          <CompactField label={t('agents.pipelineIterationTarget', 'Child pipeline')}>
            <UiSelect value={step.iterationPipelineTargetId ?? ''} onChange={(event) => onUpdateStep(stepIndex, { iterationPipelineTargetId: event.target.value || undefined })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary">
              <option value="">{t('agents.pipelineSelectChildPipeline', 'Select a child pipeline')}</option>
              {context.savedPipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}
            </UiSelect>
          </CompactField>
          <CompactField label={t('agents.pipelineIterationInputMapping', 'Item mapping')}>
            <UiTextArea value={step.iterationInputMapping ?? ''} onChange={(event) => onUpdateStep(stepIndex, { iterationInputMapping: event.target.value || undefined })} rows={4} placeholder={"record={{vars.item}}\nindex={{vars.index}}\nparent={{previous.output}}"} controlClassName="rounded-lg border border-border bg-surface-1 px-2 py-2 text-xs text-text-primary" />
          </CompactField>
          <div className="grid gap-2 sm:grid-cols-2">
            <CompactField label={t('agents.pipelineIterationItemVar', 'Item variable')}>
              <UiInput value={step.iterationItemVar ?? 'item'} onChange={(event) => onUpdateStep(stepIndex, { iterationItemVar: event.target.value || undefined })} placeholder="item" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
            </CompactField>
            <CompactField label={t('agents.pipelineIterationIndexVar', 'Index variable')}>
              <UiInput value={step.iterationIndexVar ?? 'index'} onChange={(event) => onUpdateStep(stepIndex, { iterationIndexVar: event.target.value || undefined })} placeholder="index" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
            </CompactField>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <CompactField label={t('agents.pipelineIterationMode', 'Processing mode')}>
              <UiSelect value={step.iterationMode ?? 'sequential'} onChange={(event) => onUpdateStep(stepIndex, { iterationMode: event.target.value as AgentPipelineStep['iterationMode'] })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary">
                <option value="sequential">Sequential</option>
                <option value="parallel">Parallel</option>
              </UiSelect>
            </CompactField>
            <CompactField label={t('agents.pipelineIterationErrorMode', 'Error handling')}>
              <UiSelect value={step.iterationErrorMode ?? 'terminate'} onChange={(event) => onUpdateStep(stepIndex, { iterationErrorMode: event.target.value as AgentPipelineStep['iterationErrorMode'] })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary">
                <option value="terminate">Terminate</option>
                <option value="continue">Continue with null</option>
                <option value="remove-failed">Remove failed results</option>
              </UiSelect>
            </CompactField>
          </div>
          <div className="rounded-xl border border-border-subtle bg-surface-2/45 px-3 py-2 text-[10px] text-text-muted">{t('agents.pipelineIterationHelp', 'Each iteration injects the current item and index into workflow vars, then runs the selected child pipeline once per array element.')}</div>
        </div>
      )
    case 'http':
      return (
        <div className="space-y-2.5">
          <SectionLabel>{t('agents.pipelineHttpSettings', 'Request settings')}</SectionLabel>
          <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
            <CompactField label={t('agents.pipelineHttpMethod', 'Method')}>
              <UiSelect value={step.httpMethod ?? 'GET'} onChange={(event) => onUpdateStep(stepIndex, { httpMethod: event.target.value as AgentPipelineStep['httpMethod'] })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary">
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </UiSelect>
            </CompactField>
            <CompactField label={t('agents.pipelineHttpUrl', 'Request URL')}>
              <UiInput value={step.httpUrl ?? ''} onChange={(event) => onUpdateStep(stepIndex, { httpUrl: event.target.value || undefined })} placeholder="https://api.example.com/reviews" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
            </CompactField>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <CompactField label={t('agents.pipelineRequestAuth', 'Auth')}>
              <UiSelect value={step.httpAuthType ?? 'none'} onChange={(event) => onUpdateStep(stepIndex, { httpAuthType: event.target.value as AgentPipelineStep['httpAuthType'] })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary">
                {REQUEST_AUTH_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </UiSelect>
            </CompactField>
            <CompactField label={t('agents.pipelineRequestAuthHeader', 'Auth header / key')}>
              <UiInput value={step.httpAuthHeader ?? ''} onChange={(event) => onUpdateStep(stepIndex, { httpAuthHeader: event.target.value || undefined })} placeholder="Authorization" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
            </CompactField>
          </div>
          <CompactField label={t('agents.pipelineRequestAuthValue', 'Auth value')}>
            <UiInput value={step.httpAuthValue ?? ''} onChange={(event) => onUpdateStep(stepIndex, { httpAuthValue: event.target.value || undefined })} placeholder="Bearer {{vars.apiToken}}" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
          </CompactField>
          <CompactField label={t('agents.pipelineHttpHeaders', 'Headers')}>
            <UiTextArea value={step.httpHeaders ?? ''} onChange={(event) => onUpdateStep(stepIndex, { httpHeaders: event.target.value || undefined })} rows={3} placeholder="Authorization: Bearer {{vars.token}}" controlClassName="rounded-lg border border-border bg-surface-1 px-2 py-2 text-xs text-text-primary" />
          </CompactField>
          <CompactField label={t('agents.pipelineRequestBodyType', 'Request body type')}>
            <UiSelect value={step.httpBodyType ?? 'json'} onChange={(event) => onUpdateStep(stepIndex, { httpBodyType: event.target.value as AgentPipelineStep['httpBodyType'] })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary">
              <option value="json">JSON</option>
              <option value="form">Form</option>
              <option value="raw">Raw text</option>
            </UiSelect>
          </CompactField>
          <CompactField label={t('agents.pipelineRequestBody', 'Request body')}>
            <UiTextArea value={step.httpBody ?? ''} onChange={(event) => onUpdateStep(stepIndex, { httpBody: event.target.value || undefined })} rows={4} placeholder='{"topic":"{{vars.topic}}"}' controlClassName="rounded-lg border border-border bg-surface-1 px-2 py-2 text-xs text-text-primary" />
          </CompactField>
          <div className="grid gap-2 sm:grid-cols-2">
            <CompactField label={t('agents.pipelineSuccessStatuses', 'Success status codes')}>
              <UiInput value={step.httpSuccessStatuses ?? ''} onChange={(event) => onUpdateStep(stepIndex, { httpSuccessStatuses: event.target.value || undefined })} placeholder="200 201 202" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
            </CompactField>
            <label className="flex min-h-10 items-center gap-2 rounded-xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
              <Checkbox checked={step.httpTreatNon2xxAsError === true} onChange={(value) => onUpdateStep(stepIndex, { httpTreatNon2xxAsError: value || undefined })} color="blue" />
              {t('agents.pipelineTreatNon2xxAsError', 'Treat non-2xx as error')}
            </label>
          </div>
          <div className="rounded-xl border border-border-subtle bg-surface-2/45 px-3 py-2">
            <div className="text-[11px] font-medium text-text-secondary">{t('agents.pipelineResponseVariables', 'Response variables')}</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <UiInput value={step.httpResponseBodyVar ?? ''} onChange={(event) => onUpdateStep(stepIndex, { httpResponseBodyVar: event.target.value || undefined })} placeholder="apiBody" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
              <UiInput value={step.httpResponseStatusVar ?? ''} onChange={(event) => onUpdateStep(stepIndex, { httpResponseStatusVar: event.target.value || undefined })} placeholder="apiStatus" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
              <UiInput value={step.httpResponseHeadersVar ?? ''} onChange={(event) => onUpdateStep(stepIndex, { httpResponseHeadersVar: event.target.value || undefined })} placeholder="apiHeaders" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
              <UiInput value={step.httpResponseSizeVar ?? ''} onChange={(event) => onUpdateStep(stepIndex, { httpResponseSizeVar: event.target.value || undefined })} placeholder="apiSize" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex min-h-10 items-center gap-2 rounded-xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
              <Checkbox checked={step.httpAsync === true} onChange={(value) => onUpdateStep(stepIndex, { httpAsync: value })} color="blue" />
              {t('agents.pipelineRequestAsync', 'Send asynchronously')}
            </label>
            <label className="flex min-h-10 items-center gap-2 rounded-xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
              <Checkbox checked={step.httpCaptureResponse !== false} onChange={(value) => onUpdateStep(stepIndex, { httpCaptureResponse: value })} color="blue" />
              {t('agents.pipelineCaptureResponse', 'Capture response as output')}
            </label>
          </div>
        </div>
      )
    case 'webhook':
      return (
        <div className="space-y-2.5">
          <SectionLabel>{t('agents.pipelineWebhookSettings', 'Webhook delivery')}</SectionLabel>
          <div className="rounded-xl border border-border-subtle bg-surface-2/45 px-3 py-2 text-[10px] text-text-muted">{t('agents.pipelineWebhookFailureBranchHint', 'Tip: for webhook nodes, the second outgoing edge becomes the failure branch and receives error retries/failures when continue-on-error is enabled.')}</div>
          <CompactField label={t('agents.pipelineWebhookTarget', 'Saved webhook target')}>
            <UiSelect value={step.webhookChannelId ?? ''} onChange={(event) => onUpdateStep(stepIndex, { webhookChannelId: event.target.value || undefined })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary">
              <option value="">{t('agents.pipelineWebhookCustom', 'Use a custom webhook URL')}</option>
              {context.webhookTargets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
            </UiSelect>
          </CompactField>
          <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
            <CompactField label={t('agents.pipelineWebhookMethod', 'Method')}>
              <UiSelect value={step.webhookMethod ?? 'POST'} onChange={(event) => onUpdateStep(stepIndex, { webhookMethod: event.target.value as AgentPipelineStep['webhookMethod'] })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary">
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="GET">GET</option>
              </UiSelect>
            </CompactField>
            <CompactField label={t('agents.pipelineWebhookUrl', 'Custom webhook URL')}>
              <UiInput value={step.webhookUrl ?? ''} onChange={(event) => onUpdateStep(stepIndex, { webhookUrl: event.target.value || undefined })} placeholder="https://hooks.example.com/workflows" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
            </CompactField>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <CompactField label={t('agents.pipelineRequestAuth', 'Auth')}>
              <UiSelect value={step.webhookAuthType ?? 'none'} onChange={(event) => onUpdateStep(stepIndex, { webhookAuthType: event.target.value as AgentPipelineStep['webhookAuthType'] })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary">
                {REQUEST_AUTH_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </UiSelect>
            </CompactField>
            <CompactField label={t('agents.pipelineRequestAuthHeader', 'Auth header / key')}>
              <UiInput value={step.webhookAuthHeader ?? ''} onChange={(event) => onUpdateStep(stepIndex, { webhookAuthHeader: event.target.value || undefined })} placeholder="Authorization" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
            </CompactField>
          </div>
          <CompactField label={t('agents.pipelineRequestAuthValue', 'Auth value')}>
            <UiInput value={step.webhookAuthValue ?? ''} onChange={(event) => onUpdateStep(stepIndex, { webhookAuthValue: event.target.value || undefined })} placeholder="Bearer {{vars.apiToken}}" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
          </CompactField>
          <CompactField label={t('agents.pipelineHttpHeaders', 'Headers')}>
            <UiTextArea value={step.webhookHeaders ?? ''} onChange={(event) => onUpdateStep(stepIndex, { webhookHeaders: event.target.value || undefined })} rows={3} placeholder="X-Workflow-Key: {{vars.workflowKey}}" controlClassName="rounded-lg border border-border bg-surface-1 px-2 py-2 text-xs text-text-primary" />
          </CompactField>
          <CompactField label={t('agents.pipelineRequestBodyType', 'Request body type')}>
            <UiSelect value={step.webhookBodyType ?? 'json'} onChange={(event) => onUpdateStep(stepIndex, { webhookBodyType: event.target.value as AgentPipelineStep['httpBodyType'] })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary">
              <option value="json">JSON</option>
              <option value="form">Form</option>
              <option value="raw">Raw text</option>
            </UiSelect>
          </CompactField>
          <CompactField label={t('agents.pipelineRequestBody', 'Request body')}>
            <UiTextArea value={step.webhookBody ?? ''} onChange={(event) => onUpdateStep(stepIndex, { webhookBody: event.target.value || undefined })} rows={4} placeholder='{"content":"{{previous.output}}"}' controlClassName="rounded-lg border border-border bg-surface-1 px-2 py-2 text-xs text-text-primary" />
          </CompactField>
          <div className="grid gap-2 sm:grid-cols-2">
            <CompactField label={t('agents.pipelineSuccessStatuses', 'Success status codes')}>
              <UiInput value={step.webhookSuccessStatuses ?? ''} onChange={(event) => onUpdateStep(stepIndex, { webhookSuccessStatuses: event.target.value || undefined })} placeholder="200 202 204" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
            </CompactField>
            <label className="flex min-h-10 items-center gap-2 rounded-xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
              <Checkbox checked={step.webhookTreatNon2xxAsError !== false} onChange={(value) => onUpdateStep(stepIndex, { webhookTreatNon2xxAsError: value })} color="blue" />
              {t('agents.pipelineTreatNon2xxAsError', 'Treat non-2xx as error')}
            </label>
          </div>
          <div className="rounded-xl border border-border-subtle bg-surface-2/45 px-3 py-2">
            <div className="text-[11px] font-medium text-text-secondary">{t('agents.pipelineResponseVariables', 'Response variables')}</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <UiInput value={step.webhookResponseBodyVar ?? ''} onChange={(event) => onUpdateStep(stepIndex, { webhookResponseBodyVar: event.target.value || undefined })} placeholder="webhookBody" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
              <UiInput value={step.webhookResponseStatusVar ?? ''} onChange={(event) => onUpdateStep(stepIndex, { webhookResponseStatusVar: event.target.value || undefined })} placeholder="webhookStatus" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
              <UiInput value={step.webhookResponseHeadersVar ?? ''} onChange={(event) => onUpdateStep(stepIndex, { webhookResponseHeadersVar: event.target.value || undefined })} placeholder="webhookHeaders" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
              <UiInput value={step.webhookResponseSizeVar ?? ''} onChange={(event) => onUpdateStep(stepIndex, { webhookResponseSizeVar: event.target.value || undefined })} placeholder="webhookSize" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex min-h-10 items-center gap-2 rounded-xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
              <Checkbox checked={step.webhookAsync === true} onChange={(value) => onUpdateStep(stepIndex, { webhookAsync: value })} color="blue" />
              {t('agents.pipelineRequestAsync', 'Send asynchronously')}
            </label>
            <label className="flex min-h-10 items-center gap-2 rounded-xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
              <Checkbox checked={step.webhookCaptureResponse !== false} onChange={(value) => onUpdateStep(stepIndex, { webhookCaptureResponse: value })} color="blue" />
              {t('agents.pipelineCaptureResponse', 'Capture response as output')}
            </label>
          </div>
        </div>
      )
    case 'email':
      return (
        <div className="space-y-2.5">
          <SectionLabel>{t('agents.pipelineEmailSettings', 'Delivery settings')}</SectionLabel>
          {!context.emailAvailable ? <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-700">{t('agents.pipelineEmailUnavailable', 'Workspace SMTP settings are not configured, so this node is currently disabled at runtime.')}</div> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <CompactField label={t('agents.pipelineEmailTo', 'To')}>
              <UiInput value={step.emailTo ?? ''} onChange={(event) => onUpdateStep(stepIndex, { emailTo: event.target.value || undefined })} placeholder="ops@example.com" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" disabled={!context.emailAvailable} />
            </CompactField>
            <CompactField label={t('agents.pipelineEmailCc', 'Cc')}>
              <UiInput value={step.emailCc ?? ''} onChange={(event) => onUpdateStep(stepIndex, { emailCc: event.target.value || undefined })} placeholder="team@example.com" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" disabled={!context.emailAvailable} />
            </CompactField>
          </div>
          <CompactField label={t('agents.pipelineEmailSubject', 'Subject')}>
            <UiInput value={step.emailSubject ?? ''} onChange={(event) => onUpdateStep(stepIndex, { emailSubject: event.target.value || undefined })} placeholder="Pipeline alert" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" disabled={!context.emailAvailable} />
          </CompactField>
        </div>
      )
    case 'rag':
      return (
        <div className="space-y-2.5">
          <SectionLabel>{t('agents.pipelineRagSettings', 'Knowledge retrieval')}</SectionLabel>
          <div className="grid gap-2 sm:grid-cols-2">
            <CompactField label={t('agents.pipelineKnowledgeBase', 'Knowledge base')}>
              <UiSelect value={step.ragKnowledgeBaseId ?? ''} onChange={(event) => onUpdateStep(stepIndex, { ragKnowledgeBaseId: event.target.value || undefined })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary">
                <option value="">{t('agents.pipelineSelectKnowledgeBase', 'Select a knowledge base')}</option>
                {context.documentGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </UiSelect>
            </CompactField>
            <CompactField label={t('agents.pipelineTopK', 'Top K')}>
              <UiInput type="number" min={1} max={20} value={step.ragTopK ?? 5} onChange={(event) => onUpdateStep(stepIndex, { ragTopK: Math.max(1, Number(event.target.value || 5)) })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
            </CompactField>
          </div>
          <CompactField label={t('agents.pipelineScoreThreshold', 'Score threshold')}>
            <UiInput type="number" min={0} step={0.01} value={step.ragScoreThreshold ?? ''} onChange={(event) => onUpdateStep(stepIndex, { ragScoreThreshold: event.target.value === '' ? undefined : Math.max(0, Number(event.target.value)) })} placeholder="0" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
          </CompactField>
          <div className="rounded-xl border border-border-subtle bg-surface-2/45 px-3 py-2">
            <div className="text-[11px] font-medium text-text-secondary">{t('agents.pipelineAdditionalKnowledgeBases', 'Additional knowledge bases')}</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {context.documentGroups.map((group) => (
                <label key={group.id} className="flex items-center gap-2 rounded-lg border border-border-subtle/70 bg-surface-1/75 px-2.5 py-2 text-[11px] text-text-secondary">
                  <Checkbox
                    checked={(step.ragKnowledgeBaseIds ?? []).includes(group.id)}
                    onChange={(value) => onUpdateStep(stepIndex, { ragKnowledgeBaseIds: toggleSelection(step.ragKnowledgeBaseIds ?? [], group.id, value) })}
                    color="blue"
                  />
                  {group.name}
                </label>
              ))}
            </div>
          </div>
          <CompactField label={t('agents.pipelineMetadataFilter', 'Metadata filter')}>
            <UiInput value={step.ragMetadataFilter ?? ''} onChange={(event) => onUpdateStep(stepIndex, { ragMetadataFilter: event.target.value || undefined })} placeholder="tag:release path:runbook" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
          </CompactField>
          <CompactField label={t('agents.pipelineSearchQuery', 'Search query')}>
            <UiTextArea value={step.ragQuery ?? ''} onChange={(event) => onUpdateStep(stepIndex, { ragQuery: event.target.value || undefined })} rows={3} placeholder="Search for related release notes and launch plans" controlClassName="rounded-lg border border-border bg-surface-1 px-2 py-2 text-xs text-text-primary" />
          </CompactField>
        </div>
      )
    case 'wiki':
      return (
        <div className="space-y-2.5">
          <SectionLabel>{t('agents.pipelineWikiSettings', 'Wiki search')}</SectionLabel>
          <div className="grid gap-2 sm:grid-cols-2">
            <CompactField label={t('agents.pipelineWikiPicker', 'Wiki')}>
              <UiSelect value={step.wikiId ?? ''} onChange={(event) => onUpdateStep(stepIndex, { wikiId: event.target.value || undefined })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary">
                <option value="">{t('agents.pipelineSelectWiki', 'Select a wiki')}</option>
                {context.documentGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </UiSelect>
            </CompactField>
            <CompactField label={t('agents.pipelineTopK', 'Top K')}>
              <UiInput type="number" min={1} max={20} value={step.wikiTopK ?? 5} onChange={(event) => onUpdateStep(stepIndex, { wikiTopK: Math.max(1, Number(event.target.value || 5)) })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
            </CompactField>
          </div>
          <CompactField label={t('agents.pipelineScoreThreshold', 'Score threshold')}>
            <UiInput type="number" min={0} step={0.01} value={step.wikiScoreThreshold ?? ''} onChange={(event) => onUpdateStep(stepIndex, { wikiScoreThreshold: event.target.value === '' ? undefined : Math.max(0, Number(event.target.value)) })} placeholder="0" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
          </CompactField>
          <div className="rounded-xl border border-border-subtle bg-surface-2/45 px-3 py-2">
            <div className="text-[11px] font-medium text-text-secondary">{t('agents.pipelineAdditionalWikis', 'Additional wikis')}</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {context.documentGroups.map((group) => (
                <label key={group.id} className="flex items-center gap-2 rounded-lg border border-border-subtle/70 bg-surface-1/75 px-2.5 py-2 text-[11px] text-text-secondary">
                  <Checkbox
                    checked={(step.wikiIds ?? []).includes(group.id)}
                    onChange={(value) => onUpdateStep(stepIndex, { wikiIds: toggleSelection(step.wikiIds ?? [], group.id, value) })}
                    color="blue"
                  />
                  {group.name}
                </label>
              ))}
            </div>
          </div>
          <CompactField label={t('agents.pipelineMetadataFilter', 'Metadata filter')}>
            <UiInput value={step.wikiMetadataFilter ?? ''} onChange={(event) => onUpdateStep(stepIndex, { wikiMetadataFilter: event.target.value || undefined })} placeholder="tag:runbook title:deploy" controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
          </CompactField>
          <CompactField label={t('agents.pipelineSearchQuery', 'Search query')}>
            <UiTextArea value={step.wikiQuery ?? ''} onChange={(event) => onUpdateStep(stepIndex, { wikiQuery: event.target.value || undefined })} rows={3} placeholder="Find deployment runbooks and rollback guides" controlClassName="rounded-lg border border-border bg-surface-1 px-2 py-2 text-xs text-text-primary" />
          </CompactField>
        </div>
      )
    case 'parallel':
      return (
        <div className="space-y-2.5">
          <SectionLabel>{t('agents.pipelineParallelSettings', 'Parallel branches')}</SectionLabel>
          <div className="grid gap-2 sm:grid-cols-2">
            <CompactField label={t('agents.pipelineParallelBranches', 'Branch count')}>
              <UiInput type="number" min={2} value={step.parallelBranches ?? 2} onChange={(event) => onUpdateStep(stepIndex, { parallelBranches: Math.max(2, Number(event.target.value || 2)) })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary" />
            </CompactField>
            <CompactField label={t('agents.pipelineParallelJoinStrategy', 'Join strategy')}>
              <UiSelect value={step.parallelJoinStrategy ?? 'all'} onChange={(event) => onUpdateStep(stepIndex, { parallelJoinStrategy: event.target.value as AgentPipelineStep['parallelJoinStrategy'] })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary">
                <option value="all">{t('agents.pipelineParallelJoinStrategyAll', 'Wait for all')}</option>
                <option value="first">{t('agents.pipelineParallelJoinStrategyFirst', 'Continue on first completion')}</option>
                <option value="best-effort">{t('agents.pipelineParallelJoinStrategyBestEffort', 'Best effort')}</option>
              </UiSelect>
            </CompactField>
          </div>
        </div>
      )
    case 'join':
      return (
        <div className="space-y-2.5">
          <SectionLabel>{t('agents.pipelineJoinSettings', 'Join behavior')}</SectionLabel>
          <CompactField label={t('agents.pipelineJoinStrategy', 'Merge strategy')}>
            <UiSelect value={step.joinStrategy ?? 'wait-all'} onChange={(event) => onUpdateStep(stepIndex, { joinStrategy: event.target.value as AgentPipelineStep['joinStrategy'] })} controlClassName="h-8 rounded-lg border border-border bg-surface-1 px-2 text-xs text-text-primary">
              <option value="wait-all">{t('agents.pipelineJoinStrategyWaitAll', 'Wait for all branches')}</option>
              <option value="first-success">{t('agents.pipelineJoinStrategyFirstSuccess', 'First successful branch')}</option>
              <option value="merge-output">{t('agents.pipelineJoinStrategyMergeOutput', 'Merge outputs')}</option>
            </UiSelect>
          </CompactField>
        </div>
      )
    case 'start':
      return (
        <div className="space-y-2.5">
          <SectionLabel>{t('agents.pipelineStartParams', 'Start parameters')}</SectionLabel>
          <KeyValueListEditor
            items={(step.startParams ?? [{ key: '', defaultValue: '' }]).map((item) => ({ key: item.key, defaultValue: item.defaultValue }))}
            keyPlaceholder="param"
            valuePlaceholder="default value"
            addLabel="+ Add param"
            onChange={(items) => onUpdateStep(stepIndex, { startParams: items.map((item) => ({ key: item.key, defaultValue: item.value ?? item.defaultValue ?? '' })) })}
          />
        </div>
      )
    case 'end':
      return (
        <div className="space-y-2.5">
          <SectionLabel>{t('agents.pipelineEndOutputs', 'Workflow outputs')}</SectionLabel>
          <KeyValueListEditor
            items={(step.endOutputs ?? [{ key: '', value: '' }]).map((item) => ({ key: item.key, value: item.value }))}
            keyPlaceholder="output"
            valuePlaceholder="{{previous.output}}"
            addLabel="+ Add output"
            onChange={(items) => onUpdateStep(stepIndex, { endOutputs: items.map((item) => ({ key: item.key, value: item.value ?? '' })) })}
          />
        </div>
      )
    case 'agent':
    default:
      return null
  }
}

export function PipelineStepConfigPanel({
  step,
  stepIndex,
  totalSteps,
  enabledAgents,
  agentNameMap,
  models,
  previousOutput,
  previewStep,
  onUpdateStep,
  onMoveStep,
  onDuplicateStep,
  onRemoveStep,
  onAppendReference,
  formatDuration,
  normalizeRetryCount,
  t,
}: PipelineStepConfigPanelProps) {
  const { channels, documentGroups, installedPlugins, pluginTools, emailConfig, agentPipelines } = useAppStore()
  const nodeType = getPipelineNodeType(step)
  const nodeTypeOptions = getNodeTypeOptions(nodeType)
  const supportsAgentBinding = nodeTypeSupportsAgentBinding(nodeType)
  const supportsTaskBody = nodeTypeRequiresTask(nodeType)
  const supportsConditions = nodeTypeSupportsRunIf(nodeType)
  const webhookTargets = channels
    .map((channel) => ({
      id: channel.id,
      label: channel.name,
      url: channel.customWebhookUrl || channel.wechatPersonalWebhookUrl || '',
    }))
    .filter((channel) => channel.url)
  const toolsets = installedPlugins
    .map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      tools: pluginTools[plugin.id] ?? [],
    }))
    .filter((plugin) => plugin.tools.length > 0)
  const pipelineConfigContext: PipelineConfigContext = {
    webhookTargets,
    toolsets,
    documentGroups: documentGroups.map((group) => ({ id: group.id, name: group.name })),
    savedPipelines: agentPipelines.map((pipeline) => ({ id: pipeline.id, name: pipeline.name })),
    emailAvailable: emailConfig.enabled && Boolean(emailConfig.smtpHost && emailConfig.fromAddress),
  }
  if (stepIndex === null || !step) {
    return (
      <section className="rounded-xl border border-border-subtle bg-surface-1/75 p-3.5 shadow-[0_10px_28px_rgba(0,0,0,0.06)] backdrop-blur-sm">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{t('agents.pipelineStepConfig', 'Step configuration')}</h2>
          <p className="mt-1 text-[11px] text-text-muted">{t('agents.pipelineStepConfigEmpty', 'Select a step on the flow canvas to edit its task, routing, and advanced execution settings.')}</p>
        </div>
      </section>
    )
  }

  const usesReferences = step.task.includes('{{') && step.task.includes('}}')
  const missingRequirements = getMissingNodeRequirements(step)
  const configurationReady = missingRequirements.length === 0
  const referenceTokens = stepIndex > 0
    ? [
        {
          label: t('agents.pipelineReferencePrevious', 'Previous output'),
          token: '{{previous.output}}',
        },
        ...Array.from({ length: stepIndex }, (_, referenceIndex) => ({
          label: `${t('agents.pipelineStep', 'Step')} ${referenceIndex + 1} ${t('agents.pipelineOutput', 'output')}`,
          token: `{{steps[${referenceIndex + 1}].output}}`,
        })),
      ]
    : []

  return (
    <section className="rounded-xl border border-border-subtle bg-surface-1/75 p-3.5 shadow-[0_10px_28px_rgba(0,0,0,0.06)] backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineStep', 'Step')} {stepIndex + 1}</div>
          <h2 className="mt-1 text-sm font-semibold text-text-primary">{getNodePanelTitle(step, agentNameMap, t)}</h2>
          <p className="mt-1 text-[11px] text-text-muted">{getNodePanelHint(nodeType, t)}</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="rounded-full border px-2 py-1 text-[10px] font-medium text-text-secondary">{previewStep?.status ? t(`agents.pipelineStatus.${previewStep.status}`, previewStep.status) : t('agents.pipelineStatus.pending', 'pending')}</span>
          <UiButton unstyled type="button" title={t('agents.moveStepUp', 'Move step up')} disabled={stepIndex === 0} onClick={() => onMoveStep(stepIndex, -1)} className="rounded-lg p-1 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary disabled:opacity-30"><IconifyIcon name="ui-chevron-up" size={14} color="currentColor"/></UiButton>
          <UiButton unstyled type="button" title={t('agents.moveStepDown', 'Move step down')} disabled={stepIndex === totalSteps - 1} onClick={() => onMoveStep(stepIndex, 1)} className="rounded-lg p-1 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary disabled:opacity-30"><IconifyIcon name="ui-chevron-down" size={14} color="currentColor"/></UiButton>
          <UiButton unstyled type="button" title={t('agents.duplicateStep', 'Duplicate step')} onClick={() => onDuplicateStep(stepIndex)} className="rounded-lg p-1 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"><IconifyIcon name="ui-copy" size={14} color="currentColor"/></UiButton>
          <UiButton unstyled type="button" title={t('agents.removeStep', 'Remove step')} onClick={() => onRemoveStep(stepIndex)} className="rounded-lg p-1 text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"><IconifyIcon name="ui-close" size={14} color="currentColor"/></UiButton>
        </div>
      </div>

      <div className="mt-3 space-y-2.5">
        <div className={`rounded-xl border px-3 py-2 text-[11px] ${configurationReady ? 'border-emerald-200 bg-emerald-50/70 text-emerald-700' : 'border-amber-200 bg-amber-50/80 text-amber-700'}`}>
          <div className="font-medium">{configurationReady ? t('agents.pipelineConfigReady', 'Node configuration ready') : t('agents.pipelineConfigIncomplete', 'Node configuration incomplete')}</div>
          {configurationReady ? <div className="mt-1 text-[10px] opacity-80">{t('agents.pipelineConfigReadyHint', 'This node has the required settings for its current type.')}</div> : <div className="mt-1 text-[10px] opacity-80">{t('agents.pipelineConfigMissingHint', 'Complete these required fields:')} {missingRequirements.join(', ')}</div>}
        </div>
        <UiSelect value={nodeType} onChange={(event) => onUpdateStep(stepIndex, { nodeType: event.target.value as AgentPipelineStep['nodeType'] })} aria-label={t('agents.pipelineNodeType', 'Node type')} wrapperClassName="w-full" controlClassName="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-primary">
          {nodeTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </UiSelect>
        <UiInput value={step.name ?? ''} onChange={(e) => onUpdateStep(stepIndex, { name: e.target.value })} placeholder={t('agents.pipelineStepNamePlaceholder', 'Optional step label')} wrapperClassName="w-full" controlClassName="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-primary"/>
        {supportsAgentBinding ? (<UiSelect value={step.agentId} onChange={(e) => onUpdateStep(stepIndex, { agentId: e.target.value })} aria-label={t('agents.pipelineAgent', 'Pipeline agent')} wrapperClassName="w-full" controlClassName="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-primary">
            {enabledAgents.map((agent) => <option key={agent.id} value={agent.id}>{agentNameMap[agent.id] ?? agent.name}</option>)}
          </UiSelect>) : null}
        {supportsTaskBody ? (<UiTextArea value={step.task} onChange={(e) => onUpdateStep(stepIndex, { task: e.target.value })} placeholder={nodeType === 'condition' ? t('agents.pipelineConditionDescription', 'Describe the branching decision...') : t('agents.taskDesc', 'Task description...')} rows={4} wrapperClassName="w-full" controlClassName="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-primary"/>) : <div className="rounded-xl border border-dashed border-border-subtle bg-surface-2/45 px-3 py-2.5 text-[11px] text-text-muted">{t('agents.pipelineNodeTypeStaticHint', 'This node type is structural. Configure its name, type, and advanced flow controls from this panel.')}</div>}
        {renderNodeSpecificFields(step, stepIndex, onUpdateStep, pipelineConfigContext, t)}

        <label className="flex min-h-10 items-center gap-2 rounded-xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
          <Checkbox checked={step.enabled !== false} onChange={(v) => onUpdateStep(stepIndex, { enabled: v })} color="blue" />
          {t('agents.pipelineStepEnabled', 'Enabled')}
        </label>

        <details className="rounded-xl border border-border-subtle bg-surface-2/35 px-3 py-2" open>
          <summary className="cursor-pointer text-xs font-medium text-text-secondary">{t('common.advanced', 'Advanced')}</summary>
          <div className="mt-3 space-y-3">
            {supportsConditions ? (<div>
              <label className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineRunIf', 'Run if (condition)')}</label>
              <UiInput value={step.runIf ?? ''} onChange={(event) => onUpdateStep(stepIndex, { runIf: event.target.value })} placeholder={t('agents.pipelineRunIfPlaceholder', "step1.status == 'success' && previous.output contains 'approved'")} wrapperClassName="w-full" controlClassName="rounded-2xl border border-border bg-surface-1 px-3 py-2 font-mono text-xs text-text-primary"/>
              <div className="mt-1 text-[11px] text-text-muted">{t('agents.pipelineRunIfHint', 'Skip this step when the condition is false. Supports step{N}.field, previous.field, vars.name, ==, !=, contains, not contains, matches, is empty, is not empty, combined with &&.')}</div>
            </div>) : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                <Checkbox checked={step.continueOnError !== false} onChange={(v) => onUpdateStep(stepIndex, { continueOnError: v })} color="blue" />
                {t('agents.pipelineContinueOnError', 'Continue on error')}
              </label>
              <label className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                <span>{t('agents.pipelineRetryCount', 'Retries')}</span>
                <UiInput type="number" min={0} max={3} value={normalizeRetryCount(step.retryCount)} onChange={(event) => onUpdateStep(stepIndex, { retryCount: normalizeRetryCount(Number(event.target.value)) })} wrapperClassName="w-16" controlClassName="h-8 rounded-xl border border-border bg-surface-1 px-2 text-right text-xs text-text-primary"/>
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                <span>{t('agents.pipelineRetryBackoff', 'Retry backoff (ms)')}</span>
                <UiInput type="number" min={0} max={60000} value={step.retryBackoffMs ?? ''} onChange={(event) => {
                  const raw = event.target.value
                  onUpdateStep(stepIndex, { retryBackoffMs: raw === '' ? undefined : Math.max(0, Math.trunc(Number(raw))) })
                }} placeholder="0" wrapperClassName="w-24" controlClassName="h-8 rounded-xl border border-border bg-surface-1 px-2 text-right text-xs text-text-primary"/>
              </label>
              <label className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                <span>{t('agents.pipelineRetryStrategy', 'Retry strategy')}</span>
                <UiSelect value={step.retryBackoffStrategy ?? 'fixed'} onChange={(event) => onUpdateStep(stepIndex, { retryBackoffStrategy: event.target.value === 'exponential' ? 'exponential' : 'fixed' })} controlClassName="h-8 rounded-xl border border-border bg-surface-1 px-2 text-xs text-text-primary">
                  <option value="fixed">{t('agents.pipelineRetryStrategyFixed', 'Fixed')}</option>
                  <option value="exponential">{t('agents.pipelineRetryStrategyExponential', 'Exponential')}</option>
                </UiSelect>
              </label>
            </div>

            {nodeTypeIsStructural(nodeType) ? null : <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                <span>{t('agents.pipelineStepModel', 'Model override')}</span>
                <UiSelect value={step.modelId ?? ''} onChange={(event) => onUpdateStep(stepIndex, { modelId: event.target.value || undefined })} wrapperClassName="max-w-40" controlClassName="h-8 rounded-xl border border-border bg-surface-1 px-2 text-xs text-text-primary">
                  <option value="">{t('agents.pipelineStepModelDefault', 'Use agent default')}</option>
                  {models.map((modelOption) => (<option key={modelOption.id} value={modelOption.id} disabled={modelOption.enabled === false}>
                      {modelOption.name}{modelOption.enabled === false ? ` (${t('common.disabled', 'disabled')})` : ''}
                    </option>))}
                </UiSelect>
              </label>
              <label className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                <span>{t('agents.pipelineStepOutputTransform', 'Output transform')}</span>
                <UiSelect value={step.outputTransform ?? ''} onChange={(event) => {
                  const next = event.target.value as AgentPipelineStep['outputTransform'] | ''
                  onUpdateStep(stepIndex, {
                    outputTransform: next || undefined,
                    ...(next !== 'json-path' ? { outputTransformPath: undefined } : {}),
                  })
                }} wrapperClassName="max-w-40" controlClassName="h-8 rounded-xl border border-border bg-surface-1 px-2 text-xs text-text-primary">
                  <option value="">{t('agents.pipelineStepOutputTransformNone', 'None')}</option>
                  <option value="trim">{t('agents.pipelineStepOutputTransformTrim', 'Trim whitespace')}</option>
                  <option value="first-line">{t('agents.pipelineStepOutputTransformFirstLine', 'First line')}</option>
                  <option value="last-line">{t('agents.pipelineStepOutputTransformLastLine', 'Last line')}</option>
                  <option value="json-path">{t('agents.pipelineStepOutputTransformJsonPath', 'JSON path')}</option>
                </UiSelect>
              </label>
            </div>}

            {!nodeTypeIsStructural(nodeType) && step.outputTransform === 'json-path' ? (<div>
                <label className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                  <span>{t('agents.pipelineStepOutputTransformPath', 'JSON path')}</span>
                  <UiInput type="text" value={step.outputTransformPath ?? ''} onChange={(event) => onUpdateStep(stepIndex, { outputTransformPath: event.target.value || undefined })} placeholder="data.items.0.name" wrapperClassName="w-56" controlClassName="h-8 rounded-xl border border-border bg-surface-1 px-2 text-right text-xs text-text-primary"/>
                </label>
              </div>) : null}

            {nodeTypeIsStructural(nodeType) ? null : <div>
              <label className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                <span>{t('agents.pipelineStepExportVar', 'Export to variable')}</span>
                <UiInput type="text" value={step.exportVar ?? ''} onChange={(event) => onUpdateStep(stepIndex, { exportVar: event.target.value || undefined })} placeholder={t('agents.pipelineStepExportVarPlaceholder', 'e.g. topic')} wrapperClassName="w-56" controlClassName="h-8 rounded-xl border border-border bg-surface-1 px-2 text-right text-xs text-text-primary"/>
              </label>
            </div>}

            <div className={`grid gap-2 ${nodeTypeIsStructural(nodeType) ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
              <label className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                <span>{t('agents.pipelineStepTimeout', 'Timeout ms')}</span>
                <UiInput type="number" min={1000} value={step.timeoutMs ?? ''} onChange={(event) => onUpdateStep(stepIndex, { timeoutMs: event.target.value ? Math.max(1000, Number(event.target.value)) : undefined })} placeholder="300000" wrapperClassName="w-24" controlClassName="h-8 rounded-xl border border-border bg-surface-1 px-2 text-right text-xs text-text-primary"/>
              </label>
              {!nodeTypeIsStructural(nodeType) ? <label className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                <span>{t('agents.pipelineMaxInput', 'Max input')}</span>
                <UiInput type="number" min={1000} value={step.maxInputChars ?? ''} onChange={(event) => onUpdateStep(stepIndex, { maxInputChars: event.target.value ? Math.max(1000, Number(event.target.value)) : undefined })} placeholder="80000" wrapperClassName="w-24" controlClassName="h-8 rounded-xl border border-border bg-surface-1 px-2 text-right text-xs text-text-primary"/>
              </label> : null}
              {!nodeTypeIsStructural(nodeType) ? <label className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface-2/55 px-3 py-2 text-xs font-medium text-text-secondary">
                <span>{t('agents.pipelineMaxOutput', 'Max output')}</span>
                <UiInput type="number" min={1000} value={step.maxOutputChars ?? ''} onChange={(event) => onUpdateStep(stepIndex, { maxOutputChars: event.target.value ? Math.max(1000, Number(event.target.value)) : undefined })} placeholder="32000" wrapperClassName="w-24" controlClassName="h-8 rounded-xl border border-border bg-surface-1 px-2 text-right text-xs text-text-primary"/>
              </label> : null}
            </div>

            {stepIndex > 0 && !nodeTypeIsStructural(nodeType) ? (<div className="rounded-2xl border border-dashed border-border-subtle bg-surface-2/45 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineReferences', 'Step references')}</div>
                    <div className="mt-1 text-xs text-text-muted">{t('agents.pipelineReferencesHint', 'Insert upstream outputs into this task with template tokens before the step runs.')}</div>
                  </div>
                  {usesReferences ? <span className="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-medium text-accent">{t('agents.pipelineTemplateEnabled', 'Template active')}</span> : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {referenceTokens.map((reference) => (<UiButton unstyled key={`${stepIndex}-${reference.token}`} type="button" onClick={() => onAppendReference(stepIndex, reference.token)} className="rounded-full border border-border-subtle bg-surface-1/80 px-2.5 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:border-accent/30 hover:bg-accent/8 hover:text-accent">
                      {reference.label}: {reference.token}
                    </UiButton>))}
                </div>
              </div>) : null}

            {stepIndex > 0 && !nodeTypeIsStructural(nodeType) ? (<div className="rounded-2xl border border-dashed border-border-subtle bg-surface-2/60 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelinePreviousResult', 'Previous step result')}</div>
                <div className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap text-sm text-text-secondary">
                  {previousOutput || t('agents.pipelineAwaitingPreviousResult', 'Run the pipeline to preview what this step receives from upstream.')}
                </div>
              </div>) : null}

            {previewStep?.output ? (<div className="rounded-2xl border border-border-subtle bg-surface-2/40 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{t('agents.pipelineLatestOutput', 'Latest output')}</div>
                  <div className="text-[11px] text-text-muted">{formatDuration(previewStep.durationMs, t)}</div>
                </div>
                <div className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap text-sm text-text-secondary">{previewStep.output}</div>
              </div>) : null}
          </div>
        </details>
      </div>
    </section>
  )
}
