import crypto from "node:crypto"
import { and, desc, eq } from "drizzle-orm"
import { getDrizzleDatabase } from "@/drizzle/db"
import { skillVersions, skills } from "@/drizzle/schema"
import { parseSkillFiles } from "@/electron/app/skills/file-service"

const defaultSkillFiles = [
  {
    path: "SKILL.md",
    content: '---\nname: "New skill"\ndescription: "Describe what this skill does."\n---\n',
    language: "md",
    kind: "file",
  },
]
const starterFiles = JSON.stringify(defaultSkillFiles)

function ensureSkillManifest(filesJson: string | undefined) {
  const files = parseSkillFiles(filesJson)
  if (files.some((file) => file.path === "SKILL.md" && file.kind !== "directory")) return filesJson
  return JSON.stringify([...defaultSkillFiles, ...files.filter((file) => file.path !== "SKILL.md")])
}

export async function listSkills() {
  return getDrizzleDatabase().select().from(skills).orderBy(desc(skills.updatedAt))
}

export async function getSkill(skillId: string) {
  const database = getDrizzleDatabase()
  const [skill] = await database.select().from(skills).where(eq(skills.id, skillId)).limit(1)
  const versions = await database
    .select()
    .from(skillVersions)
    .where(eq(skillVersions.skillId, skillId))
    .orderBy(desc(skillVersions.major), desc(skillVersions.minor), desc(skillVersions.createdAt))
  return { skill: skill ?? null, versions }
}

export async function createSkill() {
  const database = getDrizzleDatabase()
  const id = crypto.randomUUID()
  const now = Date.now()
  await database.insert(skills).values({ id, title: "New skill", source: "custom", summary: "", updatedAt: now })
  await database.insert(skillVersions).values({
    id: crypto.randomUUID(),
    skillId: id,
    major: 1,
    minor: 0,
    isRelease: false,
    filesJson: starterFiles,
    createdAt: now,
  })
  return getSkill(id)
}

export async function saveSkill(payload: {
  id: string
  title: string
  source?: string
  summary: string
  filesJson?: string
  selectedVersionId?: string
  publish?: boolean
}) {
  const database = getDrizzleDatabase()
  const now = Date.now()
  const filesJson = ensureSkillManifest(payload.filesJson)
  await database
    .update(skills)
    .set({ title: payload.title, source: payload.source || "custom", summary: payload.summary, updatedAt: now })
    .where(eq(skills.id, payload.id))
  const [selected] = payload.selectedVersionId
    ? await database
        .select()
        .from(skillVersions)
        .where(and(eq(skillVersions.skillId, payload.id), eq(skillVersions.id, payload.selectedVersionId)))
        .limit(1)
    : []
  const [latest] = await database
    .select()
    .from(skillVersions)
    .where(eq(skillVersions.skillId, payload.id))
    .orderBy(desc(skillVersions.major), desc(skillVersions.minor), desc(skillVersions.createdAt))
    .limit(1)
  if (!payload.publish && selected && !selected.isRelease) {
    await database.update(skillVersions).set({ filesJson, createdAt: now }).where(eq(skillVersions.id, selected.id))
  } else {
    await database.insert(skillVersions).values({
      id: crypto.randomUUID(),
      skillId: payload.id,
      major: !latest ? 1 : latest.isRelease ? latest.major + 1 : latest.major,
      minor: !latest || latest.isRelease ? 0 : latest.minor + 1,
      isRelease: Boolean(payload.publish),
      filesJson,
      createdAt: now,
    })
  }
  return getSkill(payload.id)
}

export async function deleteSkill(skillId: string) {
  const database = getDrizzleDatabase()
  await database.delete(skillVersions).where(eq(skillVersions.skillId, skillId))
  await database.delete(skills).where(eq(skills.id, skillId))
  return { success: true }
}
