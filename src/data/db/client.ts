import { drizzle } from "drizzle-orm/sqlite-proxy"

import { schema } from "@/data/db/schema"

type DatabaseContext = {
  db: ReturnType<typeof drizzle<typeof schema>>
  execute: (sql: string, params: unknown[], method: QueryMethod) => Promise<QueryResult>
}

let databaseContextPromise: Promise<DatabaseContext> | undefined

type QueryMethod = "run" | "all" | "values" | "get"

type QueryResult = {
  rows: unknown[]
}

function getElectronBridge() {
  const bridge = window.electron
  if (!bridge?.invoke) {
    throw new Error("Electron IPC bridge is not available.")
  }
  return bridge
}

async function createDatabaseContext(): Promise<DatabaseContext> {
  const bridge = getElectronBridge()
  const callback = async (sql: string, params: unknown[], method: QueryMethod) => {
    const result = await bridge.invoke("db:execute", { sql, params, method })
    return result as QueryResult
  }

  return {
    execute: callback,
    db: drizzle(callback, { schema }),
  }
}

export async function getDatabaseContext() {
  if (!databaseContextPromise) {
    databaseContextPromise = createDatabaseContext()
  }

  return databaseContextPromise
}

export async function executePersistedMutation<T>(operation: (context: DatabaseContext) => T | Promise<T>) {
  const context = await getDatabaseContext()
  return operation(context)
}

export async function pingDatabase() {
  const context = await getDatabaseContext()
  return context.execute("SELECT 1 AS value", [], "all")
}