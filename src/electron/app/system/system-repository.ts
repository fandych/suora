import { desc, eq } from "drizzle-orm"
import { getDrizzleDatabase } from "@/drizzle/db"
import { appMeta, agents, providers, workflows } from "@/drizzle/schema"

export async function getAppMetaValue(key: string) {
  const [row] = await getDrizzleDatabase()
    .select({ value: appMeta.value })
    .from(appMeta)
    .where(eq(appMeta.key, key))
    .limit(1)
  return row?.value ?? null
}

export async function setAppMetaValue(key: string, value: string) {
  const database = getDrizzleDatabase()
  await database.insert(appMeta).values({ key, value }).onConflictDoUpdate({ target: appMeta.key, set: { value } })
}

export async function listCatalogItems(route: "/agents" | "/models" | "/workflows") {
  const database = getDrizzleDatabase()
  if (route === "/agents")
    return database
      .select({
        id: agents.id,
        title: agents.title,
        kind: agents.kind,
        summary: agents.summary,
        updatedAt: agents.updatedAt,
      })
      .from(agents)
      .orderBy(desc(agents.updatedAt))
  if (route === "/models")
    return database
      .select({
        id: providers.id,
        title: providers.title,
        providerType: providers.providerType,
        updatedAt: providers.updatedAt,
      })
      .from(providers)
      .orderBy(desc(providers.updatedAt))
  return database
    .select({ id: workflows.id, title: workflows.title, summary: workflows.summary, updatedAt: workflows.updatedAt })
    .from(workflows)
    .orderBy(desc(workflows.updatedAt))
}
