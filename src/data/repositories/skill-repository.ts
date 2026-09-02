import type { SkillConfigRecord, SkillDetail, SkillFileRecord, SkillSummary } from "@/data/domain/models"
import { ensureSeeded } from "@/data/repositories/seed-repository"
import { createArchiveImportPlan, getImportableArchiveEntries, readArchiveEntries, type ArchiveImportPlan, type ArchiveImportStrategy } from "@/lib/resource-files"
import { buildSkillMarkdown, ensureSkillFiles, getSkillArchivePathError, getSkillSourceLanguage, normalizeSkillPath, parseSkillFrontmatter } from "@/lib/skill-files"
import { suoraIpc } from "@/lib/ipc"

function getSkillMetadata(files: SkillFileRecord[], fallbackTitle: string, fallbackSummary: string) {
  const skillMarkdown = files.find((file) => file.path === "SKILL.md")?.content ?? ""
  const frontmatter = parseSkillFrontmatter(skillMarkdown)
  return {
    summary: frontmatter.description || fallbackSummary,
    title: frontmatter.name || fallbackTitle,
  }
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

    const metadata = getSkillMetadata(detail.files, row.title, row.summary)

    return {
      ...row,
      title: metadata.title,
      summary: metadata.summary,
    } satisfies SkillSummary
  }))

  return summaries
}

export async function createSkill() {
  await ensureSeeded()
  return suoraIpc.skills.create() as Promise<SkillConfigRecord>
}

export async function previewSkillArchiveImport(file: File, strategy: ArchiveImportStrategy): Promise<ArchiveImportPlan> {
  await ensureSeeded()
  const name = file.name.replace(/\.zip$/i, "") || "Imported skill"
  const existingPaths = ensureSkillFiles([], name, `Imported from ${file.name}`).map((entry) => entry.path)
  const entries = await readArchiveEntries(file)
  const plan = createArchiveImportPlan(entries, {
    existingPaths,
    strategy,
    validatePath: (path, kind) => getSkillArchivePathError(path, kind),
  })

  if (!plan.entries.some((entry) => entry.kind === "file" && entry.normalizedPath === "SKILL.md" && entry.resolvedPath)) {
    return {
      ...plan,
      issues: [...plan.issues, { path: "SKILL.md", message: "Skill archives must include a root SKILL.md file.", severity: "error" }],
      hasBlockingIssues: true,
    }
  }

  return plan
}

export async function importSkillArchive(file: File, strategy: ArchiveImportStrategy = "overwrite") {
  await ensureSeeded()
  const created = await createSkill()
  const existingPaths = ensureSkillFiles(created.files, created.skill.title, created.skill.summary).map((entry) => entry.path)
  const entries = await readArchiveEntries(file)
  const plan = createArchiveImportPlan(entries, {
    existingPaths,
    strategy,
    validatePath: (path, kind) => getSkillArchivePathError(path, kind),
  })
  if (!plan.entries.some((entry) => entry.kind === "file" && entry.normalizedPath === "SKILL.md" && entry.resolvedPath)) {
    throw new Error("Skill archives must include a root SKILL.md file.")
  }
  if (plan.hasBlockingIssues) {
    throw new Error(plan.issues.find((issue) => issue.severity === "error")?.message ?? "Skill archive validation failed.")
  }

  const files = ensureSkillFiles(getImportableArchiveEntries(plan).map((entry) => ({
    path: normalizeSkillPath(entry.path),
    content: entry.content,
    kind: entry.kind,
    language: getSkillSourceLanguage(entry.path),
  } as SkillFileRecord)), created.skill.title, created.skill.summary)
  const skillMarkdown = files.find((entry) => entry.path === "SKILL.md")?.content ?? buildSkillMarkdown(created.skill.title, created.skill.summary)
  const frontmatter = parseSkillFrontmatter(skillMarkdown)
  return saveSkillDraft(created.skill.id, {
    title: frontmatter.name || created.skill.title,
    source: created.skill.source,
    summary: frontmatter.description || created.skill.summary,
    files,
  })
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

export async function saveSkillDraft(skillId: string, payload: { title: string; source: string; summary: string; files: SkillFileRecord[]; selectedVersionId?: string }) {
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
    selectedVersionId: detail.selectedVersion.id,
    publish: true,
  }) as Promise<SkillConfigRecord>
}

export async function deleteSkill(skillId: string) {
  await ensureSeeded()
  return suoraIpc.skills.delete(skillId)
}