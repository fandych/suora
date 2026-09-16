import { describe, expect, it } from "vitest"
import { useModelDetailStore } from "@/stores/model-detail-store"

describe("model detail store", () => {
  it("starts without a selected model", () => {
    expect(useModelDetailStore.getState().modelId).toBeNull()
    expect(useModelDetailStore.getState().draft).toBeNull()
  })
})
