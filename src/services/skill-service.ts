import type { SkillConfigRecord } from "@/types/agent"
import type { SkillDetail, SkillFileContent, SkillFileRecord, SkillFileTree, SkillSummary } from "@/types/document"
import { requireAppBridge } from "@/services/bridge"

export const SkillApi = {
  listAll: () => requireAppBridge().skills.listAll() as Promise<SkillSummary[]>,
  list: () => SkillApi.listAll(),
  get: (skillId: string) => requireAppBridge().skills.get(skillId) as Promise<SkillConfigRecord | null>,
  getDetail: (skillId: string) => {
    return (skillId.includes(":") ? requireAppBridge().skills.getExternal(skillId) : SkillApi.get(skillId)) as Promise<SkillDetail>
  },
  getFileTree: (skillId: string) => requireAppBridge().skills.getFileTree(skillId) as Promise<SkillFileTree>,
  getFile: (skillId: string, filePath: string) => requireAppBridge().skills.getFile(skillId, filePath) as Promise<SkillFileContent>,
  create: () => requireAppBridge().skills.create() as Promise<SkillConfigRecord>,
  save: (payload: unknown) => requireAppBridge().skills.save(payload) as Promise<SkillConfigRecord>,
  saveDraft: (
    skillId: string,
    payload: { title: string; source: string; summary: string; files: SkillFileRecord[] },
  ) =>
    requireAppBridge().skills.save({
      ...payload,
      id: skillId,
      filesJson: JSON.stringify(payload.files),
    }) as Promise<SkillConfigRecord>,
  remove: (skillId: string) => requireAppBridge().skills.delete(skillId),
  delete: (skillId: string) => SkillApi.remove(skillId),
  listExternal: () => requireAppBridge().skills.listExternal(),
}

export const listSkills = SkillApi.listAll
export const createSkill = SkillApi.create
export const getSkillDetail = SkillApi.getDetail
export const saveSkillDraft = SkillApi.saveDraft
export const deleteSkill = SkillApi.delete

export type { SkillConfigRecord, SkillDetail, SkillFileRecord, SkillSummary }
