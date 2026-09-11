import { describe, expect, it } from "vitest"
import { useDocumentDetailStore } from "@/view-models/documents/document-detail-store"
import { useSkillDetailStore } from "@/view-models/skills/skill-detail-store"

describe("document and skill command contracts", () => {
  it("exposes fine-grained update commands", () => {
    expect(typeof useDocumentDetailStore.getState().updatePage).toBe("function")
    expect(typeof useSkillDetailStore.getState().updateFile).toBe("function")
  })
})
