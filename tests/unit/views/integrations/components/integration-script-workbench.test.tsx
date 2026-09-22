import { fireEvent, render, screen } from "@testing-library/react"
import { IntlProvider } from "react-intl"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/monaco/configure-monaco", () => ({}))
vi.mock("@monaco-editor/react", () => ({
  default: ({ value, onChange }: { value: string; onChange?: (value: string) => void }) => (
    <textarea aria-label="Monaco editor" value={value} onChange={(event) => onChange?.(event.target.value)} />
  ),
}))

import { IntegrationScriptWorkbench } from "@/pages/integrations/components/integration-script-workbench"
import type { ScriptIntegrationConfig } from "@/types/integration"

function renderWorkbench(config: ScriptIntegrationConfig, onChange = vi.fn()) {
  render(
    <IntlProvider locale="en" messages={{}}>
      <IntegrationScriptWorkbench config={config} onChange={onChange} />
    </IntlProvider>,
  )

  return { onChange }
}

describe("integration script workbench", () => {
  it("defaults new scripts to the handler export and persists on dialog save", () => {
    const { onChange } = renderWorkbench({
      kind: "scripts",
      description: "",
      runtime: "node",
      timeoutMs: 30000,
      inputSchemaJson: "{}",
      outputSchemaJson: "{}",
      selectedScriptId: "script-main",
      scripts: [
        {
          id: "script-main",
          name: "Main Script",
          handler: "handler",
          code: "export async function handler(input) {\n  return input\n}\n",
        },
      ],
    })

    fireEvent.click(screen.getByRole("button", { name: "Add script" }))

    expect(screen.getByDisplayValue("handler")).not.toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Save script" }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedScriptId: "script-2",
        scripts: expect.arrayContaining([
          expect.objectContaining({
            id: "script-2",
            handler: "handler",
          }),
        ]),
      }),
      { persist: true },
    )
  })
})
