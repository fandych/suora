import { PlusIcon, SaveIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { useAppIntl } from "@/lib/i18n"
import { createChangedKindConfig } from "@/pages/integrations/components/integration-editor-utils"
import type {
  HttpIntegrationConfig,
  IntegrationConfig,
  McpIntegrationConfig,
  ScriptIntegrationConfig,
} from "@/types/integration"

type IntegrationBasicEditorProps = {
  config: IntegrationConfig
  title: string
  onChange: (config: IntegrationConfig) => void
  onTitleChange: (value: string) => void
  onSave: () => void
  saveDisabled: boolean
}

export function IntegrationBasicEditor({
  config,
  title,
  onChange,
  onTitleChange,
  onSave,
  saveDisabled,
}: IntegrationBasicEditorProps) {
  const { t } = useAppIntl()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("integrations.basic.title", "Basic information")}</CardTitle>
        <CardDescription>
          {t("integrations.basic.description", "Set the toolset identity and shared connection settings.")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">{t("integrations.basic.name", "Name")}</div>
            <Input value={title} onChange={(event) => onTitleChange(event.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">{t("integrations.basic.kind", "Kind")}</div>
            <NativeSelect
              value={config.kind}
              onChange={(event) =>
                onChange(createChangedKindConfig(event.target.value as IntegrationConfig["kind"], config))
              }
            >
              <NativeSelectOption value="http">{t("integrations.basic.kind.http", "HTTP")}</NativeSelectOption>
              <NativeSelectOption value="scripts">{t("integrations.basic.kind.scripts", "Scripts")}</NativeSelectOption>
              <NativeSelectOption value="mcp">{t("integrations.basic.kind.mcp", "MCP")}</NativeSelectOption>
            </NativeSelect>
          </div>
        </div>

        {config.kind === "http" ? <HttpConnectionFields config={config} onChange={onChange} /> : null}
        {config.kind === "mcp" ? <McpConnectionFields config={config} onChange={onChange} /> : null}
        {config.kind === "scripts" ? <ScriptRuntimeFields config={config} onChange={onChange} /> : null}
      </CardContent>
      <CardFooter className="justify-end border-t pt-4">
        <Button size="sm" onClick={onSave} disabled={saveDisabled}>
          <SaveIcon />
          {t("integrations.basic.save", "Save")}
        </Button>
      </CardFooter>
    </Card>
  )
}

function parseAuthConfig(config: HttpIntegrationConfig) {
  try {
    return JSON.parse(config.authConfigJson || "{}") as Record<string, string | Record<string, string>>
  } catch {
    return {}
  }
}

function getSharedHeaders(
  authConfig: Record<string, string | Record<string, string>>,
  authType: HttpIntegrationConfig["authType"],
) {
  if (authConfig.headers && typeof authConfig.headers === "object") {
    return authConfig.headers as Record<string, string>
  }

  if (authType === "custom") {
    return Object.fromEntries(Object.entries(authConfig).filter(([, value]) => typeof value === "string")) as Record<
      string,
      string
    >
  }

  return {}
}

function updateHttpAuthConfig(
  config: HttpIntegrationConfig,
  onChange: (config: IntegrationConfig) => void,
  next: Record<string, string>,
) {
  onChange({
    ...config,
    authConfigJson: JSON.stringify(next, null, 2),
  })
}

function updateSharedHeaders(
  config: HttpIntegrationConfig,
  onChange: (config: IntegrationConfig) => void,
  headers: Record<string, string>,
) {
  const authConfig = parseAuthConfig(config)
  const rest = Object.fromEntries(Object.entries(authConfig).filter(([key]) => key !== "headers"))
  const next = { ...rest, headers }
  if (config.authType === "custom") {
    onChange({ ...config, authConfigJson: JSON.stringify(headers, null, 2) })
    return
  }

  onChange({ ...config, authConfigJson: JSON.stringify(next, null, 2) })
}

function CustomHeadersEditor({
  headers,
  onChange,
}: {
  headers: Record<string, string>
  onChange: (headers: Record<string, string>) => void
}) {
  const { t } = useAppIntl()
  const entries = Object.entries(headers)

  const updateEntry = (index: number, field: "key" | "value", value: string) => {
    const nextEntries = entries.map(([key, headerValue], entryIndex) => {
      if (entryIndex !== index) {
        return [key, headerValue] as const
      }

      return field === "key" ? ([value, headerValue] as const) : ([key, value] as const)
    })

    onChange(Object.fromEntries(nextEntries))
  }

  const addEntry = () => {
    let nextKey = `X-Custom-Header-${entries.length + 1}`
    let suffix = entries.length + 1
    while (Object.prototype.hasOwnProperty.call(headers, nextKey)) {
      suffix += 1
      nextKey = `X-Custom-Header-${suffix}`
    }
    onChange({ ...headers, [nextKey]: "" })
  }

  const removeEntry = (keyToRemove: string) => {
    onChange(Object.fromEntries(entries.filter(([key]) => key !== keyToRemove)))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm text-muted-foreground">
            {t("integrations.basic.requestHeaders", "Request headers")}
          </div>
          <div className="text-xs text-muted-foreground">
            {t("integrations.basic.requestHeadersDescription", "Add shared request headers as key/value pairs.")}
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addEntry}>
          <PlusIcon />
          {t("integrations.basic.addHeader", "Add header")}
        </Button>
      </div>
      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {t("integrations.basic.noHeaders", "No custom headers.")}
        </div>
      ) : null}
      {entries.map(([key, value], index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Input
            value={key}
            onChange={(event) => updateEntry(index, "key", event.target.value)}
            placeholder={t("integrations.basic.headerName", "Header name")}
            aria-label={t("integrations.basic.headerNameIndex", "Header name {index}", { index: index + 1 })}
          />
          <Input
            value={value}
            onChange={(event) => updateEntry(index, "value", event.target.value)}
            placeholder={t("integrations.basic.headerValue", "Header value")}
            aria-label={t("integrations.basic.headerValueIndex", "Header value {index}", { index: index + 1 })}
          />
          <Button
            type="button"
            size="icon-sm"
            variant="destructive"
            aria-label={t("integrations.basic.deleteHeader", "Delete header {name}", { name: key || index + 1 })}
            title={t("integrations.basic.deleteHeaderAction", "Delete header")}
            onClick={() => removeEntry(key)}
          >
            <Trash2Icon />
          </Button>
        </div>
      ))}
    </div>
  )
}

