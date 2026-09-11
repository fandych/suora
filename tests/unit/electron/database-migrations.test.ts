import { describe, expect, it } from "vitest"

import { runtimeMigrations } from "@shared/database/migrations"

describe("database migrations", () => {
  it("has ordered unique migration IDs", () => {
    const ids = runtimeMigrations.map((migration) => migration.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual([...ids].sort((left, right) => left - right))
  })

  it("contains the core tables and migration safety rules", () => {
    const statements = runtimeMigrations.flatMap((migration) => migration.statements).join(" ").toLowerCase()
    for (const table of ["app_meta", "chats", "workflows", "providers", "integrations", "channels", "scheduler_runs"]) {
      expect(statements).toContain(table)
    }
    expect(runtimeMigrations.some((migration) => migration.ignoreErrorsMatching?.length)).toBe(true)
  })
})
