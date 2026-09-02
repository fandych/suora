import type { WorkflowDefinition } from "@/data/domain/models"
import { downloadJson } from "@/lib/browser-files"

export function exportWorkflowJson(payload: { title: string; summary: string; definition: WorkflowDefinition; versionLabel?: string }) {
  const fileName = `${payload.title || "workflow"}`.replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase() || "workflow"
  downloadJson(`${fileName}.json`, {
    title: payload.title,
    summary: payload.summary,
    versionLabel: payload.versionLabel,
    definition: payload.definition,
  })
}

export function parseWorkflowJson(value: string) {
  const parsed = JSON.parse(value) as {
    title?: string
    summary?: string
    definition?: WorkflowDefinition
  }

  if (!parsed.definition) {
    throw new Error("Workflow JSON must include a definition object.")
  }

  return {
    title: parsed.title ?? "Imported workflow",
    summary: parsed.summary ?? "",
    definition: parsed.definition,
  }
}