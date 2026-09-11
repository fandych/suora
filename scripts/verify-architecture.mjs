import { readFile, readdir } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const collect = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collect(file))
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(file)
  }
  return files
}

const dataFiles = await collect(path.join(root, "src", "data"))
const serviceFiles = await collect(path.join(root, "src", "services"))
const ipcFiles = await collect(path.join(root, "electron", "ipc"))
const forbiddenViewImport = /from\s+["']@\/views\//
const rawSql = /(?:database|db)\.(?:prepare|exec)\s*\(/
const violations = []
for (const file of [...dataFiles, ...serviceFiles]) if (forbiddenViewImport.test(await readFile(file, "utf8"))) violations.push(`View dependency: ${path.relative(root, file)}`)
for (const file of ipcFiles) if (rawSql.test(await readFile(file, "utf8"))) violations.push(`Raw SQL in IPC: ${path.relative(root, file)}`)
if (violations.length) { console.error(violations.join("\n")); process.exitCode = 1 }
else console.log("Architecture verification passed: no data/service -> view imports and no raw SQL in IPC.")