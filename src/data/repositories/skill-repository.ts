import type { SkillConfigRecord, SkillDetail, SkillFileRecord, SkillSummary } from "@/data/domain/models"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { ensureSkillFiles } from "@/lib/skill-files"
import { suoraIpc } from "@/lib/ipc"

function getSkillSidebarName(files: SkillFileRecord[], fallbackTitle: string) {
  const skillMarkdown = files.find((file) => file.path === "SKILL.md")?.content ?? ""
  const match = /^name:\s*"?([^"\n]+)"?$/im.exec(skillMarkdown)
  return match?.[1]?.trim() || fallbackTitle
}

function normalizeSkill(detail: SkillConfigRecord | SkillDetail) {
  return {
    ...detail,
    files: ensureSkillFiles(detail.files, detail.skill.title, detail.skill.summary),
  }
}

export async function listSkills() {
  await ensureSeeded()
  const rows = await suoraIpc.skills.list() as SkillSummary[]
  const summaries = await Promise.all(rows.map(async (row) => {
    const detail = await suoraIpc.skills.get(row.id) as SkillConfigRecord | null
    if (!detail) {
      return row
    }

    return {
      ...row,
      title: getSkillSidebarName(detail.files, row.title),
      summary: detail.skill.summary || row.summary,
    } satisfies SkillSummary
  }))

  return summaries
}

export async function createSkill() {
  await ensureSeeded()
  return suoraIpc.skills.create() as Promise<SkillConfigRecord>
}

export async function getSkillDetail(skillId: string, selectedVersionId?: string) {
  await ensureSeeded()
  const detail = await suoraIpc.skills.get(skillId) as SkillConfigRecord | null
  if (!detail) {
    throw new Error(`Skill ${skillId} was not found.`)
  }
  if (!selectedVersionId || detail.selectedVersion.id === selectedVersionId) {
    return normalizeSkill(detail) satisfies SkillDetail
  }
  const selectedVersion = detail.versions.find((version) => version.id === selectedVersionId) ?? detail.selectedVersion
  return {
    ...normalizeSkill(detail),
    selectedVersion,
  } satisfies SkillDetail
}

export async function saveSkillDraft(skillId: string, payload: { title: string; source: string; summary: string; files: SkillFileRecord[] }) {
  await ensureSeeded()
  return suoraIpc.skills.save({
    id: skillId,
    ...payload,
    files: ensureSkillFiles(payload.files, payload.title, payload.summary),
  }) as Promise<SkillConfigRecord>
}

export async function publishSkillVersion(skillId: string, versionId: string) {
  await ensureSeeded()
  const detail = await getSkillDetail(skillId, versionId)
  return suoraIpc.skills.save({
    id: skillId,
    title: detail.skill.title,
    source: detail.skill.source,
    summary: detail.skill.summary,
    files: detail.files,
    publish: true,
  }) as Promise<SkillConfigRecord>
}

export async function deleteSkill(skillId: string) {
  await ensureSeeded()
  return suoraIpc.skills.delete(skillId)
}