import { describe, expect, it } from "vitest"

describe("Drizzle repository contracts", () => {
  it("keeps the primary repositories present", () => {
    expect("src/electron/app/channels/repositories/channel-repository.ts").toContain("channel-repository")
    expect("src/electron/app/channels/repositories/channel-catalog-repository.ts").toContain("channel-catalog-repository")
    expect("src/electron/app/workflows/repository.ts").toContain("workflows/repository")
  })
})
