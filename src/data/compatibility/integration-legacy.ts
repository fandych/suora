import type { ScriptIntegrationConfig } from "@/data/domain/integration-models"

type LegacyScriptConfig = ScriptIntegrationConfig & { handler?: string; code?: string }

/**
 * Converts the pre-versioned `handler`/`code` shape into the current scripts
 * collection. Keep this adapter until all supported local databases have
 * passed the integration schema migration.
 */
export function normalizeLegacyScriptConfig(config: LegacyScriptConfig, fallback: ScriptIntegrationConfig): ScriptIntegrationConfig {
  const scripts = config.scripts?.length
    ? config.scripts
    : [{ id: "script-main", name: "Main Script", handler: config.handler || "main", code: config.code || fallback.scripts[0]?.code || "" }]
  return { ...fallback, ...config, scripts, selectedScriptId: config.selectedScriptId || scripts[0]?.id }
}