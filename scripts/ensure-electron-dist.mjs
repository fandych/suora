import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const isStrict = process.argv.includes("--strict")
const electronRoot = path.resolve("node_modules", "electron")
const electronDist = path.join(electronRoot, "dist")
const electronExecutable = path.join(electronDist, process.platform === "win32" ? "electron.exe" : "electron")

if (fs.existsSync(electronExecutable)) {
  process.exit(0)
}

const installScript = path.join(electronRoot, "install.js")

if (!fs.existsSync(installScript)) {
  console.error("Electron install script was not found in node_modules/electron.")
  process.exit(1)
}

console.warn("Electron runtime binary is missing. Attempting to download it now...")

const result = spawnSync(process.execPath, [installScript], {
  stdio: "inherit",
  env: {
    ...process.env,
    ELECTRON_GET_USE_PROXY: process.env.ELECTRON_GET_USE_PROXY || "true",
  },
})

if (result.status !== 0 || !fs.existsSync(electronExecutable)) {
  const message = [
    "Electron runtime download did not complete successfully.",
    "If you are behind a proxy or TLS-inspecting network, set HTTP(S)_PROXY or ELECTRON_GET_USE_PROXY before npm install.",
    "Run `npm run electron:download` to retry later, or copy node_modules/electron/dist from the legacy suora workspace on this machine.",
  ].join("\n")

  if (isStrict) {
    console.error(message)
    process.exit(result.status ?? 1)
  }

  console.warn(
    [
      message,
      "Continuing install because app dependencies are already usable without the Electron binary.",
    ].join("\n")
  )
  process.exit(0)
}