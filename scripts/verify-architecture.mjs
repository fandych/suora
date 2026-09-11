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
const forbiddenRepositoryServiceImport = /from\s+["']@\/services\//
const forbiddenRelativeImport = /from\s+["']\.\.?\//
const forbiddenViewRepositoryImport = /from\s+["']@\/(?:data\/repositories|services)\//
const forbiddenDomainRepositoryImport = /from\s+["']@\/data\/repositories\//
const forbiddenElectronRootImport = /from\s+["']@\/electron\/(?:application|channels|infrastructure|integrations|services)\//
const rawSql = /(?:database|db)\.(?:prepare|exec)\s*\(/
const violations = []
for (const file of [...dataFiles, ...serviceFiles]) {
  const source = await readFile(file, "utf8")
  if (forbiddenViewImport.test(source)) violations.push(`View dependency: ${path.relative(root, file)}`)
  if (file.includes(`${path.sep}data${path.sep}repositories${path.sep}`) && forbiddenRepositoryServiceImport.test(source)) violations.push(`Repository -> service dependency: ${path.relative(root, file)}`)
  if (file.includes(`${path.sep}data${path.sep}domain${path.sep}`) && forbiddenRepositoryServiceImport.test(source)) violations.push(`Domain -> service dependency: ${path.relative(root, file)}`)
  if (file.includes(`${path.sep}data${path.sep}domain${path.sep}`) && forbiddenDomainRepositoryImport.test(source)) violations.push(`Domain -> repository dependency: ${path.relative(root, file)}`)
}
const viewFiles = await collect(path.join(root, "src", "views"))
for (const file of viewFiles) if (forbiddenViewRepositoryImport.test(await readFile(file, "utf8"))) violations.push(`View -> data/service dependency: ${path.relative(root, file)}`)
for (const file of [...dataFiles, ...serviceFiles]) if (forbiddenRelativeImport.test(await readFile(file, "utf8"))) violations.push(`Relative local import: ${path.relative(root, file)}`)
for (const file of ipcFiles) if (rawSql.test(await readFile(file, "utf8"))) violations.push(`Raw SQL in IPC: ${path.relative(root, file)}`)
for (const file of await collect(path.join(root, "electron"))) if (forbiddenElectronRootImport.test(await readFile(file, "utf8"))) violations.push(`Electron old-root dependency: ${path.relative(root, file)}`)
for (const directory of ["application", "channels", "infrastructure", "integrations", "services"]) {
  try { await readdir(path.join(root, "electron", directory)); violations.push(`Electron old directory remains: electron/${directory}`) } catch { /* expected */ }
}
if (violations.length) { console.error(violations.join("\n")); process.exitCode = 1 }
else console.log("Architecture verification passed: no data/service -> view imports and no raw SQL in IPC.")