import path from "node:path"
import ts from "typescript"

const configPath = path.resolve("tsconfig.json")
const config = ts.readConfigFile(configPath, ts.sys.readFile)

if (config.error) {
  console.error(ts.formatDiagnostic(config.error, createDiagnosticHost()))
  process.exitCode = 1
} else {
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath), undefined, configPath)
  const program = ts.createProgram(parsed.fileNames, parsed.options)
  const ignoredFile = path.resolve("src/components/ui/scroll-area.tsx")
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => !(diagnostic.code === 6133 && diagnostic.file?.fileName === ignoredFile))

  if (diagnostics.length > 0) {
    console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, createDiagnosticHost()))
    process.exitCode = 1
  }
}

function createDiagnosticHost() {
  return {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine,
  }
}
