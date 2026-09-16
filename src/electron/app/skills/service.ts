import type { SkillConfigRecord, SkillSummary } from "@/types/agent"
import type { VersionOption } from "@/types/version"
import {
  createSkill,
  deleteSkill,
  getSkill,
  listSkills,
  saveSkill,
} from "@/electron/app/skills/repository"
import {
  buildSkillFileTree,
  getSkillFileContent,
  parseSkillFiles,
  serializeSkillFiles,
} from "@/electron/app/skills/file-service"

type SkillVersionRow = {
  id: string
  major: number
  minor: number
  isRelease: boolean
  createdAt: number
  filesJson: string
}

function mapVersion(version: SkillVersionRow): VersionOption {
  return { ...version, label: `${version.major}.${version.minor}${version.isRelease ? " (Release)" : ""}` }
}

function toDetail(payload: { skill: SkillSummary | null; versions: SkillVersionRow[] }): SkillConfigRecord | null {
  if (!payload.skill) return null
  const versions = payload.versions.map(mapVersion)
  const selectedVersion = versions[0]
  return {
    skill: payload.skill,
    versions,
    latestVersion: selectedVersion,
    selectedVersion,
    files: parseSkillFiles(payload.versions[0]?.filesJson),
  }
}

export const skillService = {
  list: async () => listSkills(),
  get: async (skillId: string) => toDetail(await getSkill(skillId)),
  create: async () => toDetail(await createSkill()),
  save: async (payload: Parameters<typeof saveSkill>[0]) =>
    toDetail(
      await saveSkill({
        ...payload,
        ...(payload.filesJson ? { filesJson: serializeSkillFiles(parseSkillFiles(payload.filesJson)) } : {}),
      }),
    ),
  remove: (skillId: string) => deleteSkill(skillId),
  async getFileTree(skillId: string, versionId?: string) {
    const detail = await this.get(skillId)
    if (!detail) throw new Error("Skill was not found.")
    const version = versionId ? detail.versions.find((item) => item.id === versionId) : detail.selectedVersion
    const payload = await getSkill(skillId)
    const row = payload.versions.find((item) => item.id === version?.id) ?? payload.versions[0]
    return buildSkillFileTree(
      detail.skill.id,
      detail.skill.title,
      detail.skill.summary,
      parseSkillFiles(row?.filesJson),
    )
  },
  async getFile(skillId: string, filePath: string, versionId?: string) {
    const detail = await this.get(skillId)
    if (!detail) throw new Error("Skill was not found.")
    const version = versionId ? detail.versions.find((item) => item.id === versionId) : detail.selectedVersion
    const payload = await getSkill(skillId)
    const row = payload.versions.find((item) => item.id === version?.id) ?? payload.versions[0]
    return getSkillFileContent(
      detail.skill.id,
      detail.skill.title,
      detail.skill.summary,
      row?.createdAt ?? detail.skill.updatedAt,
      parseSkillFiles(row?.filesJson),
      filePath,
    )
  },
}
