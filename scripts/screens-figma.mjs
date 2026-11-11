// The Figma connector end to end, in the built app: the store card, its warning, the connector once
// connected, and an agent using it in a DM (the step saying what it's doing, then the result).
// Fresh data dir and the fake engines, but the bridge is real: it needs Claude Code signed in to Figma,
// and each call spends a little of the plan.
//
//   npm run build && node scripts/screens-figma.mjs [out-dir]
import { _electron as electron } from 'playwright'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = process.argv[2] ?? 'screens-figma'
mkdirSync(out, { recursive: true })
const app = await electron.launch({ args: ['.'], env: { ...process.env, TUCANO_DATA: mkdtempSync(join(tmpdir(), 'tucano-')), TUCANO_SEED: '1', TUCANO_FAKE_ENGINES: '1' } })
const win = await app.firstWindow()
await win.setViewportSize({ width: 1280, height: 820 })
await win.waitForSelector('.sidebar')
const errors = []
win.on('pageerror', (e) => errors.push(String(e)))
const shot = (name) => win.screenshot({ path: `${out}/${name}.png` })

await win.click('.nav-item:has-text("Conectores")')
await win.fill('input[aria-label="Buscar conectores"]', 'figma')
await shot('01-loja')
await win.click('.catalog__card:has-text("Figma") button:has-text("Conectar")')
await shot('02-aviso')
await win.click('button:has-text("Entendi, conectar")')
await win.waitForSelector('.connector-modal .tag:text-is("conectado")', { timeout: 120_000 })
await shot('03-conectado')
await win.keyboard.press('Escape')

await win.click('.section:has-text("Agentes") .nav-item:has-text("Lia")')
await win.click('.tabs [role=tab]:has-text("Ferramentas")')
await win.click('.grant:has-text("Figma") button:has-text("Ler"):not(:has-text("escrever"))')
await win.click('button:has-text("Salvar")')
await win.waitForSelector('.saved')
await win.click('text=Abrir DM')
await win.fill('.composer textarea', 'No Figma, rode `whoami`.')
await win.keyboard.press('Enter')
// The run's line says what it's doing; the steps (and the progress inside one) open on "ver mais".
await win.waitForSelector('.steps.is-working', { timeout: 60_000 })
await shot('04a-trabalhando')
await win.click('.steps__toggle')
await win.waitForSelector('.step__progress', { timeout: 60_000 })
await shot('04-rodando')
await win.waitForSelector('.step__progress:has-text("Rodando")', { timeout: 120_000 }).catch(() => {})
await shot('05-rodando-no-figma')
await win.waitForSelector('.steps:not(.is-working)', { timeout: 180_000 })
await win.waitForTimeout(800)
await shot('06-pronto')
// Done, the steps move to the row under the reply, shown on hover.
await win.hover('.msg--agent .md')
await win.click('.msg__meta .steps__toggle')
await shot('07-passos')

if (errors.length) console.log('page errors:\n' + errors.join('\n'))
await app.close()
console.log(`screens in ${out}/`)
