// The autonomy brake for alerts: a routine that keeps saying the same thing folds the repeats and, at the
// third in a day, pauses itself and says so, instead of filling the channel. Numbers don't make it new.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Agent, EngineId, Routine, Settings } from '../src/shared/types'
import { Db } from '../src/core/db'
import { fakeEngine } from '../src/core/engines/fake'
import type { Engine } from '../src/core/engines/types'
import { alertSig, Runner } from '../src/core/runs'

const ready = { installed: true, loggedIn: true }
let db: Db
let settings: Settings
let held: string[]

const agent: Agent = { id: 'a1', name: 'Lia', handle: 'lia', role: '', color: 'sky', instructions: '', modelId: 'sonnet', effort: 'low', limit: 1_000_000, used: 0, grants: {}, memory: 'auto', computer: false, archived: false }
const routine = { id: 'r1', name: 'Checa o deploy', agentId: 'a1', conversationId: 'd1', prompt: 'Checa o deploy', schedule: { days: [1, 2, 3, 4, 5], time: '09:00' }, enabled: true } as Routine

beforeEach(() => {
  db = new Db(join(mkdtempSync(join(tmpdir(), 'tucano-brakes-')), 'test.db'))
  settings = { workspaceName: 'Edu', context: '', engines: { claude: ready, codex: ready, opencode: ready, pi: ready, antigravity: ready, cursor: ready, grok: ready, cline: ready }, routerModel: 'haiku', memoryModel: 'haiku', memoryLearning: 'approve', defaultLimit: 1000, approvalTtlHours: 24, theme: 'system', language: 'pt' }
  held = []
  db.saveAgent(agent)
  db.createConversation({ id: 'd1', kind: 'dm', name: 'a1', members: ['a1'] })
})

const runner = (reply: () => string): Runner => {
  const claude = fakeEngine('claude', { delayMs: 1, reply })
  const engines = { claude, codex: claude, opencode: claude, pi: claude, antigravity: claude, cursor: claude, grok: claude, cline: claude } as Record<EngineId, Engine>
  return new Runner({
    db,
    engines,
    settings: async () => settings,
    emit: () => {},
    workDir: mkdtempSync(join(tmpdir(), 'tucano-brakes-work-')),
    routines: { schedule: () => ({ result: { content: [] } }) as never, cancel: () => ({ result: { content: [] } }) as never, forAgent: () => [], hold: (id) => (held.push(id), true) }
  })
}

describe('the brake on repeated alerts', () => {
  it('an alert is the same alert whatever its numbers and times say', () => {
    expect(alertSig('O deploy 1234 falhou às 09:12')).toBe(alertSig('O deploy 1240 falhou às 10:47'))
    expect(alertSig('O deploy falhou')).not.toBe(alertSig('O deploy passou'))
  })

  it('folds the second, and at the third in a day pauses the routine and says so', async () => {
    let n = 0
    const r = runner(() => `O deploy ${++n * 101} falhou no passo de build.`)
    const first = await r.runRoutine(routine, { scheduledAt: Date.now(), late: false })
    const second = await r.runRoutine(routine, { scheduledAt: Date.now(), late: false })
    expect(db.message(first!.id)?.run?.repeated).toBeUndefined()
    expect(db.message(second!.id)?.run?.repeated).toBe(2)
    expect(held).toEqual([])
    const third = await r.runRoutine(routine, { scheduledAt: Date.now(), late: false })
    await r.idle()
    expect(db.message(third!.id)?.run?.repeated).toBe(3)
    expect(held).toEqual(['r1'])
    expect(db.messages().some((m) => m.author.kind === 'system' && m.text.includes('Pausei a rotina **Checa o deploy**'))).toBe(true)
  })

  it('a different result starts over', async () => {
    const replies = ['O deploy falhou.', 'O deploy falhou.', 'O deploy passou.', 'O deploy passou.']
    const r = runner(() => replies.shift()!)
    const msgs = []
    for (let i = 0; i < 4; i++) msgs.push(await r.runRoutine(routine, { scheduledAt: Date.now(), late: false }))
    expect(msgs.map((m) => db.message(m!.id)?.run?.repeated ?? 1)).toEqual([1, 2, 1, 2])
    expect(held).toEqual([])
  })
})

describe('catching up after the plan ran out', () => {
  it('a reply that failed for the plan waits for it, then looks at what happened and may pass', async () => {
    const base = fakeEngine('claude', { delayMs: 1, reply: (t) => (t.prompt.includes('Você voltou depois do limite do plano') ? '[passo]' : 'feito') })
    let out = true
    const claude: Engine = {
      id: 'claude',
      async *run(t) {
        if (out) {
          out = false
          yield { type: 'error', message: "You've hit your limit · resets 5pm" }
          return
        }
        yield* base.run(t)
      }
    }
    const engines = { claude, codex: claude, opencode: claude, pi: claude, antigravity: claude, cursor: claude, grok: claude, cline: claude } as Record<EngineId, Engine>
    const r = new Runner({ db, engines, settings: async () => settings, emit: () => {}, workDir: mkdtempSync(join(tmpdir(), 'tucano-catchup-')) })
    await r.send('d1', 'revisa o PR #12')
    await r.idle()
    const failed = db.messages().find((m) => m.author.kind === 'agent')!
    expect(failed.run?.status).toBe('failed')
    expect(failed.run?.waitsQuota).toBe(true)
    expect(failed.run?.error).toContain('Tento de novo sozinho')

    // The plan is back: the same reply tries again, reads what happened, and someone had done it.
    ;(r as unknown as { catchUp(id: string): void }).catchUp(failed.id)
    await r.idle()
    const back = db.message(failed.id)!
    expect(back.run?.status).toBe('done')
    expect(back.run?.passed).toBe(true)
  })
})

