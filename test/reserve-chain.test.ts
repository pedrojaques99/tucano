import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Account, Agent, EngineId, Message, Settings } from '../src/shared/types'
import { Db, reservesFrom } from '../src/core/db'
import { accountDir } from '../src/core/engines/detect'
import { fakeEngine } from '../src/core/engines/fake'
import type { Engine, EngineEvent, Turn } from '../src/core/engines/types'
import { Runner, reserveChain } from '../src/core/runs'

// One agent, four ways to keep answering: Claude Code on the usual login, Claude Code on another account,
// Antigravity, then OpenCode. When one is out of quota, the reply goes on with the next one that's ready.

const ready = { installed: true, loggedIn: true }
const agent = (extra: Partial<Agent> = {}): Agent => ({ id: 'a1', name: 'lia', handle: 'lia', role: '', color: 'sky', instructions: '', modelId: 'sonnet', effort: 'low', limit: 1_000_000, used: 0, grants: {}, memory: 'auto', computer: false, archived: false, ...extra })
const OUT: EngineEvent = { type: 'error', message: "You've hit your limit · resets 5pm" }

// An engine whose limit is out on some logins (by their folder; undefined: the usual login), or everywhere.
const engine = (id: EngineId, out: (string | undefined)[] | 'all' | 'none'): Engine & { turns: Turn[] } => {
  const turns: Turn[] = []
  const ok = fakeEngine(id, { delayMs: 1 })
  return {
    id,
    turns,
    run: (t) => {
      turns.push(t)
      if (out === 'none' || (out !== 'all' && !out.includes(t.account))) return ok.run(t)
      return (async function* (): AsyncIterable<EngineEvent> {
        yield OUT
      })()
    }
  }
}

let db: Db
let data: string
let settings: Settings
const personal: Account = { id: 'p1', engine: 'claude', name: 'Pessoal', loggedIn: true }
const CHAIN: Partial<Agent> = { fallbackModelId: 'sonnet', fallbackAccountId: 'p1', moreReserves: [{ modelId: 'antigravity:gemini-3-pro' }, { modelId: 'opencode:visant/miguel' }] }

function runner(e: Partial<Record<EngineId, Engine>>): Runner {
  const engines = { claude: fakeEngine('claude'), codex: fakeEngine('codex'), opencode: fakeEngine('opencode'), pi: fakeEngine('pi'), antigravity: fakeEngine('antigravity'), cursor: fakeEngine('cursor'), grok: fakeEngine('grok'), cline: fakeEngine('cline'), ...e } as Record<EngineId, Engine>
  return new Runner({ db, engines, settings: async () => settings, emit: () => {}, workDir: mkdtempSync(join(tmpdir(), 'rc-work-')), dataDir: data })
}
const reply = (): Message => db.messages().filter((m) => m.author.kind === 'agent').at(-1)!
const moves = (m: Message): string[] => (m.run?.steps ?? []).filter((s) => s.label === 'Foi pro modelo reserva').map((s) => s.detail ?? '')

beforeEach(() => {
  data = mkdtempSync(join(tmpdir(), 'rc-data-'))
  db = new Db(join(data, 'test.db'))
  settings = { workspaceName: 'Visant', context: '', engines: { claude: ready, codex: ready, opencode: ready, pi: ready, antigravity: ready, cursor: ready, grok: ready, cline: ready, hermes: ready }, routerModel: 'haiku', memoryModel: 'haiku', memoryLearning: 'approve', defaultLimit: 1000, approvalTtlHours: 24, theme: 'system', language: 'pt', accounts: [personal] }
  db.saveAgent(agent(CHAIN))
  db.createConversation({ id: 'd1', kind: 'dm', name: 'a1', members: ['a1'] })
})

