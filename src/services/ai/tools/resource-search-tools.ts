import { getDocumentDetail, listDocuments } from "@/data/repositories/document-repository"
import { getSkillDetail, listSkills } from "@/data/repositories/skill-repository"
import { getWorkflowDetail, listWorkflows } from "@/data/repositories/workflow-repository"

export async function listScopedDocuments(hasScope: boolean, scopedDocuments: Array<Awaited<ReturnType<typeof getDocumentDetail>> | null>) {
  return hasScope ? scopedDocuments.filter((item): item is Awaited<ReturnType<typeof getDocumentDetail>> => Boolean(item)).map((item) => item.document) : await listDocuments()
}

export async function listScopedSkills(hasScope: boolean, scopedSkills: Array<Awaited<ReturnType<typeof getSkillDetail>> | null>) {
  return hasScope ? scopedSkills.filter((item): item is Awaited<ReturnType<typeof getSkillDetail>> => Boolean(item)).map((item) => item.skill) : await listSkills()
}

export async function listScopedWorkflows(hasScope: boolean, scopedWorkflows: Array<Awaited<ReturnType<typeof getWorkflowDetail>> | null>) {
  return hasScope ? scopedWorkflows.filter((item): item is Awaited<ReturnType<typeof getWorkflowDetail>> => Boolean(item)).map((item) => item.workflow) : await listWorkflows()
}

export async function searchDocuments(query: string, scopedDocuments: Array<Awaited<ReturnType<typeof getDocumentDetail>> | null>) {
  const documents = await listScopedDocuments(scopedDocuments.length > 0, scopedDocuments)
  const match = documents.find((item) => item.title.toLowerCase().includes(query.toLowerCase()))
  if (!match) return { found: false, reason: "No matching document" }
  const detail = await getDocumentDetail(match.id)
  return { found: true, title: detail.document.title, summary: detail.document.summary, pages: detail.pages.map((page) => ({ title: page.title, excerpt: page.content.slice(0, 240) })) }
}

export async function searchSkills(query: string, scopedSkills: Array<Awaited<ReturnType<typeof getSkillDetail>> | null>) {
  const skills = await listScopedSkills(scopedSkills.length > 0, scopedSkills)
  const match = skills.find((item) => item.title.toLowerCase().includes(query.toLowerCase()))
  if (!match) return { found: false, reason: "No matching skill" }
  const detail = await getSkillDetail(match.id)
  return { found: true, title: detail.skill.title, summary: detail.skill.summary, version: detail.selectedVersion.label, files: detail.files.map((file) => file.path) }
}

export async function searchWorkflows(query: string, scopedWorkflows: Array<Awaited<ReturnType<typeof getWorkflowDetail>> | null>) {
  const workflows = await listScopedWorkflows(scopedWorkflows.length > 0, scopedWorkflows)
  const match = workflows.find((item) => item.title.toLowerCase().includes(query.toLowerCase()))
  if (!match) return { found: false, reason: "No matching workflow" }
  const detail = await getWorkflowDetail(match.id)
  return { found: true, title: detail.workflow.title, summary: detail.workflow.summary, version: detail.selectedVersion.label, nodes: detail.definition.nodes.map((node) => node.data.label) }
}
