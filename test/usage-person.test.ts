// How much each person's requests used: the receipts carry whose request the reply worked on.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { Db } from '../src/core/db'

it('adds up the replies and tokens per person, biggest first, leaving out turns no one asked for', () => {
  const db = new Db(join(mkdtempSync(join(tmpdir(), 'tucano-usage-')), 'test.db'))
  const r = (messageId: string, agentId: string, person: string | undefined, inputTokens: number): void =>
    db.addReceipt({ model: 'sonnet', inputTokens, cacheReadTokens: 0, outputTokens: 0, ms: 1, messageId, agentId, engine: 'claude', at: 1000, ...(person ? { person } : {}) })
  r('m1', 'lia', 'ana', 100)
  r('m2', 'theo', 'ana', 50)
  r('m3', 'lia', 'bia', 400)
  r('m4', 'router', undefined, 999) // the router's turn: no one's request
  const by = db.costByPerson(0)
  expect(by.map((p) => [p.person, p.tokens, p.replies])).toEqual([
    ['bia', 400, 1],
    ['ana', 150, 2]
  ])
  expect(by[1]!.agents.sort()).toEqual(['lia', 'theo'])
  db.close()
})
