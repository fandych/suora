import { afterEach, describe, expect, it } from "vitest"

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { tmpdir } from "node:os"

import { getDrizzleMigrationsFolder, getMainWindowIconPath } from "@/electron/infrastructure/runtime-resource-paths"

const tempDirectories: string[] = []

function createTempDir() {
  const directory = mkdtempSync(path.join(tmpdir(), "suora-runtime-paths-"))
  tempDirectories.push(directory)
  return directory
}

afterEach(() => {
  while (tempDirectories.length > 0) {
    const directory = tempDirectories.pop()
    if (directory) {
      rmSync(directory, { recursive: true, force: true })
    }
  }
})

describe("runtime resource paths", () => {
  it("finds migrations copied next to the packaged main bundle", () => {
    const root = createTempDir()
    const mainDir = path.join(root, "out", "main")
    const migrationsDir = path.join(mainDir, "drizzle", "migrations")
    mkdirSync(migrationsDir, { recursive: true })

    expect(getDrizzleMigrationsFolder(mainDir, root)).toBe(migrationsDir)
  })

  it("finds migrations when the caller lives in a chunk subdirectory", () => {
    const root = createTempDir()
    const moduleDir = path.join(root, "out", "main", "chunks")
    const migrationsDir = path.join(root, "out", "main", "drizzle", "migrations")
    mkdirSync(migrationsDir, { recursive: true })
    mkdirSync(moduleDir, { recursive: true })

    expect(getDrizzleMigrationsFolder(moduleDir, root)).toBe(migrationsDir)
  })

  it("falls back to the source migrations directory in development", () => {
    const root = createTempDir()
    const moduleDir = path.join(root, "src", "electron", "infrastructure")
    const migrationsDir = path.join(root, "src", "drizzle", "migrations")
    mkdirSync(migrationsDir, { recursive: true })
    mkdirSync(moduleDir, { recursive: true })

    expect(getDrizzleMigrationsFolder(moduleDir, root)).toBe(migrationsDir)
  })

  it("uses the repository icon in development and tolerates packaged builds without that file", () => {
    const root = createTempDir()
    const moduleDir = path.join(root, "out", "main")
    const iconPath = path.join(root, "resources", "icons", "icon-256x256.png")
    mkdirSync(path.dirname(iconPath), { recursive: true })
    writeFileSync(iconPath, "icon")

    expect(getMainWindowIconPath(moduleDir, root)).toBe(iconPath)
    expect(getMainWindowIconPath(moduleDir, path.join(root, "missing"))).toBeNull()
  })
})
