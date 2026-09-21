import { describe, expect, it } from "vitest"

import { SKILL_ROOT_PATH, buildSkillTree } from "@/lib/skill/editor-utils"
import type { SkillFileRecord } from "@/types/document"

describe("buildSkillTree", () => {
  it("keeps the skill root in canonical order", () => {
    const files: SkillFileRecord[] = [
      { path: "references", content: "", language: "plaintext", kind: "directory" },
      { path: "scripts/helpers/run.ts", content: "", language: "typescript", kind: "file" },
      { path: "assets/logo.svg", content: "", language: "plaintext", kind: "file" },
      { path: "SKILL.md", content: "# skill", language: "markdown", kind: "file" },
      { path: "references/guide.md", content: "", language: "markdown", kind: "file" },
      { path: "scripts", content: "", language: "plaintext", kind: "directory" },
      { path: "assets", content: "", language: "plaintext", kind: "directory" },
    ]

    const tree = buildSkillTree(files, "Example")

    const rootOrder = [SKILL_ROOT_PATH, "SKILL.md", "scripts", "references", "assets"].map((path) =>
      tree.findIndex((entry) => entry.path === path),
    )

    expect(rootOrder).toEqual(rootOrder.toSorted((left, right) => left - right))
  })

  it("keeps legacy extra folders after the canonical root entries", () => {
    const files: SkillFileRecord[] = [
      { path: "SKILL.md", content: "# skill", language: "markdown", kind: "file" },
      { path: "other/snippets/example.md", content: "", language: "markdown", kind: "file" },
      { path: "references/guide.md", content: "", language: "markdown", kind: "file" },
    ]

    const tree = buildSkillTree(files, "Example")

    expect(tree.map((entry) => entry.path)).toEqual([
      SKILL_ROOT_PATH,
      "SKILL.md",
      "scripts",
      "references",
      "references/guide.md",
      "assets",
      "other",
      "other/snippets",
      "other/snippets/example.md",
    ])
  })
})