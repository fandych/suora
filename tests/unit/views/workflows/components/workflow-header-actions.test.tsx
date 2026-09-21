import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { WorkflowRevisionActions } from "@/pages/workflows/components/workflow-header-actions"

describe("workflow header actions", () => {
  it("fires the try-run callback from the accessible button trigger", () => {
    const onOpenTryRun = vi.fn()

    render(
      <WorkflowRevisionActions
        canSave
        canTryRun
        onSave={vi.fn()}
        onOpenTryRun={onOpenTryRun}
        onExport={vi.fn()}
        onImport={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Try run workflow" }))

    expect(onOpenTryRun).toHaveBeenCalledTimes(1)
  })
})