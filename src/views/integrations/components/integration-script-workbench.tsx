import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { IntegrationConfig, ScriptIntegrationConfig, ScriptWorkbenchItem } from "@/data/domain/models"

type IntegrationScriptWorkbenchProps = {
  config: ScriptIntegrationConfig
  canTryRun?: boolean
  onChange: (config: IntegrationConfig) => void
  onTryRun?: (scriptId: string) => void
}

export function IntegrationScriptWorkbench({ config, canTryRun = true, onChange, onTryRun }: IntegrationScriptWorkbenchProps) {
  const selectedScript = config.scripts.find((item) => item.id === config.selectedScriptId) ?? config.scripts[0]

  const updateSelectedScript = (patch: Partial<ScriptWorkbenchItem>) => {
    onChange({ ...config, scripts: config.scripts.map((script) => script.id === selectedScript.id ? { ...script, ...patch } : script) })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Script items</CardTitle>
        <CardDescription>Manage reusable script entries, edit the active one, and trigger try-run from the selected item.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2 rounded-xl border p-3">
          <div>
            <div className="font-medium">Scripts</div>
            <div className="text-sm text-muted-foreground">Manage reusable scripts inside this toolset.</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => onChange({ ...config, selectedScriptId: `script-${config.scripts.length + 1}`, scripts: [...config.scripts, { id: `script-${config.scripts.length + 1}`, name: `Script ${config.scripts.length + 1}`, handler: `script${config.scripts.length + 1}`, code: "export async function handler(input) {\n  return { ok: true, input }\n}\n" }] })}>Add script</Button>
        </div>

        <div className="grid gap-4 md:grid-cols-[0.78fr_1.22fr]">
          <div className="space-y-2 rounded-xl border p-3">
            {config.scripts.map((script) => (
              <div key={script.id} className={`rounded-lg border px-3 py-2 text-sm ${script.id === config.selectedScriptId ? "border-primary bg-primary/5" : "border-border"}`}>
                <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => onChange({ ...config, selectedScriptId: script.id })}>
                  <span>{script.name}</span>
                  <span className="text-xs text-muted-foreground">{script.handler}</span>
                </button>
                <div className="mt-2 flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => onChange({ ...config, selectedScriptId: script.id })}>Edit</Button>
                  <Button size="sm" variant="outline" disabled={!canTryRun} onClick={() => { onChange({ ...config, selectedScriptId: script.id }); onTryRun?.(script.id) }}>Try run</Button>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2"><div className="text-sm text-muted-foreground">Name</div><Input value={selectedScript?.name ?? ""} onChange={(event) => updateSelectedScript({ name: event.target.value })} /></div>
              <div className="space-y-2"><div className="text-sm text-muted-foreground">Handler</div><Input value={selectedScript?.handler ?? ""} onChange={(event) => updateSelectedScript({ handler: event.target.value })} /></div>
              <div className="space-y-2"><div className="text-sm text-muted-foreground">Timeout ms</div><Input type="number" value={String(config.timeoutMs)} onChange={(event) => onChange({ ...config, timeoutMs: Number(event.target.value) || 0 })} /></div>
            </div>
            <div className="space-y-2"><div className="text-sm text-muted-foreground">Code</div><Textarea value={selectedScript?.code ?? ""} onChange={(event) => updateSelectedScript({ code: event.target.value })} rows={16} className="font-mono" /></div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}