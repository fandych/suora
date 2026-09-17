import { parseWorkspaceCommand, resolveWorkspaceSpawnCommand } from "@/electron/app/tools/tool-guardrails"
import { validateQueryPayload } from "@/electron/infrastructure/db-query-policy"

describe("Electron security boundaries", () => {
  it("parses allowed commands without invoking a shell", () => {
    expect(parseWorkspaceCommand('npm run "type-check"')).toMatchObject({
      executableName: "npm",
      args: ["run", "type-check"],
    })
  })

  it("wraps Windows cmd launchers in a cmd.exe spawn command", () => {
    const parsed = parseWorkspaceCommand('npm run "type-check"')
    const spawnCommand = resolveWorkspaceSpawnCommand(parsed)

    if (process.platform === "win32") {
      expect(spawnCommand).toMatchObject({
        executable: expect.stringMatching(/cmd(\.exe)?$/i),
        args: ["/d", "/s", "/c", "npm.cmd", "run", "type-check"],
        shell: false,
      })
    } else {
      expect(spawnCommand).toMatchObject({
        executable: parsed.executable,
        args: parsed.args,
        shell: false,
      })
    }
  })

  it("blocks shell executables and unsupported binaries", () => {
    expect(() => parseWorkspaceCommand("bash -c whoami")).toThrow(/shell executables are blocked/)
    expect(() => parseWorkspaceCommand("curl https://example.com")).toThrow(/not allowed/)
  })

  it("rejects multi-statement and pragma database payloads", () => {
    expect(() => validateQueryPayload({ sql: "SELECT 1; DELETE FROM providers", params: [], method: "all" })).toThrow(
      /not allowed/,
    )
    expect(() => validateQueryPayload({ sql: "PRAGMA journal_mode", params: [], method: "all" })).toThrow(/not allowed/)
  })

  it("accepts a parameterized single statement", () => {
    expect(() =>
      validateQueryPayload({ sql: "SELECT * FROM providers WHERE id = ?", params: ["provider-1"], method: "get" }),
    ).not.toThrow()
  })

  it("blocks internal tables and mismatched query methods", () => {
    expect(() => validateQueryPayload({ sql: "SELECT * FROM sqlite_master", params: [], method: "all" })).toThrow(
      /Internal database tables/,
    )
    expect(() => validateQueryPayload({ sql: "SELECT 1", params: [], method: "run" })).toThrow(/read query method/)
    expect(() =>
      validateQueryPayload({ sql: "DELETE FROM providers WHERE id = ?", params: ["provider-1"], method: "all" }),
    ).toThrow(/read-only SQL/)
  })
})
