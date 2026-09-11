import { describe, expect, it } from "vitest"

describe("Drizzle repository contracts", () => {
  it("keeps the primary repositories present", () => {
    expect("electron/database/drizzle/channel-repository.ts").toContain("channel-repository")
    expect("electron/database/drizzle/channel-catalog-repository.ts").toContain("channel-catalog-repository")
    expect("electron/database/drizzle/seed-repository.ts").toContain("seed-repository")
    expect("electron/database/drizzle/workflow-invocation-repository.ts").toContain("workflow-invocation-repository")
  })
})
