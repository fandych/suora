export type SkillFileRecord = {
  path: string
  content: string
  language: string
  kind?: "file" | "directory"
  executable?: boolean
}
export type ResourceFileType = "directory" | "markdown" | "script" | "data" | "image" | "binary"
export type SkillFileTreeNode = {
  fileName: string
  filePath: string
  fileType: ResourceFileType
  children?: SkillFileTreeNode[]
}
export type SkillFileTree = {
  skillId: string
  skillName: string
  description: string
  children: SkillFileTreeNode[]
}
export type SkillFileContent = {
  skillId: string
  skillName: string
  description: string
  fileName: string
  filePath: string
  fileContent: string
  fileType: ResourceFileType
  lastModifyDate: number
}
export type SkillSummary = { id: string; title: string; source: string; summary: string; updatedAt: number }
export type SkillDetail = {
  skill: SkillSummary
  files: SkillFileRecord[]
}
export type DocumentPageRecord = {
  id: string
  title: string
  content: string
  type?: "document" | "folder"
  parentId?: string | null
}
export type DocumentGraphEdge = {
  id: string
  source: string
  target: string
  label: string
  status: "pending" | "approved" | "rejected"
  confidence: number
}
export type DocumentSettings = { isPublic: boolean; includeInLlmsTxt: boolean }
export type DocumentSummary = { id: string; title: string; summary: string; enabled: boolean; updatedAt: number }
export type DocumentDetail = {
  document: DocumentSummary
  versions: VersionOption[]
  latestVersion: VersionOption
  selectedVersion: VersionOption
  pages: DocumentPageRecord[]
  graphEdges: DocumentGraphEdge[]
  settings: DocumentSettings
}
export type DocumentFileTreeNode = {
  fileName: string
  fileId: string
  fileType: "directory" | "document"
  children?: DocumentFileTreeNode[]
}
export type DocumentFileTree = {
  documentId: string
  documentName: string
  description: string
  children: DocumentFileTreeNode[]
}
export type DocumentFileContent = {
  documentId: string
  documentName: string
  description: string
  fileId: string
  fileName: string
  fileContent: string
  fileType: "directory" | "document"
  lastModifyDate: number
}
