import type { VersionOption } from "@/data/domain/version-models"

export type SkillFileRecord = { path: string; content: string; language: string; kind?: "file" | "directory"; executable?: boolean }
export type SkillSummary = { id: string; title: string; source: string; summary: string; updatedAt: number }
export type SkillDetail = { skill: SkillSummary; versions: VersionOption[]; latestVersion: VersionOption; selectedVersion: VersionOption; files: SkillFileRecord[] }
export type DocumentPageRecord = { id: string; title: string; content: string; type?: "document" | "folder"; parentId?: string | null }
export type DocumentGraphEdge = { id: string; source: string; target: string; label: string; status: "pending" | "approved" | "rejected"; confidence: number }
export type DocumentSettings = { isPublic: boolean; includeInLlmsTxt: boolean }
export type DocumentSummary = { id: string; title: string; summary: string; enabled: boolean; updatedAt: number }
export type DocumentDetail = { document: DocumentSummary; versions: VersionOption[]; latestVersion: VersionOption; selectedVersion: VersionOption; pages: DocumentPageRecord[]; graphEdges: DocumentGraphEdge[]; settings: DocumentSettings }
