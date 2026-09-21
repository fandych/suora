import { describe, expect, it } from "vitest"

import { normalizeLegacySkillFiles, parseSkillFiles } from "@/electron/app/skills/file-service"
import type { SkillFileRecord } from "@/types/document"

describe("skill file-service legacy normalization", () => {
  it("moves legacy other paths into references", () => {
    const files: SkillFileRecord[] = [
      { path: "SKILL.md", content: "", language: "markdown", kind: "file" },
      { path: "other", content: "", language: "plaintext", kind: "directory" },
      { path: "other/notes.md", content: "hello", language: "markdown", kind: "file" },
    ]

    expect(normalizeLegacySkillFiles(files).map((file) => file.path)).toEqual([
      "SKILL.md",
      "references",
      "references/notes.md",
    ])
  })

  it("keeps both files when legacy other content would collide with references", () => {
    const parsed = parseSkillFiles(
      JSON.stringify([
        { path: "references/notes.md", content: "new", language: "markdown", kind: "file" },
        { path: "other/notes.md", content: "old", language: "markdown", kind: "file" },
      ]),
    )

    expect(parsed.map((file) => file.path)).toEqual(["references/notes.md", "references/notes-legacy-2.md"])
  })
})