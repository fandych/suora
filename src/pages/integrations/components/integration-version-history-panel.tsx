import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAppIntl } from "@/lib/i18n"
import type { IntegrationDetail } from "@/types/integration"

type IntegrationVersionHistoryPanelProps = {
  detail: IntegrationDetail
}

export function IntegrationVersionHistoryPanel({ detail }: IntegrationVersionHistoryPanelProps) {
  const { t } = useAppIntl()

  return (
    <Card className="h-full min-h-0">
      <CardHeader>
        <CardTitle>{t("integrations.history.title", "Connection / history")}</CardTitle>
        <CardDescription>
          {t("integrations.history.description", "Current endpoint summary and recent execution activity.")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <div className="text-muted-foreground">{t("integrations.history.endpoint", "Resolved endpoint")}</div>
          <div className="font-medium break-all">
            {detail.integration.endpoint || t("integrations.history.pending", "Pending config")}
          </div>
        </div>
        <div className="space-y-2 rounded-xl border p-3">
          <div className="font-medium">{t("integrations.history.executions", "Recent executions")}</div>
          <div className="space-y-2">
            {detail.executions.length ? (
              detail.executions.slice(0, 8).map((execution) => (
                <div key={execution.id} className="rounded-lg border px-3 py-2 text-xs">
                  <div>
                    <div className="font-medium text-foreground uppercase">{execution.status}</div>
                    <div className="text-muted-foreground">{new Date(execution.createdAt).toLocaleString()}</div>
                  </div>
                  <pre className="mt-2 overflow-auto whitespace-pre-wrap text-muted-foreground">{execution.output}</pre>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                {t("integrations.history.empty", "No executions yet.")}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
