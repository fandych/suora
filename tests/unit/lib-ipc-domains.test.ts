import { afterEach, describe, expect, it } from "vitest"

import { catalogIpc } from "@/lib/ipc/domains/catalog-ipc"

describe("IPC domain adapters", () => {
  afterEach(() => {
    delete window.project
  })

  it("forwards catalog calls through the typed project bridge", async () => {
    const calls: unknown[][] = []
    window.project = { catalog: { list: async (...args: unknown[]) => { calls.push(args); return ["list"] }, get: async (...args: unknown[]) => { calls.push(args); return ["get"] } } } as never
    expect(await catalogIpc.list("/models")).toEqual(["list"])
    expect(await catalogIpc.get("/models", "provider-1")).toEqual(["get"])
    expect(calls).toEqual([["/models"], ["/models", "provider-1"]])
  })
})
