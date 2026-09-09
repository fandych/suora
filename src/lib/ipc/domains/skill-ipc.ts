import type { SkillConfigRecord, SkillFileRecord, SkillSummary, VersionOption } from "@/data/domain/models"
import { getVersionLabel } from "@/data/domain/versioning"
import { getProjectBridge } from "@/lib/ipc/bridge"
import { parseArrayJson } from "@/lib/serialization/json"
type SkillVersionRow = { id: string; major: number; minor: number; isRelease: boolean; createdAt: number; filesJson: string }
type SkillPayload = { skill: SkillSummary | null; versions: SkillVersionRow[] }
const mapVersions = (rows: SkillVersionRow[]) => rows.map((version) => ({ ...version, label: getVersionLabel(version) })) as VersionOption[]
const mapFiles = (value: string | undefined) => parseArrayJson<SkillFileRecord>(value, [])
export const skillIpc = {
  list: async () => getProjectBridge().skills.list() as Promise<SkillSummary[]>,
  get: async (id: string) => { const payload = await getProjectBridge().skills.get(id) as SkillPayload; if (!payload.skill) return null; const versions = mapVersions(payload.versions); return { skill: payload.skill, versions, latestVersion: versions[0], selectedVersion: versions[0], files: mapFiles(payload.versions[0]?.filesJson) } satisfies SkillConfigRecord },
  create: async () => { const payload = await getProjectBridge().skills.create() as SkillPayload; const versions = mapVersions(payload.versions); return { skill: payload.skill as SkillSummary, versions, latestVersion: versions[0], selectedVersion: versions[0], files: mapFiles(payload.versions[0]?.filesJson) } satisfies SkillConfigRecord },
  save: async (payload: { id: string; title: string; source: string; summary: string; files: SkillFileRecord[]; selectedVersionId?: string; publish?: boolean }) => { const result = await getProjectBridge().skills.save({ ...payload, filesJson: JSON.stringify(payload.files) }) as SkillPayload & { selectedVersionId?: string | null }; const versions = mapVersions(result.versions); const selected = versions.find((version) => version.id === result.selectedVersionId) ?? versions[0]; const selectedRow = result.versions.find((version) => version.id === selected.id) ?? result.versions[0]; return { skill: result.skill as SkillSummary, versions, latestVersion: versions[0], selectedVersion: selected, files: mapFiles(selectedRow.filesJson) } satisfies SkillConfigRecord },
  delete: async (id: string) => getProjectBridge().skills.delete(id),
}
