import type { SkillConfigRecord } from "@/types/agent"
import type { SkillDetail, SkillFileContent, SkillFileRecord, SkillFileTree, SkillSummary } from "@/types/document"

export const SkillApi = {
  listAll: () => window.app!.skills.listAll() as Promise<SkillSummary[]>,
  list: () => SkillApi.listAll(),
  get: (skillId: string) => window.app!.skills.get(skillId) as Promise<SkillConfigRecord | null>,
  getDetail: (skillId: string) => {
    return (skillId.includes(":") ? window.app!.skills.getExternal(skillId) : SkillApi.get(skillId)) as Promise<SkillDetail>
  },
  getFileTree: (skillId: string) => window.app!.skills.getFileTree(skillId) as Promise<SkillFileTree>,
  getFile: (skillId: string, filePath: string) => window.app!.skills.getFile(skillId, filePath) as Promise<SkillFileContent>,
  create: () => window.app!.skills.create() as Promise<SkillConfigRecord>,
  save: (payload: unknown) => window.app!.skills.save(payload) as Promise<SkillConfigRecord>,
  saveDraft: (
    skillId: string,
    payload: { title: string; source: string; summary: string; files: SkillFileRecord[] },
  ) =>
    window.app!.skills.save({
      ...payload,
      id: skillId,
      filesJson: JSON.stringify(payload.files),
    }) as Promise<SkillConfigRecord>,
  remove: (skillId: string) => window.app!.skills.delete(skillId),
  delete: (skillId: string) => SkillApi.remove(skillId),
  listExternal: () => window.app!.skills.listExternal(),
}

export const listSkills = SkillApi.listAll
export const createSkill = SkillApi.create
export const getSkillDetail = SkillApi.getDetail
export const saveSkillDraft = SkillApi.saveDraft
export const deleteSkill = SkillApi.delete

export type { SkillConfigRecord, SkillDetail, SkillFileRecord, SkillSummary }
