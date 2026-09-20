import type { RecentlyDeletedResourceEntry, RecentlyDeletedResourceKind, RecentlyDeletedRestoreResult } from "@/types/system"
import { requireAppBridge } from "@/services/bridge"

export const SystemApi = {
  info: () => requireAppBridge().system.info(),
  diagnostics: () => requireAppBridge().system.diagnostics(),
  listRecentlyDeleted: (kind?: RecentlyDeletedResourceKind) =>
    requireAppBridge().system.listRecentlyDeleted(kind) as Promise<RecentlyDeletedResourceEntry[]>,
  restoreRecentlyDeleted: (entryId: string) =>
    requireAppBridge().system.restoreRecentlyDeleted(entryId) as Promise<RecentlyDeletedRestoreResult>,
}