// Strokes thicker than a hairline in the app's CSS: borders, inset rings and outlines over 1px, which
// read as heavy (the classic AI-made look). Prints file:line and the rule's selector; exits 1 when any
// is found outside a written exception (`stroke-ok: reason` in a comment on the same line).
//   node scripts/stroke-scan.mjs [css file]
import { readFileSync } from 'node:fs'

const file = process.argv[2] ?? 'src/renderer/src/styles.css'
const lines = readFileSync(file, 'utf8').split('\n')
const THICK = [
  /border(?:-(?:top|right|bottom|left))?(?:-width)?:\s*(?:[^;]*\s)?(1\.\d+|[2-9](?:\.\d+)?)px/,
  /inset 0 0 0 (1\.\d+|[2-9](?:\.\d+)?)px/,
  /(?<!inset )0 0 0 (1\.\d+|[2-9](?:\.\d+)?)px var\(--(?:accent|border|text|ink|agent|i-)/,
  /outline:\s*(1\.\d+|[2-9])px/,
  /stroke-width:\s*(1\.\d+|[2-9](?:\.\d+)?)\b/
]
let selector = ''
const found = []
lines.forEach((line, i) => {
  if (/\{\s*$/.test(line) && !/^\s*@/.test(line)) selector = line.replace(/\s*\{\s*$/, '').trim()
  if (/stroke-ok:/.test(line)) return
  for (const re of THICK) {
    const m = re.exec(line)
    if (m) {
      found.push(`${file}:${i + 1}  ${m[1]}px  ${selector}  |  ${line.trim()}`)
      break
    }
  }
})
console.log(found.join('\n'))
console.log(`\n${found.length} stroke(s) over 1px`)
process.exitCode = found.length ? 1 : 0