function HttpConnectionFields({
  config,
  onChange,
}: {
  config: HttpIntegrationConfig
  onChange: (config: IntegrationConfig) => void
}) {
  const { t } = useAppIntl()
  const authConfig = parseAuthConfig(config)

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">{t("integrations.basic.http.description", "Description")}</div>
        <Textarea
          value={config.description}
          onChange={(event) => onChange({ ...config, description: event.target.value })}
          rows={4}
        />
      </div>
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">{t("integrations.basic.http.baseUrl", "Base URL")}</div>
        <Input
          value={config.baseUrl}
          onChange={(event) => onChange({ ...config, baseUrl: event.target.value })}
          placeholder={t("integrations.basic.http.baseUrlPlaceholder", "https://api.example.com")}
        />
      </div>
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">
          {t("integrations.basic.http.authorization", "Authorization")}
        </div>
        <NativeSelect
          value={config.authType}
          onChange={(event) =>
            onChange({ ...config, authType: event.target.value as HttpIntegrationConfig["authType"] })
          }
        >
          <NativeSelectOption value="none">{t("integrations.basic.http.auth.none", "None")}</NativeSelectOption>
          <NativeSelectOption value="bearer">
            {t("integrations.basic.http.auth.bearer", "Bearer token")}
          </NativeSelectOption>
          <NativeSelectOption value="basic">{t("integrations.basic.http.auth.basic", "Basic auth")}</NativeSelectOption>
          <NativeSelectOption value="api-key">{t("integrations.basic.http.auth.apiKey", "API key")}</NativeSelectOption>
          <NativeSelectOption value="custom">
            {t("integrations.basic.http.auth.custom", "Custom headers")}
          </NativeSelectOption>
        </NativeSelect>
      </div>
      {config.authType === "bearer" ? (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            {t("integrations.basic.http.auth.bearerToken", "Bearer token")}
          </div>
          <Input
            value={typeof authConfig.token === "string" ? authConfig.token : ""}
            onChange={(event) => updateHttpAuthConfig(config, onChange, { token: event.target.value })}
            placeholder={t("integrations.basic.http.auth.tokenPlaceholder", "token")}
          />
        </div>
      ) : null}
      {config.authType === "basic" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              {t("integrations.basic.http.auth.username", "Username")}
            </div>
            <Input
              value={typeof authConfig.username === "string" ? authConfig.username : ""}
              onChange={(event) =>
                updateHttpAuthConfig(config, onChange, { ...authConfig, username: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              {t("integrations.basic.http.auth.password", "Password")}
            </div>
            <Input
              value={typeof authConfig.password === "string" ? authConfig.password : ""}
              onChange={(event) =>
                updateHttpAuthConfig(config, onChange, { ...authConfig, password: event.target.value })
              }
            />
          </div>
        </div>
      ) : null}
      {config.authType === "api-key" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              {t("integrations.basic.http.auth.location", "Location")}
            </div>
            <NativeSelect
              value={typeof authConfig.location === "string" ? authConfig.location : "header"}
              onChange={(event) =>
                updateHttpAuthConfig(config, onChange, { ...authConfig, location: event.target.value })
              }
            >
              <NativeSelectOption value="header">
                {t("integrations.basic.http.auth.location.header", "Header")}
              </NativeSelectOption>
              <NativeSelectOption value="query">
                {t("integrations.basic.http.auth.location.query", "Query")}
              </NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">{t("integrations.basic.http.auth.keyName", "Key name")}</div>
            <Input
              value={typeof authConfig.name === "string" ? authConfig.name : "x-api-key"}
              onChange={(event) => updateHttpAuthConfig(config, onChange, { ...authConfig, name: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">{t("integrations.basic.http.auth.value", "Value")}</div>
            <Input
              value={typeof authConfig.value === "string" ? authConfig.value : ""}
              onChange={(event) => updateHttpAuthConfig(config, onChange, { ...authConfig, value: event.target.value })}
            />
          </div>
        </div>
      ) : null}
      <CustomHeadersEditor
        headers={getSharedHeaders(authConfig, config.authType)}
        onChange={(next) => updateSharedHeaders(config, onChange, next)}
      />
    </div>
  )
}

function McpConnectionFields({
  config,
  onChange,
}: {
  config: McpIntegrationConfig
  onChange: (config: IntegrationConfig) => void
}) {
  const { t } = useAppIntl()

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">{t("integrations.basic.mcp.description", "Description")}</div>
        <Textarea
          value={config.description}
          onChange={(event) => onChange({ ...config, description: event.target.value })}
          rows={4}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">{t("integrations.basic.mcp.endpoint", "Endpoint")}</div>
          <Input value={config.endpoint} onChange={(event) => onChange({ ...config, endpoint: event.target.value })} />
        </div>
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            {t("integrations.basic.mcp.launchCommand", "Launch command")}
          </div>
          <Input
            value={config.launchCommand}
            onChange={(event) => onChange({ ...config, launchCommand: event.target.value })}
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">{t("integrations.basic.mcp.protocols", "Protocols")}</div>
          <Input
            value={config.protocols.join(", ")}
            onChange={(event) =>
              onChange({
                ...config,
                protocols: event.target.value
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">{t("integrations.basic.mcp.authModes", "Auth modes")}</div>
          <Input
            value={config.authModes.join(", ")}
            onChange={(event) =>
              onChange({
                ...config,
                authModes: event.target.value
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">
          {t("integrations.basic.mcp.authConfigJson", "Auth config JSON")}
        </div>
        <Textarea
          value={config.authConfigJson}
          onChange={(event) => onChange({ ...config, authConfigJson: event.target.value })}
          rows={6}
          className="font-mono"
        />
      </div>
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">
          {t("integrations.basic.mcp.toolCatalogJson", "Tool catalog JSON")}
        </div>
        <Textarea
          value={config.toolCatalogJson}
          onChange={(event) => onChange({ ...config, toolCatalogJson: event.target.value })}
          rows={8}
          className="font-mono"
          placeholder={t(
            "integrations.basic.mcp.toolCatalogPlaceholder",
            '[{ "name": "listRepositories", "description": "List repos" }]',
          )}
        />
      </div>
    </div>
  )
}

function ScriptRuntimeFields({
  config,
  onChange,
}: {
  config: ScriptIntegrationConfig
  onChange: (config: IntegrationConfig) => void
}) {
  const { t } = useAppIntl()

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">
          {t("integrations.basic.scripts.description", "Description")}
        </div>
        <Textarea
          value={config.description}
          onChange={(event) => onChange({ ...config, description: event.target.value })}
          rows={4}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">{t("integrations.basic.scripts.runtime", "Runtime")}</div>
          <Input value={config.runtime} onChange={(event) => onChange({ ...config, runtime: event.target.value })} />
        </div>
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">{t("integrations.basic.scripts.timeoutMs", "Timeout ms")}</div>
          <Input
            type="number"
            value={String(config.timeoutMs)}
            onChange={(event) => onChange({ ...config, timeoutMs: Number(event.target.value) || 0 })}
          />
        </div>
      </div>
    </div>
  )
}
