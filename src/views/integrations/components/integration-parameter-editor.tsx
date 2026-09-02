import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import type { HttpIntegrationConfig, IntegrationConfig, ScriptIntegrationConfig } from "@/data/domain/models"

type IntegrationParameterEditorProps = {
  config: IntegrationConfig
  onChange: (config: IntegrationConfig) => void
}

type SchemaField = { key: string; type: string; description: string }

function parseSchemaFields(schemaText: string): SchemaField[] {
  try {
    const parsed = JSON.parse(schemaText || "{}") as { properties?: Record<string, { type?: string; description?: string }> }
    return Object.entries(parsed.properties ?? {}).map(([key, value]) => ({ key, type: value.type ?? "string", description: value.description ?? "" }))
  } catch {
    return []
  }
}

function toSchemaJson(fields: SchemaField[]) {
  return JSON.stringify({ type: "object", properties: Object.fromEntries(fields.filter((field) => field.key.trim()).map((field) => [field.key, { type: field.type, description: field.description }])) }, null, 2)
}

function SchemaEditor({ label, schemaText, onSchemaChange }: { label: string; schemaText: string; onSchemaChange: (value: string) => void }) {
  const fields = parseSchemaFields(schemaText)
  const nextFields = fields.length ? fields : []

  const updateFields = (updated: SchemaField[]) => onSchemaChange(toSchemaJson(updated))

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="text-sm font-medium">{label}</div>
      <div className="space-y-2">
        {nextFields.map((field, index) => (
          <div key={`${field.key}-${index}`} className="grid gap-2 md:grid-cols-[1fr_10rem_1.4fr_auto]">
            <Input value={field.key} onChange={(event) => updateFields(nextFields.map((item, itemIndex) => itemIndex === index ? { ...item, key: event.target.value } : item))} placeholder="name" />
            <NativeSelect value={field.type} onChange={(event) => updateFields(nextFields.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value } : item))}>
              <NativeSelectOption value="string">string</NativeSelectOption>
              <NativeSelectOption value="number">number</NativeSelectOption>
              <NativeSelectOption value="boolean">boolean</NativeSelectOption>
              <NativeSelectOption value="array">array</NativeSelectOption>
              <NativeSelectOption value="object">object</NativeSelectOption>
            </NativeSelect>
            <Input value={field.description} onChange={(event) => updateFields(nextFields.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} placeholder="description" />
            <Button variant="outline" onClick={() => updateFields(nextFields.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => updateFields([...nextFields, { key: "", type: "string", description: "" }])}>Add field</Button>
      </div>
    </div>
  )
}

export function IntegrationParameterEditor({ config, onChange }: IntegrationParameterEditorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parameter editor</CardTitle>
        <CardDescription>Structured input and output contracts instead of raw JSON-only editing.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {config.kind === "http" ? <SchemaEditor label="Request parameters" schemaText={config.parameterSchemaJson} onSchemaChange={(value) => onChange({ ...(config as HttpIntegrationConfig), parameterSchemaJson: value })} /> : null}
        {config.kind === "scripts" ? <>
          <SchemaEditor label="Input contract" schemaText={config.inputSchemaJson} onSchemaChange={(value) => onChange({ ...(config as ScriptIntegrationConfig), inputSchemaJson: value })} />
          <SchemaEditor label="Output contract" schemaText={config.outputSchemaJson} onSchemaChange={(value) => onChange({ ...(config as ScriptIntegrationConfig), outputSchemaJson: value })} />
        </> : null}
      </CardContent>
    </Card>
  )
}