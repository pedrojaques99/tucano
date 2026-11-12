// Settings › Servers: Tucanos that run on a server (yours, or your company's), shown in this
// window over the app. Desktop only; the pairing link comes from the server (`server.js link`).
import { useEffect, useState, type ReactNode } from 'react'
import { L } from '../../../shared/lang'
import { pairProblem } from '../../../shared/servers'
import { confirmDialog } from './Dialogs'
import { Card } from './Pages'
import { Icon, Toggle } from './ui'
import { call } from '../rpc'
import type { NodeInfo } from '../../../shared/types'

type Server = { id: string; name: string; origin: string; open: boolean }

export const hasServers = (): boolean => !!window.tucano?.servers

export function ServersCard(): ReactNode {
  const api = window.tucano.servers!
  const [list, setList] = useState<Server[]>([])
  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let alive = true
    const load = (): void => void api.list().then((l) => alive && setList(l))
    load()
    const off = api.onChanged(load)
    return () => {
      alive = false
      off()
    }
  }, [api])

  const connect = async (): Promise<void> => {
    setError('')
    setBusy(true)
    const r = await api.pair(link).finally(() => setBusy(false))
    if (r === 'paired') return setLink('')
    if (r === 'invalid' || r === 'used' || r === 'unreachable') {
      const p = pairProblem(r)
      setError(`${p.title}. ${p.detail}`)
    }
  }
  const forget = async (s: Server): Promise<void> => {
    const ok = await confirmDialog({
      title: L(`Esquecer o Tucano em ${s.name}?`, `Forget the Tucano at ${s.name}?`),
      body: L('Só este computador esquece o acesso. O Tucano do servidor continua lá, com tudo.', 'Only this computer forgets the access. The Tucano on the server stays there, with everything.'),
      confirm: L('Esquecer', 'Forget'),
      danger: true
    })
    if (ok) await api.forget(s.id)
  }

  return (
    <>
      <Card
        title={L('Servidores', 'Servers')}
        lead={L(
          'Um Tucano num servidor, sempre ligado, aberto aqui pelo topo da barra lateral. Nada deste computador vai pra ele.',
          'A Tucano on a server, always on, opened here from the top of the sidebar. Nothing on this computer goes to it.'
        )}
      >
        <div className="key-row">
          <Icon name="laptop" />
          <div className="grow">
            <strong>{L('Este computador', 'This computer')}</strong>
            <p className="muted small">{L('O Tucano desta janela: os agentes, as rotinas e os apps deste computador.', 'The Tucano in this window: the agents, routines and apps of this computer.')}</p>
          </div>
        </div>
        {list.map((s) => (
          <div key={s.id} className="key-row">
            <Icon name="globe" />
            <div className="grow">
              <strong>{s.name}</strong>
              <p className="muted small">{s.open ? L('Aberto numa janela', 'Open in a window') : L('Pareado com este computador', 'Paired with this computer')}</p>
            </div>
            <div className="row">
              <button className="btn btn--sm btn--primary" onClick={() => api.open(s.id)}>
                {s.open ? L('Mostrar', 'Show') : L('Abrir', 'Open')}
              </button>
              <button className="btn btn--sm btn--ghost" onClick={() => void forget(s)}>
                {L('Esquecer', 'Forget')}
              </button>
            </div>
          </div>
        ))}
      </Card>
      <Card
        title={L('Conectar a um servidor', 'Connect to a server')}
        lead={L(
          'O link que o servidor deu (tucano://connect… ou com ?code=). Quem tem o link controla os agentes de lá: só links seus ou de quem você confia.',
          'The link the server gave you (tucano://connect… or with ?code=). Whoever has it controls the agents there: only your own links or from someone you trust.'
        )}
      >
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            if (link.trim() && !busy) void connect()
          }}
        >
          <input className="grow" type="password" autoComplete="off" spellCheck={false} placeholder="tucano://connect?url=…" value={link} onChange={(e) => (setLink(e.target.value), setError(''))} />
          <button className="btn btn--sm btn--primary" type="submit" disabled={!link.trim() || busy}>
            {L('Conectar', 'Connect')}
          </button>
        </form>
        {error && <p className="note note--error">{error}</p>}
      </Card>
    </>
  )
}

