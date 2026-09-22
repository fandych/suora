import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useAppIntl } from "@/lib/i18n"
import type { HttpIntegrationConfig, IntegrationTryRunResult, ScriptIntegrationConfig } from "@/types/integration"
import { IntegrationHttpTryRunForm } from "@/pages/integrations/components/integration-http-try-run-form"

type IntegrationTryRunSheetProps = {
  input: string
  isOpen: boolean
  isRunning: boolean
  result: IntegrationTryRunResult | null
  httpConfig?: HttpIntegrationConfig
  scriptConfig?: ScriptIntegrationConfig
  onChangeInput: (value: string) => void
  onOpenChange: (open: boolean) => void
  onRun: () => void
}

type ScriptInputField = { key: string; type: string; description: string }

function readScriptInputFields(schemaText: string): ScriptInputField[] {
  try {
    const schema = JSON.parse(schemaText || "{}") as {
      properties?: Record<string, { type?: string; description?: string }>
    }
    return Object.entries(schema.properties ?? {}).map(([key, value]) => ({
      key,
      type: value.type ?? "string",
      description: value.description ?? "",
    }))
  } catch {
    return []
  }
}

function readInputValues(input: string): Record<string, unknown> {
  try {
    const value = JSON.parse(input) as unknown
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function coerceInputValue(value: string, type: string) {
  if (type === "number") return Number(value) || 0
  if (type === "boolean") return value === "true"
  if (type === "array" || type === "object") {
    try {
      return JSON.parse(value)
    } catch {
      return type === "array" ? [] : {}
    }
  }
  return value
}

function toDisplayValue(value: unknown) {
  if (value === undefined) return ""
  return typeof value === "string" ? value : JSON.stringify(value)
}

function formatTextBlock(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null
  }

  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }

  return JSON.stringify(value, null, 2)
}

function getResultVariant(result: IntegrationTryRunResult) {
  return result.ok ? "default" : "destructive"
}

function getResultLabel(result: IntegrationTryRunResult) {
  return result.ok ? "success" : "failed"
}

