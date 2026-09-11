import { beforeEach, describe, expect, it, vi } from "vitest"

const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>()
const prepared = vi.fn(() => ({ all: vi.fn(() => [{ id: "provider-1", title: "OpenAI", providerType: "openai", updatedAt: 1 }]), get: vi.fn(() => ({ id: "provider-1", title: "OpenAI", providerType: "openai", updatedAt: 1 })) }))

vi.mock("electron", () => ({ ipcMain: { handle: vi.fn((name: string, handler: (...args: unknown[]) => Promise<unknown>) => handlers.set(name, handler)) } }))
vi.mock("@electron/others/infrastructure/db-core", () => ({ applyMigrations: vi.fn(), openDatabase: vi.fn(() => ({ prepare: prepared })) }))
vi.mock("@electron/others/infrastructure/workspace-service", () => ({ ensureWorkspace: vi.fn() }))

describe("catalog IPC handlers", () => {
  beforeEach(async () => {
    handlers.clear()
    vi.resetModules()
    const module = await import("@electron/ipc/domain/catalog-ipc")
    module.registerCatalogIpc()
  })

  it("serves a catalog route without exposing SQL input", async () => {
    const result = await handlers.get("catalog:list")?.({}, "/models")
    expect(result).toEqual([{ id: "provider-1", title: "OpenAI", providerType: "openai", updatedAt: 1 }])
    expect(prepared).toHaveBeenCalledWith(expect.stringContaining("FROM providers"))
  })

  it("rejects unsupported catalog routes at the IPC boundary", async () => {
    await expect(handlers.get("catalog:list")?.({}, "/sqlite_master")).rejects.toThrow(/Invalid IPC payload/)
  })
})
