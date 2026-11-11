// Screenshots of Settings › Models, top to bottom, on a new install with the fake engines (some
// harnesses ready, the rest not installed), light and dark.
//   node scripts/screens-models.mjs <out dir>
import { _electron as electron } from 'playwright'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const out = process.argv[2] ?? 'screens/models'
mkdirSync(out, { recursive: true })
const made = []
const track = (d) => (made.push(d), d)
const errors = []
for (const theme of ['light', 'dark']) {
  const app = await electron.launch({ args: ['.'], env: { ...process.env, TUCANO_DATA: track(mkdtempSync(join(tmpdir(), 'tuc-'))), TUCANO_FAKE_ENGINES: '1', TUCANO_SEED: '0', TUCANO_LOCALE: 'pt-BR' } })
  const win = await app.firstWindow()
  win.on('pageerror', (e) => errors.push(String(e)))
  win.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await win.setViewportSize({ width: 1280, height: 800 })
  if (theme === 'dark') await win.emulateMedia({ colorScheme: 'dark' })
  await win.waitForSelector('.splash')
  await win.click('.splash')
  await win.waitForSelector('.intro')
  await win.click('button:has-text("Já uso agentes")')
  await win.fill('.intro-input', 'Carol')
  await win.click('button:has-text("Continuar")')
  await win.waitForTimeout(1500)
  while ((await win.locator('.intro-bring .toggle.is-on').count()) > 0) await win.locator('.intro-bring .toggle.is-on').first().click()
  await win.click('button:has-text("Continuar")')
  await win.click('button:has-text("Pesquisar e resumir")')
  await win.click('button:has-text("pro time")')
  await win.waitForSelector('.main .composer')
  await win.click('.nav-item:has-text("Configurações")')
  await win.click('[role="tab"]:has-text("Modelos"), button:has-text("Modelos")')
  await win.waitForTimeout(1200)
  // Scroll the page's own scroller, a screen at a time.
  const scroller = await win.evaluateHandle(() => {
    const all = [...document.querySelectorAll('.main *')].filter((e) => e.scrollHeight > e.clientHeight + 40 && getComputedStyle(e).overflowY !== 'visible')
    return all.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] ?? document.scrollingElement
  })
  const height = await scroller.evaluate((e) => e.scrollHeight)
  for (let y = 0, i = 1; y < height; y += 700, i++) {
    await scroller.evaluate((e, top) => e.scrollTo(0, top), y)
    await win.waitForTimeout(250)
    await win.screenshot({ path: `${out}/${theme}-${String(i).padStart(2, '0')}.png` })
  }
  await win.setViewportSize({ width: 390, height: 800 })
  await scroller.evaluate((e) => e.scrollTo(0, 0))
  await win.waitForTimeout(300)
  const overflow = await win.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  await win.screenshot({ path: `${out}/${theme}-phone.png` })
  console.log(theme, 'height', height, 'overflow@390', overflow)
  await app.close()
}
console.log('erros:', errors)
if (errors.length) process.exitCode = 1

// Each run's throwaway data folders go with it: hundreds of them filled a disk once.
process.on('exit', () => { for (const d of made) try { rmSync(d, { recursive: true, force: true }) } catch {} })
