// The first run, checked end to end in one command: build, every onboarding screen captured
// (scripts/screens-onboarding.mjs, fake engines, light, dark, English), then the design scan over
// the onboarding's own files when the visant-killer skill is installed (a report). Exit 0 when the
// build and every screen ran with no page error; the screenshots stay in the out dir, to look at.
//   node scripts/onboarding-gate.mjs [out dir] [--no-build]
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const out = args.find((a) => !a.startsWith('--')) ?? 'screens/onboarding'
const FILES = ['Intro.tsx', 'Onboarding.tsx', 'Coach.tsx', 'Missions.tsx', 'Splash.tsx', 'Decisions.tsx', 'AutonomyPick.tsx'].map((f) => `src/renderer/src/components/${f}`)

const step = (name, cmd, cmdArgs) => {
  console.log(`\n▸ ${name}`)
  // npm is a .cmd on Windows and needs a shell; node runs straight (its path may hold spaces).
  const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: process.platform === 'win32' && cmd === 'npm' })
  return r.status ?? 1
}

const results = []
if (!args.includes('--no-build')) results.push(['build', step('build', 'npm', ['run', 'build'])])
if (results.every(([, s]) => s === 0)) results.push(['screens', step(`screens → ${out}`, process.execPath, ['scripts/screens-onboarding.mjs', out])])

// The code half of the design scan, as a report: some of what it flags is the app's own vocabulary
// (" · " between facts, the harnesses' official marks as inline SVG), so it informs and never blocks.
// The screen half is the screenshots above: the app is Electron, there is no URL to open.
const scan = join(homedir(), '.claude', 'skills', 'visant-killer', 'scripts', 'killer-scan.mjs')
if (existsSync(scan)) step('design scan (code, report only)', process.execPath, [scan, ...FILES])
else console.log('\n▸ design scan: skipped (visant-killer skill not installed)')

console.log('\n' + results.map(([n, s]) => `${s === 0 ? 'ok  ' : 'FAIL'}  ${n}`).join('\n'))
console.log(`look at: ${out}`)
process.exit(results.some(([, s]) => s !== 0) ? 1 : 0)
