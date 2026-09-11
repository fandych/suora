import { createSkill, deleteSkill, getSkillDetail, listSkills, saveSkillDraft } from "@/data/repositories/skill-repository"

export const skillApplicationService = {
  create: createSkill,
  delete: deleteSkill,
  list: listSkills,
  getDetail: getSkillDetail,
  saveDraft: saveSkillDraft,
}
