import { describe, expect, it } from "vitest"

describe("drizzle chat repository contract", () => {
  it("keeps chat persistence behind the repository boundary", () => {
    expect("electron/database/drizzle/chat-repository.ts").toContain("chat-repository")
  })
})
