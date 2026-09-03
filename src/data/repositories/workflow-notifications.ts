import type { WorkflowDefinition, WorkflowNotificationSettings } from "@/data/domain/models"

export const DEFAULT_WORKFLOW_NOTIFICATION_SETTINGS: WorkflowNotificationSettings = {
  enabled: false,
  to: "",
  subjectTemplate: "Workflow {{workflowTitle}} {{status}}",
  includeSummary: true,
  includeTrace: true,
  triggerOn: "both",
}

export function normalizeWorkflowNotifications(definition: WorkflowDefinition): WorkflowDefinition {
  return {
    ...definition,
    notifications: {
      ...DEFAULT_WORKFLOW_NOTIFICATION_SETTINGS,
      ...(definition.notifications ?? {}),
    },
  }
}