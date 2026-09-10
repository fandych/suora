import type { DatabaseSync } from "node:sqlite"

export function assertIntegrationEnabled(database: DatabaseSync, integrationId: string) {
  const integration = database.prepare("SELECT enabled FROM integrations WHERE id = ?").get(integrationId) as { enabled?: number | boolean } | undefined
  if (!integration) {
    throw new Error("Integration not found")
  }
  if (!integration.enabled) {
    throw new Error("Integration is disabled")
  }
}
