import { describe, expect, it } from "vitest"

import { getImportableArchiveEntries, getResourcePreviewKind, guessMimeType, isDataUrl, isTextPath } from "@/lib/resources/archive-import"

describe("resource helpers", () => {
  it("classifies common resources", () => {
    expect(guessMimeType("photo.png")).toBe("image/png")
    expect(getResourcePreviewKind("photo.png", "")).toBe("image")
    expect(getResourcePreviewKind("script.ts", "const x = 1")).toBe("script")
    expect(getResourcePreviewKind("data.json", "{}")).toBe("data")
    expect(isTextPath("README.md")).toBe(true)
    expect(isDataUrl("data:text/plain,hello")).toBe(true)
  })

  it("returns importable plan entries only", () => {
    const entries = getImportableArchiveEntries({
      entries: [
        { path: "ready.md", content: "ok", kind: "file", normalizedPath: "ready.md", resolvedPath: "ready.md", status: "ready" },
        { path: "skip.md", content: "skip", kind: "file", normalizedPath: "skip.md", resolvedPath: null, status: "skipped" },
      ],
      issues: [],
      importCount: 1,
      hasBlockingIssues: false,
    })
    expect(entries).toHaveLength(1)
    expect(entries[0].path).toBe("ready.md")
  })
})
