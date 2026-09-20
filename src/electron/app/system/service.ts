import { restoreChatSnapshot } from "@/electron/app/chats/repository"
import { restoreDocumentSnapshot } from "@/electron/app/documents/repository"
import {
  claimRecentlyDeletedResource,
  clearRecentlyDeletedResourceRestore,
  listRecentlyDeletedResources,
  removeRecentlyDeletedResource,
} from "@/electron/app/system/system-repository"
import {
  chatSnapshotSchema,
  documentSnapshotSchema,
  workflowSnapshotSchema,
} from "@/electron/app/system/recently-deleted-schemas"
import { restoreWorkflowSnapshot } from "@/electron/app/workflows/repository"
import type { RecentlyDeletedResourceEntry, RecentlyDeletedRestoreResult } from "@/types/system"

export const systemService = {
  listRecentlyDeleted: (kind?: RecentlyDeletedResourceEntry["kind"]) => listRecentlyDeletedResources(kind),
  async restoreRecentlyDeleted(entryId: string): Promise<RecentlyDeletedRestoreResult> {
    const claim = await claimRecentlyDeletedResource(entryId)
    if (claim.status === "missing") {
      console.warn(`Recently deleted restore requested for missing entry '${entryId}'.`)
      throw new Error("Recently deleted snapshot was not found.")
    }
    if (claim.status === "restoring") {
      console.warn(`Recently deleted restore requested while entry '${entryId}' is already restoring.`)
      throw new Error("This resource is already being restored.")
    }

    const entry = claim.entry
    try {
      if (entry.kind === "chat") {
        await restoreChatSnapshot(chatSnapshotSchema.parse(entry.snapshot))
      } else if (entry.kind === "document") {
        await restoreDocumentSnapshot(documentSnapshotSchema.parse(entry.snapshot))
      } else {
        await restoreWorkflowSnapshot(workflowSnapshotSchema.parse(entry.snapshot))
      }

      await removeRecentlyDeletedResource(entry.entryId)
      return { entryId: entry.entryId, resourceId: entry.resourceId, kind: entry.kind }
    } catch (error) {
      await clearRecentlyDeletedResourceRestore(entry.entryId)
      if (error instanceof Error) {
        throw new Error(`Restore failed: ${error.message}`, { cause: error })
      }
      throw error
    }
  },
}