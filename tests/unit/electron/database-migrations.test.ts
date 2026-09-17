import { describe, expect, it } from "vitest"

import { readMigrationFiles } from "drizzle-orm/migrator"

import { resolve } from "node:path"

describe("database migrations", () => {
  it("has a readable Drizzle Kit migration", () => {
    const migrations = readMigrationFiles({ migrationsFolder: resolve(process.cwd(), "src/drizzle/migrations") })
    expect(migrations.length).toBeGreaterThan(0)
    expect(migrations.every((migration) => migration.folderMillis > 0)).toBe(true)
  })

  it("contains the core tables and migration safety rules", () => {
    const migrations = readMigrationFiles({ migrationsFolder: resolve(process.cwd(), "src/drizzle/migrations") })
    const statements = migrations
      .flatMap((migration) => migration.sql)
      .join(" ")
      .toLowerCase()
    for (const table of ["app_meta", "chats", "workflows", "providers", "integrations", "channels", "scheduler_runs"]) {
      expect(statements).toContain(table)
    }
  })
})
