import { describe, expect, it } from "vitest"

import { workflowPresetNodes } from "@/lib/workflow/editor-config"

describe("workflow editor config", () => {
  it("exposes advanced control-flow and wiki nodes in the preset library", () => {
    const presetKinds = workflowPresetNodes.map((item) => item.kind)

    expect(presetKinds).toEqual(
      expect.arrayContaining(["fork", "parallel", "loop", "join", "condition", "wiki-retrieval"]),
    )
  })
})