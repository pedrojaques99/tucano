// Figma's remote MCP server (mcp.figma.com) through Claude Code, as a local stdio MCP server: the
// Figma connector of the catalog runs this (Tucano's own executable as Node, see BUILTIN in
// connectors.ts), so it needs nothing installed besides Claude Code.
//
// Figma signs in only the MCP clients on its list; Tucano isn't on it yet, Claude Code is. Each call
// runs `claude -p` once: the model calls the one Figma tool with the arguments it was given, and the
// tool's raw result is read from the stream (not the model's words) and returned as is. A PreToolUse
// hook turns the call away if the model changed the arguments, so a write never goes out altered.
// Claude Code does the Figma sign-in (the claude.ai connector or the figma plugin); this signs in nothing.
// While a call runs, progress notifications say what it's doing, for the step in the conversation.
//
//   CLAUDE_BRIDGE_MODEL=haiku         the model that relays short inputs (cheapest)
//   CLAUDE_BRIDGE_LONG_MODEL=sonnet   long inputs (use_figma code), and when the short one slips
//   CLAUDE_BIN=/path/to/claude        when claude isn't on PATH
//   TUCANO_LANG=en                    the language of what it says (pt by default)
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { FIGMA_TOOLS } from './figma-tools'

const SELF = fileURLToPath(import.meta.url)
const CLAUDE = process.env['CLAUDE_BIN'] ?? 'claude'
const MODEL = process.env['CLAUDE_BRIDGE_MODEL'] ?? 'haiku'
const LONG_MODEL = process.env['CLAUDE_BRIDGE_LONG_MODEL'] ?? 'sonnet'
const LONG_INPUT = 2000 // characters of JSON input
const TIMEOUT_MS = Number(process.env['CLAUDE_BRIDGE_TIMEOUT_MS'] ?? 300_000)
const pt = process.env['TUCANO_LANG'] !== 'en'
const L = (p: string, e: string): string => (pt ? p : e)

type Json = Record<string, unknown>
type Progress = (message: string) => void

// Same JSON whatever the key order.
export const canonical = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(canonical).join(',')}]`
    : v && typeof v === 'object'
      ? `{${Object.keys(v)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canonical((v as Json)[k])}`)
          .join(',')}}`
      : JSON.stringify(v)

// The first place the model's input strays from the one asked for, so the next try can fix just that.
export function whereItDiffers(want: Json, got: Json): string {
  const missing = Object.keys(want).filter((k) => !(k in got))
  const extra = Object.keys(got).filter((k) => !(k in want))
  if (missing.length || extra.length) return [missing.length && `Missing keys: ${missing.join(', ')}.`, extra.length && `Keys not asked for: ${extra.join(', ')}.`].filter(Boolean).join(' ')
  const key = Object.keys(want).find((k) => canonical(want[k]) !== canonical(got[k]))
  if (!key) return ''
  const a = typeof want[key] === 'string' ? (want[key] as string) : canonical(want[key])
  const b = typeof got[key] === 'string' ? (got[key] as string) : canonical(got[key])
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  const around = (s: string): string => JSON.stringify(s.slice(Math.max(0, i - 30), i + 30))
  return `In "${key}", at character ${i} (of ${a.length}; yours has ${b.length}): expected ${around(a)}, you sent ${around(b)}.`
}

const BLOCKED = 'input differs from the one requested'

interface StreamEvent {
  type?: string
  subtype?: string
  result?: string
  tools?: string[]
  mcp_servers?: { name: string; status: string }[]
  message?: { content?: { type: string; id?: string; name?: string; tool_use_id?: string; is_error?: boolean; content?: unknown }[] }
}

// One `claude -p` run: the prompt goes in on stdin (long code doesn't fit a command line), and each
// stream event goes to onEvent until it returns a value, which ends the run there.
function claude<T>(prompt: string, extraArgs: string[], onEvent: (e: StreamEvent) => T | undefined, model = MODEL): Promise<T> {
  return new Promise((resolve, reject) => {
    const work = mkdtempSync(join(tmpdir(), 'claude-bridge-')) // no project CLAUDE.md, no project MCP servers
    const child = spawn(CLAUDE, ['-p', '--model', model, '--output-format', 'stream-json', '--verbose', '--no-session-persistence', ...extraArgs], {
      cwd: work,
      env: { ...process.env, MAX_MCP_OUTPUT_TOKENS: process.env['MAX_MCP_OUTPUT_TOKENS'] ?? '200000' },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })
    let done = false
    let buffer = ''
    let stderr = ''
    let last: StreamEvent | undefined
    const finish = (fn: () => void): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      child.kill()
      setTimeout(() => rmSync(work, { recursive: true, force: true }), 1000).unref()
      fn()
    }
    const timer = setTimeout(() => finish(() => reject(new Error(L(`O Claude Code não terminou em ${TIMEOUT_MS / 1000} s.`, `Claude Code didn't finish in ${TIMEOUT_MS / 1000} s.`)))), TIMEOUT_MS)
    child.on('error', () =>
      finish(() => reject(new Error(L('Não achei o Claude Code neste computador. Instale em claude.com/claude-code e entre na sua conta.', "Claude Code isn't on this computer. Install it from claude.com/claude-code and sign in."))))
    )
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()))
    child.stdout.on('data', (d: Buffer) => {
      buffer += d.toString()
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (!line || done) continue
        let event: StreamEvent
        try {
          event = JSON.parse(line) as StreamEvent
        } catch {
          continue
        }
        if (event.type === 'result') last = event
        const out = onEvent(event)
        if (out !== undefined) finish(() => resolve(out))
      }
    })
    child.on('close', () => {
      const why = last?.result || last?.subtype || stderr.trim().split('\n').pop() || L('terminou sem resposta', 'it ended without an answer')
      finish(() => reject(new Error(L(`O Claude Code parou antes da resposta do Figma: ${why}`, `Claude Code stopped before Figma answered: ${why}`))))
    })
    child.stdin.end(prompt)
  })
}

