// The Figma connector: Figma's remote server through Claude Code, by the bridge that ships with Tucano.
// Claude Code itself isn't run here: these check the bridge's own parts (the argument check, the built-in
// command, the store entry) and that what a server says while a call runs reaches whoever called.
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { builtinCommand, ConnectorManager } from '../src/core/connectors'
import { Db } from '../src/core/db'
import { canonical, whereItDiffers } from '../src/core/figma-bridge'
import { FIGMA_TOOLS } from '../src/core/figma-tools'
import { plainCipher, Secrets } from '../src/core/secrets'
import { CATALOG, catalogInput, entryOf } from '../src/shared/connector-catalog'

describe('the argument check', () => {
  it('takes the same JSON in any key order, and points at the first difference', () => {
    expect(canonical({ b: [1, { y: 2, x: 1 }], a: 'é' })).toBe(canonical({ a: 'é', b: [1, { x: 1, y: 2 }] }))
    expect(whereItDiffers({ code: 'abc;\nreturn 1' }, { code: 'abc;\nreturn 1;' })).toContain('at character 13 (of 13; yours has 14)')
    expect(whereItDiffers({ a: 1 }, { a: 1, extra: true })).toBe('Keys not asked for: extra.')
    expect(whereItDiffers({ a: 1, b: 2 }, { a: 1 })).toBe('Missing keys: b.')
  })
})

describe('the Figma connector in the store', () => {
  const figma = CATALOG.find((e) => e.id === 'figma')!

  it('adds the bridge that ships with Tucano, which runs on its own executable', () => {
    expect(figma).toMatchObject({ category: 'design', auth: 'none' })
    expect(figma.warning?.()).toBeTruthy()
    const input = catalogInput(figma)
    expect(input).toMatchObject({ kind: 'stdio', command: 'tucano', args: ['figma-bridge'] })
    expect(entryOf({ kind: 'stdio', command: 'tucano', args: ['figma-bridge'] })?.id).toBe('figma')
    const run = builtinCommand('tucano', ['figma-bridge'], '/app/out/main')!
    expect(run.command).toBe(process.execPath)
    expect(run.args).toEqual([join('/app/out/main', 'figma-bridge.js')])
    expect(run.env['ELECTRON_RUN_AS_NODE']).toBe('1')
    expect(builtinCommand('npx', ['figma-bridge'])).toBeUndefined()
    expect(builtinCommand('tucano', ['other'])).toBeUndefined()
  })

  it('has a schema for each tool, and says which only read', () => {
    const names = FIGMA_TOOLS.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toEqual(expect.arrayContaining(['use_figma', 'get_design_context', 'get_screenshot', 'create_new_file']))
    expect(FIGMA_TOOLS.find((t) => t.name === 'use_figma')?.annotations?.readOnlyHint).toBe(false)
    expect(FIGMA_TOOLS.find((t) => t.name === 'get_design_context')?.annotations?.readOnlyHint).toBe(true)
    for (const t of FIGMA_TOOLS) expect(t.inputSchema.type).toBe('object')
  })
})

const sdk = pathToFileURL(resolve('node_modules/@modelcontextprotocol/sdk/dist/esm')).href
// A slow tool that says what it's doing, the way the bridge does.
const SLOW = `const { Server } = await import('${sdk}/server/index.js')
const { StdioServerTransport } = await import('${sdk}/server/stdio.js')
const { ListToolsRequestSchema, CallToolRequestSchema } = await import('${sdk}/types.js')
const s = new Server({ name: 'slow', version: '1' }, { capabilities: { tools: {} } })
s.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [{ name: 'render', inputSchema: { type: 'object' }, annotations: { readOnlyHint: true } }] }))
s.setRequestHandler(CallToolRequestSchema, async (r, extra) => {
  const token = r.params._meta?.progressToken
  for (const [i, message] of ['Abrindo o Claude Code', 'Rodando render no Figma'].entries()) {
    if (token !== undefined) await extra.sendNotification({ method: 'notifications/progress', params: { progressToken: token, progress: i + 1, message } })
    await new Promise((r) => setTimeout(r, 30)) // work between messages, as the bridge has (one sent with the answer would come after it)
  }
  return { content: [{ type: 'text', text: 'pronto' }] }
})
await s.connect(new StdioServerTransport())`

describe('a call that says what it is doing', () => {
  it('passes each progress message on, in order, and still returns the result', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tucano-progress-'))
    const script = join(dir, 'slow.mjs')
    writeFileSync(script, SLOW)
    const db = new Db(join(dir, 'test.db'))
    const connectors = new ConnectorManager({ db, secrets: new Secrets(db, plainCipher), emit: () => {}, openUrl: () => {}, oauthCallbackUrl: () => 'http://127.0.0.1:1/cb' })
    const id = await connectors.add({ kind: 'stdio', name: 'Slow', command: process.execPath, args: [script], env: {} })
    await connectors.connect(id)
    const said: string[] = []
    const r = await connectors.call(id, 'render', {}, (m) => said.push(m))
    expect(said).toEqual(['Abrindo o Claude Code', 'Rodando render no Figma'])
    expect(r.content).toEqual([{ type: 'text', text: 'pronto' }])
    await connectors.closeAll()
    db.close()
  })
})

describe('a server that answers outside MCP', () => {
  it('says so in words, with the validation issues kept as the detail', async () => {
    const { connectProblem } = await import('../src/core/connectors')
    const raw = JSON.stringify([{ expected: 'array', code: 'invalid_type', path: ['tools'], message: 'Invalid input: expected array, received undefined' }], null, 2)
    const p = connectProblem(new Error(raw), 'http://127.0.0.1:3845/mcp')
    expect(p.text).not.toMatch(/invalid_type/)
    expect(p.text).toMatch(/127\.0\.0\.1:3845/)
    expect(p.detail).toContain('invalid_type')
  })
})
