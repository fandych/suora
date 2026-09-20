export type RecentlyDeletedResourceKind = "chat" | "document" | "workflow"

export type RecentlyDeletedResourceSnapshot =
  | {
      kind: "chat"
      snapshot: {
        chat: { id: string; title: string; chatbotId: string; summary: string; updatedAt: number; sourceType?: "manual" | "channel"; sourceRef?: string | null }
        messages: Array<{ id: string; role: "user" | "assistant" | "system"; content: string; createdAt: number; parts?: unknown[] }>
        nextCursor?: { createdAt: number; id: string } | null
      }
    }
  | {
      kind: "document"
      snapshot: {
        document: { id: string; title: string; summary: string; enabled: boolean; updatedAt: number }
        versions: Array<{ id: string; major: number; minor: number; isRelease: boolean; createdAt: number; structureJson: string; graphJson: string; settingsJson: string }>
        selectedVersionId: string | null
      }
    }
  | {
      kind: "workflow"
      snapshot: {
        workflow: { id: string; title: string; summary: string; enabled: boolean; updatedAt: number }
        versions: Array<{ id: string; workflowId: string; major: number; minor: number; isRelease: boolean; definitionJson: string; createdAt: number }>
        invocations: Array<{ id: string; workflowId: string; versionId: string; status: string; trigger: string; inputJson: string; outputJson: string; traceJson: string; createdAt: number }>
      }
    }

export type RecentlyDeletedResourceEntry = {
  entryId: string
  resourceId: string
  kind: RecentlyDeletedResourceKind
  title: string
  deletedAt: number
}

export type RecentlyDeletedRestoreResult = {
  entryId: string
  resourceId: string
  kind: RecentlyDeletedResourceKind
}