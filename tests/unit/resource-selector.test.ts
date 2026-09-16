import { describe, expect, it } from "vitest"

import { getEnabledResourceOptions, isResourceAvailable } from "@/components/resource-selector"

describe("resource selector policy", () => {
  it("only exposes enabled resources as selectable options", () => {
    expect(
      getEnabledResourceOptions([
        { id: "enabled", label: "Enabled", enabled: true },
        { id: "disabled", label: "Disabled", enabled: false },
      ]),
    ).toEqual([{ id: "enabled", label: "Enabled", enabled: true }])
  })

  it("treats explicit disabled flags as unavailable across resource types", () => {
    expect(isResourceAvailable({ enabled: true })).toBe(true)
    expect(isResourceAvailable({ enabled: false })).toBe(false)
    expect(isResourceAvailable({ isDisabled: true })).toBe(false)
  })
})
