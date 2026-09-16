import { describe, expect, it } from "vitest"
import { useSchedulerDetailStore } from "@/stores/scheduler-detail-store"

describe("scheduler detail store", () => {
  it("starts with no scheduler", () => {
    expect(useSchedulerDetailStore.getState().schedulerId).toBeNull()
    expect(useSchedulerDetailStore.getState().draft).toBeNull()
  })
})
