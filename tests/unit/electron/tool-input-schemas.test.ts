import { describe, expect, it } from "vitest"

import { parseBrowserInput, browserFillSchema } from "@electron/ipc/tools/tools-browser-schemas"
import { parseFilesystemInput, writeFileSchema } from "@electron/ipc/tools/tools-filesystem-schemas"

describe("tool IPC input schemas", () => {
  it("bounds filesystem writes", () => {
    expect(parseFilesystemInput(writeFileSchema, { path: "notes.txt", content: "hello" })).toEqual({ path: "notes.txt", content: "hello" })
    expect(() => parseFilesystemInput(writeFileSchema, { path: "../secret", content: "hello" })).not.toThrow()
    expect(() => parseFilesystemInput(writeFileSchema, { path: "notes.txt", content: "x".repeat(1024 * 1024 + 1) })).toThrow(/Invalid filesystem tool payload/)
  })

  it("rejects invalid browser selectors and oversized values", () => {
    expect(parseBrowserInput(browserFillSchema, { selector: "#message", value: "hello" })).toMatchObject({ selector: "#message" })
    expect(() => parseBrowserInput(browserFillSchema, { selector: "", value: "hello" })).toThrow(/Invalid browser tool payload/)
    expect(() => parseBrowserInput(browserFillSchema, { selector: "#message", value: "x".repeat(256 * 1024 + 1) })).toThrow(/Invalid browser tool payload/)
  })
})
