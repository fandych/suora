import { describe, expect, it } from "vitest"

describe("integration and channel persistence boundaries", () => {
  it("keeps persistence in Drizzle repositories", () => {
    expect("electron/database/drizzle/integration-repository.ts").toContain("integration-repository")
    expect("electron/database/drizzle/channel-repository.ts").toContain("channel-repository")
  })
})
