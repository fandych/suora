import { _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const electronExecutable = process.platform === 'win32'
  ? path.join('node_modules', 'electron', 'dist', 'electron.exe')
  : process.platform === 'darwin'
    ? path.join('node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron')
    : path.join('node_modules', 'electron', 'dist', 'electron')
const mainEntry = path.join('out', 'main', 'main.js')

for (const requiredPath of [electronExecutable, mainEntry]) {
  if (!fs.existsSync(requiredPath)) {
    throw new Error(`Electron smoke prerequisite missing: ${requiredPath}. Run npm install and npm run build before npm run test:electron-smoke.`)
  }
}

const app = await electron.launch({
  executablePath: electronExecutable,
  args: [mainEntry],
  env: { ...process.env },
})

const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(1200)

const results = []

async function record(name, run) {
  try {
    results.push({ name, ok: true, ...(await run()) })
  } catch (error) {
    results.push({
      name,
      ok: false,
      error: error instanceof Error ? error.message.split('\n')[0] : String(error),
    })
  }
}

await record('window loads', async () => ({
  title: await page.title(),
  url: page.url(),
}))

await record('electron bridge rejects unknown IPC', async () => {
  const bridgeResult = await page.evaluate(async () => {
    const bridge = globalThis.electron
    if (!bridge?.invoke) return 'missing'
    try {
      await bridge.invoke('not:allowed')
      return 'allowed'
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  })
  if (bridgeResult === 'missing' || bridgeResult === 'allowed') {
    throw new Error(`Unexpected bridge result: ${bridgeResult}`)
  }
  return { bridgeResult }
})

await record('dismiss onboarding if present', async () => {
  const skipButtons = page.getByRole('button', { name: 'Skip setup' })
  const count = await skipButtons.count()
  if (count === 0) return { skipped: false }

  await skipButtons.first().click({ timeout: 3000 })
  await page.waitForTimeout(300)
  if (await page.getByText('Skip setup?').isVisible().catch(() => false)) {
    await skipButtons.last().click({ timeout: 3000 })
  }
  await page.waitForTimeout(500)
  return { skipped: true, dialogs: await page.getByRole('dialog').count() }
})

async function clickNav(target) {
  await page.getByRole('button', { name: target.name }).click({ timeout: 5000 })
  await page.waitForTimeout(700)
  return {
    url: page.url(),
    heading: await page.locator('h1,h2').first().textContent().catch(() => ''),
  }
}

const navigationTargets = [
  { label: 'Chat', name: /^(Chat|对话)$/ },
  { label: 'Documents', name: /^(Documents|文档)$/ },
  { label: 'Pipeline', name: /^(Pipeline|流水线)$/ },
  { label: 'Timer', name: /^(Timer|定时任务)$/ },
  { label: 'Channels', name: /^(Channels|渠道)$/ },
  { label: 'Agents', name: /^(Agents|智能体)$/ },
  { label: 'Skills', name: /^(Skills|技能)$/ },
  { label: 'Models', name: /^(Models|模型)$/ },
  { label: 'MCP Servers', name: /^(MCP Servers|MCP 服务器)$/ },
]

for (const target of navigationTargets) {
  await record(`navigate ${target.label}`, () => clickNav(target))
}

await record('visible navigation controls', async () => {
  const controls = await page.evaluate(() => Array.from(document.querySelectorAll('button, a'))
    .map((element) => {
      const rect = element.getBoundingClientRect()
      return {
        text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
        aria: element.getAttribute('aria-label'),
        title: element.getAttribute('title'),
        visible: rect.width > 0 && rect.height > 0,
      }
    })
    .filter((control) => control.visible)
    .slice(0, 80))
  return { controls }
})

console.log(JSON.stringify(results, null, 2))

const failed = results.filter((result) => !result.ok)
await app.close()
if (failed.length > 0) {
  process.exitCode = 1
}