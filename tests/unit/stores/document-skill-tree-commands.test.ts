import { describe, expect, it } from "vitest"
import { useDocumentDetailStore } from "@/stores/document-detail-store"
import { useSkillDetailStore } from "@/stores/skill-detail-store"

describe("document and skill tree command contracts", () => {
  it("exposes production tree mutation commands", () => {
    expect(typeof useDocumentDetailStore.getState().addPage).toBe("function")
    expect(typeof useDocumentDetailStore.getState().removePageTree).toBe("function")
    expect(typeof useSkillDetailStore.getState().addFiles).toBe("function")
    expect(typeof useSkillDetailStore.getState().removePathTree).toBe("function")
  })
})
