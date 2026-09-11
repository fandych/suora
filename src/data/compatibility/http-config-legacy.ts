import type { HttpIntegrationConfig } from "@/data/domain/integration-models"

/**
 * Compatibility boundary for databases written before endpoint-based HTTP
 * integrations. Remove when the minimum supported database version no longer
 * contains the top-level `url` field.
 */
export function getLegacyHttpUrl(config: Partial<HttpIntegrationConfig> & { url?: string }) {
  return config.url?.trim() || ""
}