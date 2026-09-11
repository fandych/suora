import type { QueryPayload } from "@electron/types"

export function validateQueryPayload(payload: QueryPayload) {
  if (!payload || typeof payload.sql !== "string" || !payload.sql.trim()) {
    throw new Error("Database query must contain SQL.")
  }
  if (!Array.isArray(payload.params) || !["run", "all", "values", "get"].includes(payload.method)) {
    throw new Error("Invalid database query payload.")
  }

  const sql = payload.sql.trim()
  if (sql.includes(";") || /\b(?:attach|detach|pragma|vacuum|load_extension)\b/i.test(sql)) {
    throw new Error("This database operation is not allowed through the renderer database bridge.")
  }
  if (/\b(?:sqlite_master|sqlite_schema|__app_migrations)\b/i.test(sql)) {
    throw new Error("Internal database tables are not available through the renderer database bridge.")
  }

  const keyword = sql.match(/^([a-z]+)/i)?.[1]?.toLowerCase()
  const readMethods = new Set(["all", "get", "values"])
  if (payload.method === "run" && keyword === "select") {
    throw new Error("Read queries must use a read query method.")
  }
  if (readMethods.has(payload.method) && keyword && !["select", "with", "explain"].includes(keyword)) {
    throw new Error("Read query methods only accept read-only SQL.")
  }
}
