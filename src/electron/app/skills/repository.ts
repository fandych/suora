import crypto from "node:crypto"
import { desc, eq } from "drizzle-orm"
import { getDrizzleDatabase } from "@/drizzle/db"
import { skills } from "@/drizzle/schema"
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
  return { skill: skill ?? null }
}

export async function createSkill() {
  const database = getDrizzleDatabase()
  const id = crypto.randomUUID()
  const now = Date.now()
  await database
    .insert(skills)
    .values({ id, title: "New skill", source: "custom", summary: "", filesJson: starterFiles, updatedAt: now })
  return getSkill(id)
}

export async function saveSkill(payload: {
  id: string
  title: string
  source?: string
  summary: string
  filesJson?: string
}) {
  const database = getDrizzleDatabase()
  const now = Date.now()
  const filesJson = ensureSkillManifest(payload.filesJson)
  await database
    .update(skills)
    .set({ title: payload.title, source: payload.source || "custom", summary: payload.summary, filesJson, updatedAt: now })
    .where(eq(skills.id, payload.id))
  return getSkill(payload.id)
}

export async function deleteSkill(skillId: string) {
  const database = getDrizzleDatabase()
  await database.delete(skills).where(eq(skills.id, skillId))
  return { success: true }
}
