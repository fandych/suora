import { access, readFile, readdir } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const directoryExists = async (directory) =>
  access(directory)
    .then(() => true)
    .catch(() => false)
const collect = async (directory) => {
  if (!(await directoryExists(directory))) return []
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await collect(file)))
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(file)
  }
  return files
}

const dataFiles = await collect(path.join(root, "src", "data"))
const domainFiles = await collect(path.join(root, "src", "domain"))
const serviceFiles = await collect(path.join(root, "src", "services"))
const preloadIpcFiles = await collect(path.join(root, "src", "electron", "preload"))
const appFiles = await collect(path.join(root, "src", "electron", "app"))
const infrastructureFiles = await collect(path.join(root, "src", "electron", "infrastructure"))
const sharedFiles = await collect(path.join(root, "shared"))
const forbiddenViewImport = /from\s+["']@\/views\//
const forbiddenRepositoryServiceImport = /from\s+["']@\/services\//
const forbiddenRelativeImport = /from\s+["']\.\.?\//
const forbiddenViewRepositoryImport = /from\s+["']@\/(?:data\/repositories|services)\//
const forbiddenElectronRootImport = /from\s+["']@\/electron\/(?:application|channels|database|integrations|others|services)\//
const forbiddenElectronRendererImport =
  /from\s+["']@\/(?:application|data|services|views|components|hooks|stores|view-models)\//
const forbiddenAppIpcImport = /from\s+["']@electron\/preload\//
const repositoryFile = /(?:^|\/)repository\.ts$/
const forbiddenInfrastructureAppImport = /from\s+["']@electron\/app\//
const forbiddenAppLegacyRepositoryImport = /from\s+["']@electron\/database\/drizzle\//
const rawSql = /(?:database|db)\.(?:prepare|exec)\s*\(/
const violations = []
const requiredPhaseTwoFiles = [
  path.join(root, "src", "electron", "main.ts"),
  path.join(root, "src", "electron", "preload.ts"),
]
for (const file of requiredPhaseTwoFiles)
  if (!(await directoryExists(file)))
    violations.push(`Electron migration entrypoint is missing: ${path.relative(root, file)}`)
for (const file of [...dataFiles, ...domainFiles, ...serviceFiles]) {
  const source = await readFile(file, "utf8")
  if (forbiddenViewImport.test(source)) violations.push(`View dependency: ${path.relative(root, file)}`)
  if (
    file.includes(`${path.sep}data${path.sep}repositories${path.sep}`) &&
    forbiddenRepositoryServiceImport.test(source)
  )
    violations.push(`Repository -> service dependency: ${path.relative(root, file)}`)
}
const viewFiles = await collect(path.join(root, "src", "views"))
for (const file of viewFiles)
  if (forbiddenViewRepositoryImport.test(await readFile(file, "utf8")))
    violations.push(`View -> data/service dependency: ${path.relative(root, file)}`)
for (const file of [...dataFiles, ...domainFiles, ...serviceFiles])
  if (forbiddenRelativeImport.test(await readFile(file, "utf8")))
    violations.push(`Relative local import: ${path.relative(root, file)}`)
for (const file of preloadIpcFiles)
  if (rawSql.test(await readFile(file, "utf8"))) violations.push(`Raw SQL in IPC: ${path.relative(root, file)}`)
for (const file of appFiles) {
  const source = await readFile(file, "utf8")
  if (forbiddenAppIpcImport.test(source)) violations.push(`App -> IPC dependency: ${path.relative(root, file)}`)
  if (forbiddenAppLegacyRepositoryImport.test(source) && !repositoryFile.test(file))
    violations.push(`App service bypasses module repository: ${path.relative(root, file)}`)
  if (repositoryFile.test(file) && /from\s+["'][^"']*\/service(?:\.ts)?["']/.test(source))
    violations.push(`Repository -> service dependency: ${path.relative(root, file)}`)
}
for (const file of infrastructureFiles)
  if (forbiddenInfrastructureAppImport.test(await readFile(file, "utf8")))
    violations.push(`Infrastructure -> app dependency: ${path.relative(root, file)}`)
for (const file of await collect(path.join(root, "src", "electron"))) {
  const source = await readFile(file, "utf8")
  if (forbiddenElectronRootImport.test(source))
    violations.push(`Electron old-root dependency: ${path.relative(root, file)}`)
  if (forbiddenElectronRendererImport.test(source))
    violations.push(`Electron -> renderer dependency: ${path.relative(root, file)}`)
}
for (const file of sharedFiles)
  if (forbiddenElectronRendererImport.test(await readFile(file, "utf8")))
    violations.push(`Shared -> renderer dependency: ${path.relative(root, file)}`)
try {
  await readdir(path.join(root, "src", "electron", "others"))
  violations.push("Electron old directory remains: src/electron/others")
} catch {
  /* expected */
}
if (violations.length) {
  console.error(violations.join("\n"))
  process.exitCode = 1
} else
  console.log(
    "Architecture verification passed: renderer, IPC, app, repository, and infrastructure boundaries are valid.",
  )
