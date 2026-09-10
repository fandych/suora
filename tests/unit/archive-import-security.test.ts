import { describe, expect, it } from "vitest"

import { createArchiveImportPlan } from "@/lib/resources/archive-import"

describe("archive import security", () => {
  const validatePath = (path: string) => path.includes("..") ? "Path traversal is not allowed." : null

  it("rejects unsafe paths and reports blocking issues", () => {
    const plan = createArchiveImportPlan([{ path: "../secret.txt", content: "secret", kind: "file" }], { strategy: "skip", validatePath })
    expect(plan.hasBlockingIssues).toBe(true)
    expect(plan.entries[0].status).toBe("error")
    expect(plan.importCount).toBe(0)
  })

  it("handles workspace conflicts with skip and rename strategies", () => {
    const entries = [{ path: "notes.md", content: "one", kind: "file" as const }, { path: "./notes.md", content: "two", kind: "file" as const }]
    const skipped = createArchiveImportPlan(entries, { strategy: "skip", existingPaths: ["notes.md"], validatePath: () => null })
    expect(skipped.entries[0].status).toBe("skipped")
    expect(skipped.entries[1].status).toBe("ready")

    const renamed = createArchiveImportPlan(entries, { strategy: "rename", existingPaths: ["notes.md"], validatePath: () => null })
    expect(renamed.entries.map((entry) => entry.resolvedPath)).toContain("notes-2.md")
    expect(renamed.importCount).toBe(2)
  })
})