// The servers, live: the list and which one is on screen.
export function useServers(): Server[] {
  const api = window.tucano?.servers
  const [list, setList] = useState<Server[]>([])
  useEffect(() => {
    if (!api) return
    let alive = true
    const load = (): void => void api.list().then((l) => alive && setList(l))
    load()
    const off = api.onChanged(load)
    return () => {
      alive = false
      off()
    }
  }, [api])
  return list
}

// Over a server's page, which fills the rest of the window: which Tucano it is, the other
// servers, and the way back to this computer's (src/main/servers.ts keeps BAR px for it).
export function ServerBar(): ReactNode {
  const servers = useServers()
  const on = servers.find((s) => s.open)
  if (!on) return null
  const api = window.tucano.servers!
  return (
    <div className="server-bar">
      <Icon name="globe" size={14} />
      <span className="server-bar__name">
        {L('Tucano em', 'Tucano at')} <strong>{on.name}</strong>
      </span>
      <span className="grow" />
      {servers
        .filter((s) => !s.open)
        .map((s) => (
          <button key={s.id} className="btn btn--ghost btn--sm" onClick={() => api.open(s.id)}>
            {s.name}
          </button>
        ))}
      <button className="btn btn--sm" onClick={() => api.local()}>
        <Icon name="laptop" size={14} /> {L('Voltar pra este computador', 'Back to this computer')}
      </button>
    </div>
  )
}

// This computer as a node of a server's Tucano (docs/plan-local-node.md): the server's agents reach this
// machine's terminal and files like a connector, with the same autonomy and approvals as here. Off by
// default; the way in is a private network (Tailscale), with the key below.
export function NodeCard(): ReactNode {
  const [info, setInfo] = useState<NodeInfo | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    void call('nodeInfo').then(setInfo, () => {})
  }, [])
  if (!info) return null
  const run = (p: Promise<NodeInfo>): void => {
    setBusy(true)
    void p.then(setInfo, () => {}).finally(() => setBusy(false))
  }
  const copy = (text: string): void => void navigator.clipboard.writeText(text).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))
  return (
    <Card
      title={L('Este computador como nó', 'This computer as a node')}
      lead={L('Os agentes de um Tucano num servidor usam o terminal e os arquivos deste computador, com a mesma autonomia daqui.', "The agents of a Tucano on a server use this computer's terminal and files, with the same autonomy as here.")}
      action={<Toggle on={info.on} disabled={busy} label={L('Este computador como nó', 'This computer as a node')} onChange={(on) => run(call('setNode', { on }))} />}
    >
      {info.error && <p className="field__error">{info.error}</p>}
      {info.on && info.running && (
        <div className="node-card">
          <div className="node-card__row">
            <span className="muted small">{L('Escutando em', 'Listening on')}</span>
            <code>http://127.0.0.1:{info.port}/mcp</code>
          </div>
          {info.key && (
            <div className="node-card__row">
              <span className="muted small">{L('Chave', 'Key')}</span>
              <code className="node-card__key">{info.key.slice(0, 6)}…{info.key.slice(-4)}</code>
              <button className="btn btn--sm" onClick={() => copy(info.key!)}>
                {copied ? L('Copiada', 'Copied') : L('Copiar', 'Copy')}
              </button>
              <button
                className="btn btn--sm btn--ghost"
                disabled={busy}
                onClick={() =>
                  void confirmDialog({
                    title: L('Trocar a chave?', 'Change the key?'),
                    body: L('A chave atual para de funcionar: cole a nova no conector do servidor.', "The current key stops working: paste the new one into the server's connector."),
                    confirm: L('Trocar a chave', 'Change the key')
                  }).then((ok) => ok && run(call('rotateNodeKey')))
                }
              >
                {L('Trocar', 'Change')}
              </button>
            </div>
          )}
          <ol className="small node-card__steps">
            <li>
              {L('Neste computador, com o Tailscale aberto:', 'On this computer, with Tailscale open:')} <code>tailscale serve --bg {info.port}</code>
            </li>
            <li>{L('No Tucano do servidor: Conectores › Adicionar personalizado › Remoto, com o endereço https://<este-computador>.<sua-rede>.ts.net/mcp e autenticação Token, colando a chave.', "In the server's Tucano: Connectors › Add custom › Remote, with the address https://<this-computer>.<your-tailnet>.ts.net/mcp and Token authentication, pasting the key.")}</li>
            <li>{L('Dê acesso aos agentes que vão usar este computador, em Ferramentas.', 'Give access to the agents that will use this computer, under Tools.')}</li>
          </ol>
        </div>
      )}
    </Card>
  )
}
