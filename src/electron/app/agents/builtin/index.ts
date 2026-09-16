import { agentEditor } from "@/electron/app/agents/builtin/agent-editor"
import { documentEditor } from "@/electron/app/agents/builtin/document-editor"
import { generateAgent } from "@/electron/app/agents/builtin/general-assistant"
import { skillEditor } from "@/electron/app/agents/builtin/skill-editor"
import { workflowEditor } from "@/electron/app/agents/builtin/workflow-editor"
import type { AgentPayload } from "@/types/agent"

export const builtinAgents: AgentPayload[] = [generateAgent, documentEditor, workflowEditor, agentEditor, skillEditor]
