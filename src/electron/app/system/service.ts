import { restoreChatSnapshot } from "@/electron/app/chats/repository"
import { restoreDocumentSnapshot } from "@/electron/app/documents/repository"
import {
  getRecentlyDeletedResource,
  listRecentlyDeletedResources,
  removeRecentlyDeletedResource,
} from "@/electron/app/system/system-repository"
import { restoreWorkflowSnapshot } from "@/electron/app/workflows/repository"
import type { RecentlyDeletedResourceEntry, RecentlyDeletedRestoreResult } from "@/types/system"

export const systemService = {
  listRecentlyDeleted: (kind?: RecentlyDeletedResourceEntry["kind"]) => listRecentlyDeletedResources(kind),
  async restoreRecentlyDeleted(entryId: string): Promise<RecentlyDeletedRestoreResult> {
    const entry = await getRecentlyDeletedResource(entryId)
    if (!entry) throw new Error("Recently deleted snapshot was not found.")

    if (entry.kind === "chat") {
      await restoreChatSnapshot(entry.snapshot as Parameters<typeof restoreChatSnapshot>[0])
    } else if (entry.kind === "document") {
      await restoreDocumentSnapshot(entry.snapshot as Parameters<typeof restoreDocumentSnapshot>[0])
    } else {
      await restoreWorkflowSnapshot(entry.snapshot as Parameters<typeof restoreWorkflowSnapshot>[0])
    }

    await removeRecentlyDeletedResource(entry.entryId)
    return { entryId: entry.entryId, resourceId: entry.resourceId, kind: entry.kind }
  },
}