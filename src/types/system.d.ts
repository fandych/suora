export type RecentlyDeletedResourceKind = "chat" | "document" | "workflow"

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