import type { SkillConfigRecord } from "@/types/agent"
import type { SkillSummary } from "@/types/document"
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

function toDetail(payload: { skill: (SkillSummary & { filesJson: string }) | null }): SkillConfigRecord | null {
  if (!payload.skill) return null
  return {
    skill: payload.skill,
    files: parseSkillFiles(payload.skill.filesJson),
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
  async getFileTree(skillId: string) {
    const detail = await this.get(skillId)
    if (!detail) throw new Error("Skill was not found.")
    return buildSkillFileTree(
      detail.skill.id,
      detail.skill.title,
      detail.skill.summary,
      detail.files,
    )
  },
  async getFile(skillId: string, filePath: string) {
    const detail = await this.get(skillId)
    if (!detail) throw new Error("Skill was not found.")
    return getSkillFileContent(
      detail.skill.id,
      detail.skill.title,
      detail.skill.summary,
      detail.skill.updatedAt,
      detail.files,
      filePath,
    )
  },
}
