// @vitest-environment node

import { describe, expect, it } from "vitest"

import { normalizeDocumentPages } from "@/electron/app/documents/service"
import type { DocumentPageRecord } from "@/types/document"

describe("normalizeDocumentPages", () => {
  it("flattens the legacy single-root guides folder", () => {
    const pages: DocumentPageRecord[] = [
      { id: "guides", title: "guides", content: "", type: "folder", parentId: null },
      { id: "overview", title: "overview.md", content: "# Overview", type: "document", parentId: "guides" },
      { id: "nested", title: "api", content: "", type: "folder", parentId: "guides" },
      { id: "child", title: "auth.md", content: "auth", type: "document", parentId: "nested" },
    ]

    expect(normalizeDocumentPages(pages)).toEqual([
      { id: "overview", title: "overview.md", content: "# Overview", type: "document", parentId: null },
      { id: "nested", title: "api", content: "", type: "folder", parentId: null },
      { id: "child", title: "auth.md", content: "auth", type: "document", parentId: "nested" },
    ])
  })

  it("keeps intentional multi-root document trees unchanged", () => {
    const pages: DocumentPageRecord[] = [
      { id: "guides", title: "guides", content: "", type: "folder", parentId: null },
      { id: "overview", title: "overview.md", content: "# Overview", type: "document", parentId: null },
    ]

    expect(normalizeDocumentPages(pages)).toEqual(pages)
  })
})