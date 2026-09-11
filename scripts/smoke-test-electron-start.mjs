import { spawn } from "node:child_process"
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 30_000)
const command = process.platform === "win32" ? "npm.cmd" : "npm"
const args = ["run", "dev:root"]

const child = spawn(command, args, { stdio: "pipe", env: { ...process.env }, detached: process.platform !== "win32" })
let output = ""
const append = (chunk) => { output += chunk.toString(); process.stdout.write(chunk) }
child.stdout.on("data", append)
child.stderr.on("data", append)

const timer = setTimeout(() => {
  stopProcessTree()
}, timeoutMs)

function stopProcessTree() {
  if (child.killed) return
  if (process.platform !== "win32" && child.pid) {
    try { process.kill(-child.pid, "SIGTERM") } catch { child.kill("SIGTERM") }
  } else {
    child.kill("SIGTERM")
  }
}

try {
  await new Promise((resolve, reject) => {
    let started = false
    const onData = (chunk) => {
      const text = chunk.toString()
      if (text.includes("starting electron app...") || text.includes("GPU") || text.includes("GpuControl")) {
        if (!started) {
          started = true
          setTimeout(resolve, 2_000)
        }
      }
    }
    child.stdout.on("data", onData)
    child.stderr.on("data", onData)
    setTimeout(resolve, 8_000)
    child.once("exit", (code) => code && code !== 0 ? reject(new Error(`Electron Smoke exited with ${code}.\n${output}`)) : resolve())
  })
} catch (error) {
  stopProcessTree()
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} finally {
  clearTimeout(timer)
  stopProcessTree()
}
