import type { AgentSummary } from "@/types/agent"

type Translate = (id: string, defaultMessage: string) => string

export function getLocalizedAgentTitle(agent: AgentSummary, t: Translate) {
  switch (agent.id) {
    case "agent-general-assistant":
      return t("agent.builtin.general.title", "General Assistant")
    case "agent-document-editor":
      return t("agent.builtin.documentEditor.title", "Document Editor")
    case "agent-workflow-editor":
      return t("agent.builtin.workflowEditor.title", "Workflow Editor")
    case "agent-agent-editor":
      return t("agent.builtin.agentEditor.title", "Agent Editor")
    case "agent-skill-editor":
      return t("agent.builtin.skillEditor.title", "Skill Editor")
    default:
      return agent.title
  }
}

export function getLocalizedAgentSummary(agent: AgentSummary, t: Translate) {
  switch (agent.id) {
    case "agent-general-assistant":
      return t("agent.builtin.general.summary", "General-purpose assistant for everyday workspace questions and operations.")
    case "agent-document-editor":
      return t("agent.builtin.documentEditor.summary", "Create and manage private workspace documents.")
    case "agent-workflow-editor":
      return t("agent.builtin.workflowEditor.summary", "Create and manage private workspace workflows.")
    case "agent-agent-editor":
      return t("agent.builtin.agentEditor.summary", "Create and manage private custom workspace agents.")
    case "agent-skill-editor":
      return t("agent.builtin.skillEditor.summary", "Create and manage private workspace skills.")
    default:
      return agent.summary
  }
}
