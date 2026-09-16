import { describe, expect, it } from "vitest"

describe("integration and channel persistence boundaries", () => {
  it("keeps persistence in Drizzle repositories", () => {
    expect("src/electron/app/integrations/repository.ts").toContain("integrations/repository")
    expect("src/electron/app/channels/repositories/channel-repository.ts").toContain("channel-repository")
  })
})
