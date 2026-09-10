import { describe, expect, it } from "vitest"

import { z } from "zod"
import { parseIpcInput } from "@electron/ipc/system/ipc-input-schemas"

describe("catalog IPC contract", () => {
  const routeSchema = z.enum(["/agents", "/models", "/integrations", "/schedulers", "/channels"])

  it("accepts supported routes and rejects arbitrary SQL routes", () => {
    expect(parseIpcInput(routeSchema, "/models")).toBe("/models")
    expect(() => parseIpcInput(routeSchema, "/sqlite_master")).toThrow(/Invalid IPC payload/)
  })
})