export function IntegrationTryRunSheet({
  input,
  isOpen,
  isRunning,
  result,
  httpConfig,
  scriptConfig,
  onChangeInput,
  onOpenChange,
  onRun,
}: IntegrationTryRunSheetProps) {
  const { t } = useAppIntl()
  const scriptInputFields = scriptConfig ? readScriptInputFields(scriptConfig.inputSchemaJson) : []
  const inputValues = readInputValues(input)

  const updateScriptInput = (field: ScriptInputField, value: string) => {
    onChangeInput(JSON.stringify({ ...inputValues, [field.key]: coerceInputValue(value, field.type) }, null, 2))
  }

  const resultDetails = result?.errorMessage || result?.response?.body || result?.body || ""
  const requestBody = formatTextBlock(result?.request?.body)
  const responseBody = formatTextBlock(result?.response?.json ?? result?.response?.body ?? result?.body)
  const rawInput = formatTextBlock(input)

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{t("integrations.tryRun.title", "Try run")}</SheetTitle>
          <SheetDescription>
            {scriptConfig
              ? t(
                  "integrations.tryRun.scriptDescription",
                  "Provide values defined by this script's input contract and inspect the latest output.",
                )
              : httpConfig
                ? t(
                    "integrations.tryRun.httpDescription",
                    "Provide values for the selected REST operation and inspect the generated request and response.",
                  )
                : t(
                    "integrations.tryRun.genericDescription",
                    "Execute the current draft with custom JSON input and inspect the latest output.",
                  )}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4 sm:px-5">
          <div className="space-y-4">
            {httpConfig ? (
              <IntegrationHttpTryRunForm config={httpConfig} input={input} onChangeInput={onChangeInput} />
            ) : scriptConfig ? (
              <div className="flex flex-col gap-3">
                {scriptInputFields.length ? (
                  scriptInputFields.map((field) => (
                    <div key={field.key} className="flex flex-col gap-2">
                      <div>
                        <div className="text-sm font-medium">{field.key}</div>
                        {field.description ? (
                          <div className="text-xs text-muted-foreground">{field.description}</div>
                        ) : null}
                      </div>
                      {field.type === "boolean" ? (
                        <NativeSelect
                          value={String(inputValues[field.key] ?? false)}
                          onChange={(event) => updateScriptInput(field, event.target.value)}
                        >
                          <NativeSelectOption value="false">false</NativeSelectOption>
                          <NativeSelectOption value="true">true</NativeSelectOption>
                        </NativeSelect>
                      ) : (
                        <Input
                          value={toDisplayValue(inputValues[field.key])}
                          type={field.type === "number" ? "number" : "text"}
                          placeholder={
                            field.type === "array" || field.type === "object"
                              ? t("integrations.tryRun.validJson", "Valid JSON {type}", { type: field.type })
                              : field.type
                          }
                          onChange={(event) => updateScriptInput(field, event.target.value)}
                        />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">
                    {t("integrations.tryRun.noScriptParameters", "This script has no input parameters.")}
                  </div>
                )}
              </div>
            ) : (
              <Textarea
                value={input}
                onChange={(event) => onChangeInput(event.target.value)}
                rows={12}
                className="font-mono"
              />
            )}

            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">{t("integrations.tryRun.latestResult", "Latest result")}</div>
                {result ? (
                  <Badge variant={getResultVariant(result)} className="uppercase">
                    {getResultLabel(result)}
                  </Badge>
                ) : null}
              </div>

              {isRunning ? (
                <div className="mt-3 rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">
                  {t("integrations.tryRun.running", "Running the current draft...")}
                </div>
              ) : result ? (
                <div className="mt-3 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoBlock
                      label={t("integrations.tryRun.status", "Status")}
                      value={result.status ? String(result.status) : t("integrations.tryRun.noStatus", "No status")}
                    />
                    <InfoBlock
                      label={t("integrations.tryRun.executedAt", "Executed at")}
                      value={new Date(result.executedAt).toLocaleString()}
                    />
                  </div>

                  {resultDetails ? (
                    <ResultBlock
                      label={t("integrations.tryRun.message", "Message")}
                      value={resultDetails}
                      tone={result.ok ? "success" : "error"}
                    />
                  ) : null}

                  {rawInput ? (
                    <ResultBlock label={t("integrations.tryRun.input", "Input")} value={rawInput} tone="neutral" />
                  ) : null}

                  {result.request ? (
                    <>
                      <div className="grid gap-3 md:grid-cols-2">
                        <InfoBlock
                          label={t("integrations.tryRun.requestMethod", "Request method")}
                          value={result.request.method}
                        />
                        <InfoBlock
                          label={t("integrations.tryRun.requestUrl", "Request URL")}
                          value={result.request.url}
                        />
                      </div>
                      <ResultBlock
                        label={t("integrations.tryRun.requestHeaders", "Request headers")}
                        value={formatTextBlock(result.request.headers) || "{}"}
                        tone="neutral"
                      />
                      {requestBody ? (
                        <ResultBlock
                          label={t("integrations.tryRun.requestBody", "Request body")}
                          value={requestBody}
                          tone="neutral"
                        />
                      ) : null}
                    </>
                  ) : null}

                  {result.response ? (
                    <>
                      <ResultBlock
                        label={t("integrations.tryRun.responseHeaders", "Response headers")}
                        value={formatTextBlock(result.response.headers) || "{}"}
                        tone="neutral"
                      />
                      {responseBody ? (
                        <ResultBlock
                          label={t("integrations.tryRun.responseBody", "Response body")}
                          value={responseBody}
                          tone={result.ok ? "success" : "error"}
                        />
                      ) : null}
                    </>
                  ) : responseBody ? (
                    <ResultBlock
                      label={t("integrations.tryRun.output", "Output")}
                      value={responseBody}
                      tone={result.ok ? "success" : "error"}
                    />
                  ) : null}
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">
                  {t("integrations.tryRun.empty", "No result yet. Run the current draft to inspect the latest output.")}
                </div>
              )}
            </div>
          </div>
        </div>
        <SheetFooter className="border-t">
          <Button onClick={onRun} disabled={isRunning}>
            {isRunning
              ? t("integrations.tryRun.runningButton", "Running...")
              : t("integrations.tryRun.run", "Run draft")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-all text-sm font-medium">{value}</div>
    </div>
  )
}

function ResultBlock({ label, value, tone }: { label: string; value: string; tone: "neutral" | "success" | "error" }) {
  const toneClassName =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "error"
        ? "border-destructive/30 bg-destructive/5 text-destructive"
        : "border-border bg-muted/20 text-foreground"

  return (
    <div className={`rounded-xl border p-3 ${toneClassName}`}>
      <div className="text-sm font-medium">{label}</div>
      <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs">{value}</pre>
    </div>
  )
}