describe('a chain of reserves', () => {
  it('is kept with the agent, in order, capped, and dropped without a first reserve', () => {
    expect(db.agent('a1')!.moreReserves).toEqual(CHAIN.moreReserves)
    expect(reserveChain(db.agent('a1')!).map((r) => r.modelId)).toEqual(['sonnet', 'antigravity:gemini-3-pro', 'opencode:visant/miguel'])
    db.saveAgent(agent({ ...CHAIN, moreReserves: [{ modelId: 'a:1' }, { modelId: 'a:2' }, { modelId: 'a:3' }, { modelId: 'a:4' }] }))
    expect(db.agent('a1')!.moreReserves).toHaveLength(3)
    db.saveAgent(agent({ moreReserves: CHAIN.moreReserves }))
    expect(db.agent('a1')!.moreReserves).toBeUndefined()
    expect(reservesFrom('not json')).toEqual([])
    expect(reservesFrom([{ modelId: '' }, { nope: 1 }, { modelId: 'x', accountId: 7 }])).toEqual([{ modelId: 'x' }])
  })

  it('walks Claude (usual) → Claude (other account) → Antigravity → OpenCode, each once, and answers on the first that works', async () => {
    const claude = engine('claude', 'all')
    const agy = engine('antigravity', 'all')
    const oc = engine('opencode', 'none')
    const r = runner({ claude, antigravity: agy, opencode: oc })
    await r.send('d1', 'oi')
    await r.idle()
    const m = reply()
    expect(m.run?.status).toBe('done')
    expect(claude.turns.map((t) => t.account)).toEqual([undefined, accountDir(data, 'p1')])
    expect(agy.turns).toHaveLength(1)
    expect(oc.turns).toHaveLength(1)
    expect(oc.turns[0]!.model).toBe('visant/miguel')
    expect(moves(m)).toHaveLength(3)
    expect(moves(m).at(-1)).toContain('está sem limite agora; segue no OpenCode')
  })

  it('stops at the first one that works: the rest is never called', async () => {
    const claude = engine('claude', [undefined])
    const agy = engine('antigravity', 'none')
    const oc = engine('opencode', 'none')
    const r = runner({ claude, antigravity: agy, opencode: oc })
    await r.send('d1', 'oi')
    await r.idle()
    expect(reply().run?.status).toBe('done')
    expect(claude.turns.map((t) => t.account)).toEqual([undefined, accountDir(data, 'p1')])
    expect(agy.turns).toHaveLength(0)
    expect(oc.turns).toHaveLength(0)
  })

  it('skips a reserve whose harness isn’t signed in', async () => {
    settings = { ...settings, engines: { ...settings.engines, antigravity: { installed: true, loggedIn: false } } }
    const claude = engine('claude', 'all')
    const agy = engine('antigravity', 'none')
    const oc = engine('opencode', 'none')
    const r = runner({ claude, antigravity: agy, opencode: oc })
    await r.send('d1', 'oi')
    await r.idle()
    expect(reply().run?.status).toBe('done')
    expect(agy.turns).toHaveLength(0)
    expect(oc.turns).toHaveLength(1)
  })

  it('fails when every one is out, having tried each once', async () => {
    const claude = engine('claude', 'all')
    const agy = engine('antigravity', 'all')
    const oc = engine('opencode', 'all')
    const r = runner({ claude, antigravity: agy, opencode: oc })
    await r.send('d1', 'oi')
    await r.idle()
    expect(reply().run?.status).toBe('failed')
    expect(claude.turns).toHaveLength(2)
    expect(agy.turns).toHaveLength(1)
    expect(oc.turns).toHaveLength(1)
  })

  it('never tries the same model on the same login twice in a reply', async () => {
    db.saveAgent(agent({ fallbackModelId: 'sonnet', moreReserves: [{ modelId: 'sonnet', accountId: 'p1' }, { modelId: 'sonnet' }] }))
    const claude = engine('claude', 'all')
    const r = runner({ claude })
    await r.send('d1', 'oi')
    await r.idle()
    expect(reply().run?.status).toBe('failed')
    // usual login (main), then p1; the first reserve and the last are the usual login again: skipped
    expect(claude.turns.map((t) => t.account)).toEqual([undefined, accountDir(data, 'p1')])
  })

  it('starts on the main model again on the next reply', async () => {
    const claude = engine('claude', 'all')
    const agy = engine('antigravity', 'none')
    const r = runner({ claude, antigravity: agy })
    await r.send('d1', 'oi')
    await r.idle()
    await r.send('d1', 'e agora?')
    await r.idle()
    expect(claude.turns.map((t) => t.account)).toEqual([undefined, accountDir(data, 'p1'), undefined, accountDir(data, 'p1')])
    expect(agy.turns).toHaveLength(2)
  })

  it('treats a model typed by name as the model it is: claude:sonnet on the usual login is sonnet there', async () => {
    db.saveAgent(agent({ fallbackModelId: 'claude:sonnet', moreReserves: [{ modelId: 'sonnet', accountId: 'p1' }] }))
    const claude = engine('claude', 'all')
    const r = runner({ claude })
    await r.send('d1', 'oi')
    await r.idle()
    expect(claude.turns.map((t) => t.account)).toEqual([undefined, accountDir(data, 'p1')])
  })

  it('ends the main model’s session once, after moving twice', async () => {
    const released: string[] = []
    const ok = fakeEngine('claude', { delayMs: 1, sessions: true, released })
    const turns: Turn[] = []
    const claude: Engine = { ...ok, run: (t) => (turns.push(t), (async function* (): AsyncIterable<EngineEvent> { yield OUT })()) }
    const agy = engine('antigravity', 'all')
    const oc = engine('opencode', 'none')
    const r = runner({ claude, antigravity: agy, opencode: oc })
    await r.send('d1', 'oi')
    await r.idle()
    expect(reply().run?.status).toBe('done')
    const main = turns[0]!.session?.id
    expect(main).toBeDefined()
    expect(released.filter((id) => id === main)).toHaveLength(1)
  })
})
