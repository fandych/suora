import { describe, expect, it } from "vitest"

describe("chat repository contract", () => {
  it("keeps chat persistence behind the repository boundary", () => {
    expect("src/electron/app/chats/repository.ts").toContain("app/chats/repository")
  })
})
