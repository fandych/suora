import { describe, expect, it } from "vitest"
import { useDocumentDetailStore } from "@/view-models/documents/document-detail-store"
import { useSkillDetailStore } from "@/view-models/skills/skill-detail-store"

describe("document and skill ViewModel stores", () => {
  it("exposes independent draft update commands", () => {
    expect(typeof useDocumentDetailStore.getState().updatePages).toBe("function")
    expect(typeof useDocumentDetailStore.getState().updateDocument).toBe("function")
    expect(typeof useSkillDetailStore.getState().updateFiles).toBe("function")
    expect(typeof useSkillDetailStore.getState().updateSkill).toBe("function")
  })
})
