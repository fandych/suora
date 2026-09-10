import { describe, expect, it, vi } from "vitest"

vi.mock("@/data/repositories/document-repository", () => ({ listDocuments: vi.fn(async () => [{ id: "doc-1", title: "Guide", summary: "Summary" }]), getDocumentDetail: vi.fn(async () => ({ document: { id: "doc-1", title: "Guide", summary: "Summary" }, pages: [{ title: "Intro", content: "Hello world" }] })) }))
vi.mock("@/data/repositories/skill-repository", () => ({ listSkills: vi.fn(async () => [{ id: "skill-1", title: "Writing", summary: "Write" }]), getSkillDetail: vi.fn(async () => ({ skill: { id: "skill-1", title: "Writing", summary: "Write" }, selectedVersion: { label: "1.0" }, files: [{ path: "SKILL.md" }] })) }))
vi.mock("@/data/repositories/workflow-repository", () => ({ listWorkflows: vi.fn(async () => [{ id: "workflow-1", title: "Daily", summary: "Run" }]), getWorkflowDetail: vi.fn(async () => ({ workflow: { id: "workflow-1", title: "Daily", summary: "Run" }, selectedVersion: { label: "1.0" }, definition: { nodes: [{ data: { label: "Start" } }] } })) }))

import { listScopedDocuments, listScopedSkills, listScopedWorkflows, searchDocuments, searchSkills, searchWorkflows } from "@/services/ai/tools/resource-search-tools"

describe("AI resource search tools", () => {
  it("lists scoped and unscoped resources", async () => {
    expect((await listScopedDocuments(true, [null, { document: { id: "doc-1" } } as never])).length).toBe(1)
    expect((await listScopedSkills(false, [])).length).toBe(1)
    expect((await listScopedWorkflows(false, [])).length).toBe(1)
  })

  it("searches matching resources and returns misses", async () => {
    expect(await searchDocuments("guide", [])).toMatchObject({ found: true, title: "Guide" })
    expect(await searchSkills("missing", [])).toMatchObject({ found: false })
    expect(await searchWorkflows("daily", [])).toMatchObject({ found: true, title: "Daily" })
  })
})
