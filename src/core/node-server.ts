// This computer as a "node" of a Tucano on a server (docs/plan-local-node.md): the server's agents
// reach this machine's terminal and files the way they reach any connector, so a Tucano on a VPS
// keeps every agent synced and still works on the computers where the person's apps and files are.
//
// It's an MCP server over HTTP, on a port of this computer, that answers only a bearer key the
// person copies into the server's connector (Settings › Servers › This computer as a node). It
// listens on 127.0.0.1 by default: the way in from the server is a private network in front of it
// (`tailscale serve`), never the open internet. The tools run as the person, with what's installed
// here, through the same MacComputer an agent "on your computer" uses; on the server, a command is
// judged like one on this computer (shellActions), so the autonomy and approvals are the same.
import { timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult, type Tool } from '@modelcontextprotocol/sdk/types.js'
import { L } from '../shared/lang'
import type { Agent } from '../shared/types'
import { textResult } from './gateway'
import { macPath, type MacComputer } from './mac'
import { systemName } from './platform'

// The node's tools, by name. `node_bash` is how the server recognizes a command on a node
// (runs.ts judges it with shellActions, like a command on this computer).
export const NODE_BASH = 'node_bash'
export const NODE_TOOLS = new Set([NODE_BASH, 'node_read_file', 'node_write_file', 'node_edit_file', 'node_list'])

const MAX_LIST = 500

export function nodeTools(machine = systemName()): Tool[] {
  const path = { type: 'string', description: L('Caminho absoluto, com ~, ou relativo à pasta de trabalho do nó.', "Absolute path, with ~, or relative to the node's working folder.") }
  return [
    {
      name: NODE_BASH,
      description: L(
        `Roda um comando no computador da pessoa (${machine}), como ela, com o que ela tem instalado. Por padrão na pasta de trabalho do nó; use cd ou caminhos absolutos pros repositórios dela.`,
        `Runs a command on the person's computer (${machine}), as them, with what they have installed. In the node's working folder by default; use cd or absolute paths for their repositories.`
      ),
      inputSchema: { type: 'object', properties: { command: { type: 'string' }, timeout_seconds: { type: 'number', description: L('Até 600; padrão 120.', 'Up to 600; 120 by default.') } }, required: ['command'] },
      annotations: { readOnlyHint: false }
    },
    { name: 'node_read_file', description: L('Lê um arquivo de texto deste computador.', 'Reads a text file from this computer.'), inputSchema: { type: 'object', properties: { path }, required: ['path'] }, annotations: { readOnlyHint: true } },
    { name: 'node_list', description: L('Lista uma pasta deste computador (nome, se é pasta, tamanho).', 'Lists a folder of this computer (name, whether it is a folder, size).'), inputSchema: { type: 'object', properties: { path }, required: ['path'] }, annotations: { readOnlyHint: true } },
    { name: 'node_write_file', description: L('Cria ou sobrescreve um arquivo neste computador, criando as pastas que faltarem.', 'Creates or overwrites a file on this computer, creating any missing folders.'), inputSchema: { type: 'object', properties: { path, content: { type: 'string' } }, required: ['path', 'content'] }, annotations: { readOnlyHint: false } },
    {
      name: 'node_edit_file',
      description: L('Troca um trecho exato de um arquivo deste computador por outro.', 'Replaces an exact stretch of a file on this computer with another.'),
      inputSchema: { type: 'object', properties: { path, old_text: { type: 'string' }, new_text: { type: 'string' }, replace_all: { type: 'boolean' } }, required: ['path', 'old_text', 'new_text'] },
      annotations: { readOnlyHint: false }
    }
  ]
}

// The agent the node's calls run as: one working folder of its own, this computer's own tools.
const NODE_AGENT = { id: 'node', computer: true, computerKind: 'mac' } as Agent

const sameKey = (a: string, b: string): boolean => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export interface NodeOptions {
  port: number // 0: any free port (tests)
  host?: string // 127.0.0.1 unless the person chose a private address
  key: string
}

export class NodeServer {
  private http: HttpServer | null = null
  private listening = 0

  constructor(private mac: Pick<MacComputer, 'call'>) {}

  get port(): number {
    return this.listening
  }

  get running(): boolean {
    return !!this.http
  }

  async start(opts: NodeOptions): Promise<number> {
    await this.stop()
    const http = createServer((req, res) => {
      void this.handle(req, res, opts.key).catch((e: unknown) => {
        console.error('[node]', e)
        if (!res.headersSent) res.writeHead(500).end()
      })
    })
    await new Promise<void>((resolve, reject) => {
      http.once('error', reject)
      http.listen(opts.port, opts.host ?? '127.0.0.1', () => resolve())
    })
    this.http = http
    this.listening = (http.address() as AddressInfo).port
    return this.listening
  }

  async stop(): Promise<void> {
    const http = this.http
    this.http = null
    this.listening = 0
    if (!http) return
    http.closeAllConnections()
    await new Promise<void>((resolve) => http.close(() => resolve()))
  }

  private async handle(req: IncomingMessage, res: ServerResponse, key: string): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://node')
    if (url.pathname !== '/mcp') return void res.writeHead(404).end()
    const given = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '')?.[1] ?? ''
    if (!key || !sameKey(given, key)) return void res.writeHead(401, { 'www-authenticate': 'Bearer' }).end()
    const server = new Server({ name: 'tucano-node', version: '1.0.0' }, { capabilities: { tools: {} } })
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: nodeTools() }))
    server.setRequestHandler(CallToolRequestSchema, async (r) => this.call(r.params.name, (r.params.arguments ?? {}) as Record<string, unknown>))
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    res.on('close', () => {
      void transport.close()
      void server.close()
    })
    await server.connect(transport)
    await transport.handleRequest(req, res)
  }

  async call(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    const ctx = { conversationId: 'node', messageId: 'node' }
    switch (name) {
      case NODE_BASH:
        return (await this.mac.call(NODE_AGENT, 'bash', args, ctx)).result
      case 'node_read_file':
        return (await this.mac.call(NODE_AGENT, 'read_file', args, ctx)).result
      case 'node_write_file':
        return (await this.mac.call(NODE_AGENT, 'write_file', args, ctx)).result
      case 'node_edit_file':
        return (await this.mac.call(NODE_AGENT, 'edit_file', args, ctx)).result
      case 'node_list':
        return list(macPath(String(args['path'] ?? '~'), homedir()))
      default:
        return textResult(L(`Ferramenta desconhecida: ${name}`, `Unknown tool: ${name}`), true)
    }
  }
}

function list(dir: string): CallToolResult {
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    const lines = entries.slice(0, MAX_LIST).map((e) => {
      if (e.isDirectory()) return `${e.name}/`
      try {
        return `${e.name}  ${statSync(join(dir, e.name)).size} B`
      } catch {
        return e.name
      }
    })
    const more = entries.length > MAX_LIST ? `\n${L(`… e mais ${entries.length - MAX_LIST}`, `… and ${entries.length - MAX_LIST} more`)}` : ''
    return textResult(`${dir}\n${lines.join('\n')}${more}`)
  } catch (e) {
    return textResult(L(`Não deu pra listar ${dir}: ${(e as Error).message}`, `Couldn't list ${dir}: ${(e as Error).message}`), true)
  }
}