// The Figma server as Claude Code has it: the tool prefix and the live tool names, read from the
// run's first event (before any model call).
interface Found {
  prefix?: string
  live?: Set<string>
  pending?: boolean
  error?: string
}
let figma: Promise<Found> | undefined
async function discover(): Promise<Found> {
  figma ??= claude<Found>('.', ['--max-turns', '1'], (e) => {
    if (e.type !== 'system' || e.subtype !== 'init') return undefined
    const tools = e.tools ?? []
    const names = tools.filter((t) => /^mcp__.*figma.*__whoami$/i.test(t) && !/desktop/i.test(t))
    const whoami = names.find((t) => t.startsWith('mcp__plugin_figma_figma__')) ?? names[0]
    if (!whoami) {
      const server = (e.mcp_servers ?? []).find((s) => /figma/i.test(s.name) && !/desktop/i.test(s.name))
      if (!server)
        return {
          error: L(
            'O Claude Code não está conectado ao Figma. Conecte em claude.ai › Configurações › Conectores (Figma), ou no Claude Code com /mcp.',
            "Claude Code isn't connected to Figma. Connect it at claude.ai › Settings › Connectors (Figma), or in Claude Code with /mcp."
          )
        }
      // Still connecting when the run started: its tools aren't listed yet, but the name says the prefix, and
      // in a call ToolSearch waits for it. Not cached, so the next look lists the live tools.
      if (server.status === 'pending') return { prefix: `mcp__${server.name.replace(/[^a-zA-Z0-9_-]/g, '_')}__`, pending: true }
      return {
        error: L(
          `O Figma no Claude Code está "${server.status}": entre de novo em claude.ai › Configurações › Conectores, ou no Claude Code com /mcp.`,
          `Figma in Claude Code is "${server.status}": sign in again at claude.ai › Settings › Connectors, or in Claude Code with /mcp.`
        )
      }
    }
    const prefix = whoami.slice(0, -'whoami'.length)
    return { prefix, live: new Set(tools.filter((t) => t.startsWith(prefix)).map((t) => t.slice(prefix.length))) }
  }).catch((err: Error) => ({ error: err.message }))
  const found = await figma
  if (found.error || found.pending) figma = undefined // look again on the next call
  return found
}

// A Claude tool_result block as MCP content.
const content = (c: unknown): CallToolResult['content'] => {
  if (typeof c === 'string') return [{ type: 'text', text: c }]
  return ((c as Json[] | undefined) ?? []).map((b) => {
    const source = b['source'] as Json | undefined
    if (b['type'] === 'image' && source?.['type'] === 'base64') return { type: 'image' as const, data: String(source['data']), mimeType: String(source['media_type']) }
    return { type: 'text' as const, text: b['type'] === 'text' ? String(b['text']) : JSON.stringify(b) }
  })
}

const failure = (text: string): CallToolResult => ({ content: [{ type: 'text', text }], isError: true })

