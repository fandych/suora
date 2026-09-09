import { getProjectBridge } from "@/lib/ipc/bridge"
import { agentIpc } from "@/lib/ipc/domains/agent-ipc"
import { channelIpc } from "@/lib/ipc/domains/channel-ipc"
import { chatIpc } from "@/lib/ipc/domains/chat-ipc"
import { documentIpc } from "@/lib/ipc/domains/document-ipc"
import { integrationIpc } from "@/lib/ipc/domains/integration-ipc"
import { mailIpc, preferencesIpc, systemIpc, updaterIpc, workspaceIpc } from "@/lib/ipc/domains/core-ipc"
import { modelIpc } from "@/lib/ipc/domains/model-ipc"
import { schedulerIpc } from "@/lib/ipc/domains/scheduler-ipc"
import { skillIpc } from "@/lib/ipc/domains/skill-ipc"
import { toolIpc } from "@/lib/ipc/domains/tool-ipc"
import { workflowIpc } from "@/lib/ipc/domains/workflow-ipc"

export { hasProjectBridge } from "@/lib/ipc/bridge"

export const projectIpc = {
  system: systemIpc,
  workspace: workspaceIpc,
  chats: chatIpc,
  documents: documentIpc,
  models: modelIpc,
  skills: skillIpc,
  agents: agentIpc,
  integrations: integrationIpc,
  workflows: workflowIpc,
  channels: channelIpc,
  schedulers: schedulerIpc,
  preferences: preferencesIpc,
  updater: updaterIpc,
  mail: mailIpc,
  tools: toolIpc,
}

export type ProjectIpc = typeof projectIpc
export { getProjectBridge }
