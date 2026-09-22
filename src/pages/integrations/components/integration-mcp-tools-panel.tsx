import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAppIntl } from "@/lib/i18n"
import type { McpIntegrationConfig } from "@/types/integration"
import { readMcpTools } from "@/lib/integration"

type IntegrationMcpToolsPanelProps = {
  config: McpIntegrationConfig
}

export function IntegrationMcpToolsPanel({ config }: IntegrationMcpToolsPanelProps) {
  const { t } = useAppIntl()
  const tools = readMcpTools(config.toolCatalogJson)

  return (
    <Card className="min-h-0">
      <CardHeader>
        <CardTitle>{t("integrations.mcp.tools.title", "Readable tools")}</CardTitle>
        <CardDescription>
          {t("integrations.mcp.tools.description", "Parsed MCP tool entries from the current tool catalog JSON.")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-136 pr-2">
          <div className="space-y-3">
            {tools.length > 0 ? (
              tools.map((tool) => (
                <div key={tool.id} className="rounded-xl border p-3">
                  <div className="text-sm font-medium text-foreground">{tool.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {tool.description || t("integrations.mcp.tools.noDescription", "No description.")}
                  </div>
                  <pre className="mt-3 overflow-auto rounded-lg bg-muted/30 p-2 text-[11px] text-muted-foreground">
                    {tool.inputSchemaJson || "{}"}
                  </pre>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                {t(
                  "integrations.mcp.tools.empty",
                  "Paste tool metadata into the MCP tool catalog JSON field to inspect readable tools here.",
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