async function call(tool: string, args: Json, progress: Progress): Promise<CallToolResult> {
  progress(L('Abrindo o Claude Code', 'Opening Claude Code'))
  const found = await discover()
  if (found.error) return failure(found.error)
  if (found.live && !found.live.has(tool)) return failure(L(`O Figma não tem a ferramenta "${tool}". Tem: ${[...found.live].join(', ')}.`, `Figma has no tool "${tool}". It has: ${[...found.live].join(', ')}.`))
  const full = found.prefix + tool
  const check = mkdtempSync(join(tmpdir(), 'claude-bridge-check-'))
  const expected = join(check, 'input.json')
  writeFileSync(expected, JSON.stringify(args))
  const q = (s: string): string => `"${s.replace(/\\/g, '/')}"`
  const settings = { hooks: { PreToolUse: [{ matcher: full, hooks: [{ type: 'command', command: `${q(process.execPath)} ${q(SELF)} --check ${q(expected)}` }] }] } }
  const prompt = [
    'You are a relay. Do exactly this and nothing else:',
    `1. Call ToolSearch with query "select:${full}". If it says the server is still connecting, call it again.`,
    Object.keys(args).length
      ? `2. Call ${full} once, with exactly this JSON as its input: the same keys and values, nothing added, removed or changed.`
      : `2. Call ${full} once, with no arguments at all: its input is exactly {}.`,
    '<input>',
    JSON.stringify(args),
    '</input>',
    'Then stop.'
  ].join('\n')
  const relay = (model: string): Promise<CallToolResult | { blocked: true }> => {
    let useId: string | undefined
    let blocked = 0
    return claude<CallToolResult | { blocked: true }>(
      prompt,
      ['--max-turns', '8', '--tools', 'ToolSearch', '--allowedTools', `ToolSearch,${full}`, '--settings', JSON.stringify(settings)],
      (e) => {
        for (const b of e.message?.content ?? []) {
          if (e.type === 'assistant' && b.type === 'tool_use' && b.name === 'ToolSearch') progress(L('Carregando a ferramenta do Figma', 'Loading the Figma tool'))
          if (e.type === 'assistant' && b.type === 'tool_use' && b.name === full) {
            useId = b.id
            progress(L(`Rodando ${tool} no Figma`, `Running ${tool} in Figma`))
          }
          if (e.type === 'user' && b.type === 'tool_result' && useId && b.tool_use_id === useId) {
            const text = typeof b.content === 'string' ? b.content : JSON.stringify(b.content)
            if (b.is_error && text.includes(BLOCKED)) {
              // Blocked by the hook, so nothing reached Figma. The model gets one more try, then a stronger one takes over.
              progress(L('Conferindo os argumentos de novo', 'Checking the arguments again'))
              if (++blocked >= 2) return { blocked: true as const }
              continue
            }
            return { content: content(b.content), ...(b.is_error ? { isError: true } : {}) }
          }
        }
        return undefined
      },
      model
    )
  }
  try {
    // A long input (use_figma code) goes straight to the stronger model: the small one tends to slip on it.
    const first = JSON.stringify(args).length > LONG_INPUT ? LONG_MODEL : MODEL
    let out = await relay(first)
    if ('blocked' in out && first !== LONG_MODEL) {
      progress(L('Repassando com um modelo mais preciso', 'Relaying it with a more precise model'))
      out = await relay(LONG_MODEL)
    }
    if ('blocked' in out) return failure(L(`Não consegui repassar os argumentos de ${tool} sem mudança, então nada foi enviado ao Figma. Tente de novo, ou em partes menores.`, `I couldn't relay the ${tool} arguments unchanged, so nothing was sent to Figma. Try again, or in smaller parts.`))
    return out
  } catch (err) {
    return failure((err as Error).message)
  } finally {
    rmSync(check, { recursive: true, force: true })
  }
}

async function serve(): Promise<void> {
  const server = new Server({ name: 'figma-via-claude-code', version: '1.0.0' }, { capabilities: { tools: {} } })
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const found = await discover()
    const tools = found.live ? FIGMA_TOOLS.filter((t) => found.live!.has(t.name)) : FIGMA_TOOLS
    return {
      tools: [
        ...tools,
        {
          name: 'figma_call',
          description: "Call any tool of Figma's remote MCP server by name, including ones without a schema here (e.g. get_figma_skill). Use the named tools when they exist.",
          inputSchema: { type: 'object' as const, properties: { tool: { type: 'string', description: 'The Figma tool name, e.g. get_figma_skill.' }, arguments: { type: 'object', description: "The tool's input." } }, required: ['tool'] },
          annotations: { readOnlyHint: false }
        }
      ]
    }
  })
  server.setRequestHandler(CallToolRequestSchema, async (r, extra) => {
    const { name, arguments: args = {} } = r.params
    const token = r.params._meta?.progressToken
    let n = 0
    const progress: Progress = (message) => {
      if (token === undefined) return
      void extra.sendNotification({ method: 'notifications/progress', params: { progressToken: token, progress: ++n, message } }).catch(() => {})
    }
    return name === 'figma_call' ? call(String(args['tool'] ?? ''), (args['arguments'] as Json | undefined) ?? {}, progress) : call(name, args, progress)
  })
  await server.connect(new StdioServerTransport())
}

// --check <file>: the PreToolUse hook. Lets the call through only with the arguments that were asked for.
function check(file: string): void {
  const want = JSON.parse(readFileSync(file, 'utf8')) as Json
  let input = ''
  process.stdin.on('data', (d: Buffer) => (input += d.toString()))
  process.stdin.on('end', () => {
    const got = ((JSON.parse(input) as Json)['tool_input'] as Json | undefined) ?? {}
    if (canonical(got) === canonical(want)) process.exit(0)
    process.stderr.write(`Blocked: the ${BLOCKED}. ${whereItDiffers(want, got)} Call the tool again with exactly the JSON given, unchanged.`)
    process.exit(2)
  })
}

// Run as a program (the built figma-bridge.js), never on import (tests import the helpers).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv[2] === '--check') check(process.argv[3]!)
  else void serve()
}
