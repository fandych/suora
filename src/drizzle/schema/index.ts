export { appMeta } from "@/drizzle/schema/app-meta"
export { agentVersions, agents } from "@/drizzle/schema/agents"
export { channels } from "@/drizzle/schema/channels"
export { chatMessages, chats } from "@/drizzle/schema/chats"
export { documentVersions, documents } from "@/drizzle/schema/documents"
export { integrationExecutions, integrationVersions, integrations } from "@/drizzle/schema/integrations"
export { providers } from "@/drizzle/schema/providers"
export { schedulerRuns, schedulers } from "@/drizzle/schema/schedulers"
export { skills } from "@/drizzle/schema/skills"
export { workflowInvocations, workflowVersions, workflows } from "@/drizzle/schema/workflows"

import { agentVersions, agents } from "@/drizzle/schema/agents"
import { appMeta } from "@/drizzle/schema/app-meta"
import { channels } from "@/drizzle/schema/channels"
import { chatMessages, chats } from "@/drizzle/schema/chats"
import { documentVersions, documents } from "@/drizzle/schema/documents"
import { integrationExecutions, integrationVersions, integrations } from "@/drizzle/schema/integrations"
import { providers } from "@/drizzle/schema/providers"
import { schedulerRuns, schedulers } from "@/drizzle/schema/schedulers"
import { skills } from "@/drizzle/schema/skills"
import { workflowInvocations, workflowVersions, workflows } from "@/drizzle/schema/workflows"

export const schema = {
  appMeta,
  workflows,
  workflowVersions,
  workflowInvocations,
  agents,
  agentVersions,
  documents,
  documentVersions,
  providers,
  skills,
  schedulers,
  schedulerRuns,
  chats,
  chatMessages,
  integrations,
  integrationVersions,
  integrationExecutions,
  channels,
}
