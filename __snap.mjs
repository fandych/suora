import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const p = await ctx.newPage()
await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await p.waitForTimeout(800)
// Try skip onboarding
const skip = p.locator('button:has-text("Skip setup")')
if (await skip.count()) { await skip.first().click(); await p.waitForTimeout(800) }
await p.screenshot({ path: '/tmp/shot_chat.png', fullPage: false })
// Inspect glass element styles
const info = await p.evaluate(() => {
  const out = {}
  const glassEls = document.querySelectorAll('.glass, .glass-strong, .glass-subtle, .chat-stage-panel, .chat-transcript')
  out.glassCount = glassEls.length
  out.samples = []
  for (const el of Array.from(glassEls).slice(0, 6)) {
    const cs = getComputedStyle(el)
    out.samples.push({
      cls: el.className.toString().slice(0,80),
      backdrop: cs.backdropFilter || cs.webkitBackdropFilter,
      bg: cs.backgroundColor,
      bgImage: cs.backgroundImage.slice(0,80),
      border: cs.borderColor,
    })
  }
  out.bodyBg = getComputedStyle(document.body).backgroundImage.slice(0,160)
  return out
})
console.log(JSON.stringify(info, null, 2))
// Navigate other tabs
for (const r of ['#/agents', '#/skills', '#/settings/general']) {
  await p.goto('http://127.0.0.1:5173/' + r, { waitUntil: 'networkidle' })
  await p.waitForTimeout(700)
  await p.screenshot({ path: '/tmp/shot_' + r.replace(/[#\/]/g,'_') + '.png' })
}
await b.close()
