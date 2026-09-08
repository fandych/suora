import { useEffect, useMemo, useState } from "react"
import { BotIcon, BracesIcon, WorkflowIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import type { AgentSummary, SchedulerDetail, WorkflowDetail, WorkflowSummary } from "@/data/domain/models"
import { getWorkflowDetail } from "@/data/repositories/workflow-repository"
import { readWorkflowSchemaParameters, type WorkflowSchemaParameter } from "@/views/workflows/components/workflow-schema-contract"

type SchedulerBindingPanelProps = {
  agents: AgentSummary[]
  draft: SchedulerDetail
  onChange: (next: SchedulerDetail) => void
  onTargetTypeChange: (targetType: SchedulerDetail["targetType"]) => void
  onTargetIdChange: (targetId: string) => void
  workflows: WorkflowSummary[]
}

type Payload = Record<string, unknown>

function readPayload(value: string): Payload {
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Payload : {}
  } catch {
    return {}
  }
}

function stringifyPayload(payload: Payload) {
  return JSON.stringify(payload, null, 2)
}

function readAgentPrompt(value: string) {
  const payload = readPayload(value)
  return typeof payload.prompt === "string" ? payload.prompt : ""
}

function parseFieldValue(value: string, parameter: WorkflowSchemaParameter): unknown {
  if (parameter.type === "number") return Number(value)
  if (parameter.type === "boolean") return value === "true"
  if (parameter.type === "object" || parameter.type === "array") {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  return value
}

function formatFieldValue(value: unknown, parameter: WorkflowSchemaParameter) {
  if (value === undefined) return parameter.defaultValue
  if (parameter.type === "object" || parameter.type === "array") return JSON.stringify(value, null, 2)
  return String(value)
}

function WorkflowInputFields({ draft, parameters, onChange }: { draft: SchedulerDetail; parameters: WorkflowSchemaParameter[]; onChange: (next: SchedulerDetail) => void }) {
  const payload = useMemo(() => readPayload(draft.inputPayloadJson), [draft.inputPayloadJson])

  if (parameters.length === 0) {
    return <Alert><BracesIcon /><AlertTitle>No declared inputs</AlertTitle><AlertDescription>This workflow has no inputs on its start node. It will run with an empty object.</AlertDescription></Alert>
  }

  const updateField = (parameter: WorkflowSchemaParameter, value: string) => {
    const nextPayload = { ...payload, [parameter.name]: parseFieldValue(value, parameter) }
    onChange({ ...draft, inputPayloadJson: stringifyPayload(nextPayload) })
  }

  return (
    <FieldGroup>
      {parameters.map((parameter) => {
        const value = formatFieldValue(payload[parameter.name], parameter)
        const fieldId = `scheduler-workflow-input-${parameter.id}`
        const supportsTextarea = parameter.type === "object" || parameter.type === "array"
        return (
          <Field key={parameter.id}>
            <FieldLabel htmlFor={fieldId}>{parameter.name}{parameter.required ? " *" : ""}<Badge variant="outline">{parameter.type}</Badge></FieldLabel>
            {parameter.type === "boolean" ? (
              <NativeSelect id={fieldId} value={value || "false"} onChange={(event) => updateField(parameter, event.target.value)}>
                <NativeSelectOption value="false">False</NativeSelectOption>
                <NativeSelectOption value="true">True</NativeSelectOption>
              </NativeSelect>
            ) : supportsTextarea ? (
              <Textarea id={fieldId} className="font-mono" value={value} onChange={(event) => updateField(parameter, event.target.value)} rows={4} placeholder={parameter.type === "array" ? "[]" : "{}"} />
            ) : (
              <Input id={fieldId} type={parameter.type === "number" ? "number" : "text"} value={value} onChange={(event) => updateField(parameter, event.target.value)} />
            )}
            {parameter.description ? <FieldDescription>{parameter.description}</FieldDescription> : null}
          </Field>
        )
      })}
    </FieldGroup>
  )
}

export function SchedulerBindingPanel({ agents, draft, onChange, onTargetIdChange, onTargetTypeChange, workflows }: SchedulerBindingPanelProps) {
  const [workflowDetail, setWorkflowDetail] = useState<WorkflowDetail | null>(null)
  const [isLoadingWorkflow, setIsLoadingWorkflow] = useState(false)
  const targetOptions = draft.targetType === "agent" ? agents : workflows
  const selectedTarget = targetOptions.find((item) => item.id === draft.targetId)

  useEffect(() => {
    if (draft.targetType !== "workflow" || !draft.targetId) {
      setWorkflowDetail(null)
      setIsLoadingWorkflow(false)
      return
    }

    let isActive = true
    setIsLoadingWorkflow(true)
    void getWorkflowDetail(draft.targetId)
      .then((detail) => {
        if (isActive) setWorkflowDetail(detail)
      })
      .catch(() => {
        if (isActive) setWorkflowDetail(null)
      })
      .finally(() => {
        if (isActive) setIsLoadingWorkflow(false)
      })

    return () => { isActive = false }
  }, [draft.targetId, draft.targetType])

  const inputSchema = workflowDetail?.definition.nodes.find((node) => node.data.kind === "start")?.data.inputSchemaJson
  const parameters = useMemo(() => readWorkflowSchemaParameters(inputSchema), [inputSchema])

  return (
    <Card className="h-full min-h-0">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Binding</CardTitle>
          <Badge variant="outline">{draft.targetType}</Badge>
        </div>
        <CardDescription>Select what this scheduler invokes and configure the invocation data.</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto">
        <FieldGroup>
          <div className="grid gap-5 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="scheduler-target-type">Target type</FieldLabel>
              <NativeSelect id="scheduler-target-type" value={draft.targetType} onChange={(event) => onTargetTypeChange(event.target.value as SchedulerDetail["targetType"])}>
                <NativeSelectOption value="workflow">Workflow</NativeSelectOption>
                <NativeSelectOption value="agent">Agent</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="scheduler-target">{draft.targetType === "workflow" ? "Workflow" : "Agent"}</FieldLabel>
              <NativeSelect id="scheduler-target" value={draft.targetId} onChange={(event) => onTargetIdChange(event.target.value)}>
                <NativeSelectOption value="">Select a target</NativeSelectOption>
                {targetOptions.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.title}</NativeSelectOption>)}
              </NativeSelect>
            </Field>
          </div>
        </FieldGroup>

        {draft.targetType === "workflow" ? (
          <>
            <Alert><WorkflowIcon /><AlertTitle>{selectedTarget?.title ?? "Workflow inputs"}</AlertTitle><AlertDescription>Fields are generated from the selected workflow’s start-node input schema.</AlertDescription></Alert>
            {isLoadingWorkflow ? <div className="text-sm text-muted-foreground">Loading workflow input contract…</div> : <WorkflowInputFields draft={draft} parameters={parameters} onChange={onChange} />}
          </>
        ) : (
          <>
            <Alert><BotIcon /><AlertTitle>{selectedTarget?.title ?? "Agent prompt"}</AlertTitle><AlertDescription>The selected agent owns its system prompt. Add the task, context, and any prompt instructions for this scheduled invocation below.</AlertDescription></Alert>
            <Field>
              <FieldLabel htmlFor="scheduler-agent-prompt">Invocation prompt</FieldLabel>
              <Textarea id="scheduler-agent-prompt" className="min-h-44 flex-1 font-mono" value={readAgentPrompt(draft.inputPayloadJson)} onChange={(event) => onChange({ ...draft, inputPayloadJson: stringifyPayload({ ...readPayload(draft.inputPayloadJson), prompt: event.target.value }) })} placeholder="Describe the task this agent should complete on each run." />
              <FieldDescription>Saved as the agent invocation payload. Do not put secrets in this field.</FieldDescription>
            </Field>
          </>
        )}
      </CardContent>
    </Card>
  )
}
