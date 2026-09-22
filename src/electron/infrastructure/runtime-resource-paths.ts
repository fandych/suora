import { existsSync } from "node:fs"
import path from "node:path"

type RuntimePathSearchOptions = {
  moduleDir: string
  cwd?: string
  moduleRelativePaths?: string[]
  cwdRelativePaths?: string[]
}

export function resolveExistingRuntimePath({
  moduleDir,
  cwd = process.cwd(),
  moduleRelativePaths = [],
  cwdRelativePaths = [],
}: RuntimePathSearchOptions) {
  const candidates = [
    ...moduleRelativePaths.map((relativePath) => path.resolve(moduleDir, relativePath)),
    ...cwdRelativePaths.map((relativePath) => path.resolve(cwd, relativePath)),
  ]

  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

export function getDrizzleMigrationsFolder(moduleDir: string, cwd?: string) {
  return resolveExistingRuntimePath({
    moduleDir,
    cwd,
    moduleRelativePaths: ["drizzle/migrations", "../drizzle/migrations"],
    cwdRelativePaths: ["src/drizzle/migrations", "out/main/drizzle/migrations"],
  })
}

export function getMainWindowIconPath(moduleDir: string, cwd?: string) {
  return resolveExistingRuntimePath({
    moduleDir,
    cwd,
    cwdRelativePaths: ["resources/icons/icon-256x256.png"],
  })
}
