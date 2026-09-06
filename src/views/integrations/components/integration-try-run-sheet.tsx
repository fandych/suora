import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import type { HttpIntegrationConfig, IntegrationExecutionRecord, ScriptIntegrationConfig } from "@/data/domain/models"
import { IntegrationHttpTryRunForm } from "@/views/integrations/components/integration-http-try-run-form"

type IntegrationTryRunSheetProps = {
  executions: IntegrationExecutionRecord[]
  input: string
  isOpen: boolean
  isRunning: boolean
  httpConfig?: HttpIntegrationConfig
  scriptConfig?: ScriptIntegrationConfig
  onChangeInput: (value: string) => void
  onOpenChange: (open: boolean) => void
  onRun: () => void
}

type ScriptInputField = { key: string; type: string; description: string }

function readScriptInputFields(schemaText: string): ScriptInputField[] {
  try {
    const schema = JSON.parse(schemaText || "{}") as { properties?: Record<string, { type?: string; description?: string }> }
    return Object.entries(schema.properties ?? {}).map(([key, value]) => ({ key, type: value.type ?? "string", description: value.description ?? "" }))
  } catch {
    return []
  }
}

function readInputValues(input: string): Record<string, unknown> {
  try {
    const value = JSON.parse(input) as unknown
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function coerceInputValue(value: string, type: string) {
  if (type === "number") return Number(value) || 0
  if (type === "boolean") return value === "true"
  if (type === "array" || type === "object") {
    try { return JSON.parse(value) } catch { return type === "array" ? [] : {} }
  }
  return value
}

function toDisplayValue(value: unknown) {
  if (value === undefined) return ""
  return typeof value === "string" ? value : JSON.stringify(value)
}

export function IntegrationTryRunSheet({ executions, input, isOpen, isRunning, httpConfig, scriptConfig, onChangeInput, onOpenChange, onRun }: IntegrationTryRunSheetProps) {
  const scriptInputFields = scriptConfig ? readScriptInputFields(scriptConfig.inputSchemaJson) : []
  const inputValues = readInputValues(input)

  const updateScriptInput = (field: ScriptInputField, value: string) => {
    onChangeInput(JSON.stringify({ ...inputValues, [field.key]: coerceInputValue(value, field.type) }, null, 2))
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Try run</SheetTitle>
          <SheetDescription>{scriptConfig ? "Provide values defined by this script's input contract and inspect recent outputs." : httpConfig ? "Provide values for the selected REST operation and inspect the generated cURL request." : "Execute the current draft with custom JSON input and inspect recent outputs."}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4 sm:px-5">
          <div className="space-y-4">
            {httpConfig ? <IntegrationHttpTryRunForm config={httpConfig} input={input} onChangeInput={onChangeInput} /> : scriptConfig ? (
              <div className="flex flex-col gap-3">
                {scriptInputFields.length ? scriptInputFields.map((field) => (
                  <div key={field.key} className="flex flex-col gap-2">
                    <div><div className="text-sm font-medium">{field.key}</div>{field.description ? <div className="text-xs text-muted-foreground">{field.description}</div> : null}</div>
                    {field.type === "boolean" ? <NativeSelect value={String(inputValues[field.key] ?? false)} onChange={(event) => updateScriptInput(field, event.target.value)}><NativeSelectOption value="false">false</NativeSelectOption><NativeSelectOption value="true">true</NativeSelectOption></NativeSelect> : <Input value={toDisplayValue(inputValues[field.key])} type={field.type === "number" ? "number" : "text"} placeholder={field.type === "array" || field.type === "object" ? `Valid JSON ${field.type}` : field.type} onChange={(event) => updateScriptInput(field, event.target.value)} />}
                  </div>
                )) : <div className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">This script has no input parameters.</div>}
              </div>
            ) : <Textarea value={input} onChange={(event) => onChangeInput(event.target.value)} rows={12} className="font-mono" />}
            <div className="space-y-2">
              <div className="text-sm font-medium">Recent executions</div>
              {executions.length ? executions.slice(0, 8).map((execution) => (
                <div key={execution.id} className="rounded-xl border p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium uppercase text-foreground">{execution.status}</span>
                    <span className="text-muted-foreground">{new Date(execution.createdAt).toLocaleString()}</span>
                  </div>
                  <pre className="mt-2 overflow-auto whitespace-pre-wrap text-muted-foreground">{execution.output}</pre>
                </div>
              )) : <div className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">No executions yet.</div>}
            </div>
          </div>
        </div>
        <SheetFooter className="border-t">
          <Button onClick={onRun} disabled={isRunning}>{isRunning ? "Running..." : "Run draft"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}