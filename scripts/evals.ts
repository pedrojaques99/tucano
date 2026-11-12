// Evals with a real model: the router's own prompt, on Claude (Haiku by default), against cases from a real team
// (Visant's: video, client sites, sales, finance, design, engineering). Each case runs N times, so a regression
// shows apart from the model's noise. It spends a little of the plan: run it by hand before changing the
// router's prompt, not in the test suite.
//
//   npx jiti scripts/evals.ts                 # each case once
//   npx jiti scripts/evals.ts --repeat 3      # 3 times each
//   npx jiti scripts/evals.ts --model sonnet  # another router model
import { spawn } from 'node:child_process'
import { setLang } from '../src/shared/lang'
import type { Agent, Message } from '../src/shared/types'
import { parseRoute, routerPrompt, routerSystem } from '../src/core/router'

setLang('pt')
const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback
}
const repeat = Math.max(1, Number(arg('repeat', '1')))
const model = arg('model', 'haiku')

const agent = (handle: string, role: string, about: string): Agent =>
  ({ id: handle, name: handle[0]!.toUpperCase() + handle.slice(1), handle, role, color: 'sky', instructions: about, modelId: 'sonnet', effort: 'low', limit: 1, used: 0, grants: {}, memory: 'auto', computer: false, archived: false }) as Agent
const TEAM = [
  agent('rollo', 'Motion & Vídeo', 'Vídeo da Visant: reels, showreel, motion, edição no Premiere e geração de vídeo com IA.'),
  agent('felix', 'Web-dev Clientes', 'Sites e landing pages de clientes a partir do template Visant.'),
  agent('torres', 'Comercial Jr', 'Comercial, prospecção (Behance, LinkedIn) e atendimento da Visant.'),
  agent('norton', 'Business Manager', 'Finanças, tarefas, time e ações de negócio; distribui demandas.'),
  agent('darlan', 'Designer Jr', 'Designer júnior: peças, logos, variações e demandas da agência.'),
  agent('ageu', 'Engenharia Visant', 'Infra, Visant Labs, apps internos, MCPs, template e registry.')
]

type Expect = string[] | 'everyone' | 'none' | { anyOf: string[] }
interface Case {
  name: string
  said: { who: string; text: string }[] // oldest to newest; who: 'eu' (the person) or an agent's handle
  expect: Expect
}
const CASES: Case[] = [
  { name: 'reel de lançamento', said: [{ who: 'eu', text: 'Preciso de um reel de 30s pro lançamento da marca Tomarillo, com a trilha que mandei.' }], expect: ['rollo'] },
  { name: 'site de cliente fora do ar', said: [{ who: 'eu', text: 'O site da clínica Aurora tá fora do ar desde cedo.' }], expect: { anyOf: ['felix', 'ageu'] } },
  { name: 'cumprimento ao grupo', said: [{ who: 'eu', text: 'Bom dia, pessoal!' }], expect: 'everyone' },
  { name: 'agradecimento', said: [{ who: 'rollo', text: 'Reel final renderizado e no Drive.' }, { who: 'eu', text: 'Valeu, ficou ótimo' }], expect: 'none' },
  { name: 'receita do mês', said: [{ who: 'eu', text: 'Quanto entrou de receita esse mês e quem ainda não pagou?' }], expect: ['norton'] },
  { name: 'prospecção', said: [{ who: 'eu', text: 'Acha 10 estúdios no Behance que podem precisar de branding pra gente prospectar.' }], expect: ['torres'] },
  { name: 'MCP com timeout', said: [{ who: 'eu', text: 'O MCP do Visant Labs tá dando timeout em toda chamada.' }], expect: ['ageu'] },
  { name: 'variação de logo', said: [{ who: 'eu', text: 'Faz três variações do logo da Tomarillo em verde.' }], expect: { anyOf: ['darlan'] } },
  { name: '"pode" responde a quem perguntou', said: [{ who: 'eu', text: 'Rollo, ajusta o corte do reel.' }, { who: 'rollo', text: 'Ajustei o corte. Posso renderizar a versão final em 4K?' }, { who: 'eu', text: 'pode' }], expect: ['rollo'] },
  { name: 'demanda a distribuir', said: [{ who: 'eu', text: 'Chegou demanda nova da Aurora: site novo, reel e cartão de visita. Organiza quem faz o quê.' }], expect: { anyOf: ['norton'] } }
]

const messages = (c: Case): Message[] =>
  c.said.map((m, i) => ({
    id: `m${i}`,
    conversationId: 'c1',
    author: m.who === 'eu' ? ({ kind: 'person', id: 'owner' } as Message['author']) : ({ kind: 'agent', id: m.who } as Message['author']),
    text: m.text,
    at: Date.now() - (c.said.length - i) * 60_000
  }))

function claude(system: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--model', model, '--system-prompt', system, '--tools', '', '--strict-mcp-config', '--output-format', 'text'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    let out = ''
    let err = ''
    child.stdout.on('data', (d: Buffer) => (out += d.toString()))
    child.stderr.on('data', (d: Buffer) => (err += d.toString()))
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(err.trim() || `claude exited ${code}`))))
    child.stdin.end(prompt)
  })
}

const verdict = (e: Expect, got: { agents: Agent[] } | null, everyone: boolean): boolean => {
  if (!got) return false
  const handles = got.agents.map((a) => a.handle)
  if (e === 'everyone') return everyone
  if (e === 'none') return handles.length === 0
  if (Array.isArray(e)) return !everyone && e.every((h) => handles.includes(h)) && handles.length <= e.length + 1
  return !everyone && handles.some((h) => e.anyOf.includes(h))
}

let passed = 0
let total = 0
for (const c of CASES) {
  const results: string[] = []
  let ok = 0
  for (let i = 0; i < repeat; i++) {
    const text = await claude(routerSystem(), routerPrompt({ messages: messages(c), agents: TEAM, me: 'Jaques' })).catch((e: Error) => `ERRO ${e.message}`)
    const everyone = /"(todos|everyone)"\s*:\s*true/.test(text)
    const got = parseRoute(text, TEAM)
    const good = verdict(c.expect, got, everyone)
    ok += good ? 1 : 0
    results.push(everyone ? 'todos' : got ? got.agents.map((a) => a.handle).join('+') || '∅' : 'fora do formato')
  }
  passed += ok
  total += repeat
  const want = typeof c.expect === 'string' ? c.expect : Array.isArray(c.expect) ? c.expect.join('+') : `um de ${c.expect.anyOf.join('/')}`
  console.log(`${ok === repeat ? 'ok  ' : ok ? 'meio' : 'FALHA'}  ${c.name.padEnd(36)} esperado ${want.padEnd(16)} veio ${results.join(', ')}`)
}
console.log(`\n${passed}/${total} (${Math.round((passed / total) * 100)}%) · modelo ${model} · ${repeat}x cada`)
process.exit(passed === total ? 0 : 1)
