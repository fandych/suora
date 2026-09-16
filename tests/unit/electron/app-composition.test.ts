import { describe, expect, it, vi } from "vitest"

const ensureChannelCatalog = vi.hoisted(() => vi.fn())
const restoreRuntime = vi.hoisted(() => vi.fn())

vi.mock("@/electron/app/channels/application/channel-catalog-service", () => ({ ensureChannelCatalog }))
vi.mock("@/electron/app/channels/application/channel-application-service", () => ({
  channelApplicationService: { restoreRuntime },
}))

import { createElectronApp } from "@/electron/app"

describe("Electron app composition", () => {
  it("initializes the channel catalog before restoring the runtime", async () => {
    ensureChannelCatalog.mockResolvedValue(undefined)
    restoreRuntime.mockResolvedValue(undefined)

    await createElectronApp().initialize()

    expect(ensureChannelCatalog).toHaveBeenCalledOnce()
    expect(restoreRuntime).toHaveBeenCalledOnce()
    expect(ensureChannelCatalog.mock.invocationCallOrder[0]).toBeLessThan(restoreRuntime.mock.invocationCallOrder[0])
  })
})
