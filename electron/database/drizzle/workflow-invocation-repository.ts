import crypto from "node:crypto"
import { desc, eq } from "drizzle-orm"
import { getDrizzleDatabase } from "@electron/database/drizzle/client"
import { workflowInvocations } from "@electron/database/drizzle/schema"
import { getWorkflowVersionPolicy } from "@electron/database/drizzle/system-repository"

export async function recordWorkflowInvocationWithDrizzle(payload: { workflowId: string; versionId: string; status: string; trigger: string; input: string; output: string; traceJson: string }) {
  await getWorkflowVersionPolicy(payload.workflowId, payload.versionId)
  const database = getDrizzleDatabase()
  await database.insert(workflowInvocations).values({ id: crypto.randomUUID(), workflowId: payload.workflowId, versionId: payload.versionId, status: payload.status, trigger: payload.trigger, inputJson: payload.input, outputJson: payload.output, traceJson: payload.traceJson, createdAt: Date.now() })
  return database.select().from(workflowInvocations).where(eq(workflowInvocations.workflowId, payload.workflowId)).orderBy(desc(workflowInvocations.createdAt))
}
