// Bringing agents from another bot, in one place (the first run, and Settings): pick where they live,
// read the one step that bot needs, drop its .zip. OpenBot exports its own; a Hermes agent is its folder
// (with SOUL.md); Grok Bot and any other bot (OpenMaus and the like) run Tucano's export skill, which
// writes the .zip. The core reads it (agent-import.ts): no connector, web off, memories to confirm.
import { L } from '../../../shared/lang'
import { useState, type DragEvent, type ReactNode } from 'react'
import { importAgents } from '../store'
import exportSkill from '../assets/tucano-export-skill.md?raw'
import { Icon } from './ui'

const MAX_UPLOAD = 40_000_000 // a browser's request has a cap (64 MB) and base64 grows a third

// Another app's .zip: on the desktop the core reads the file where it is; in a browser it goes up whole.
export function importZip(file: File): Promise<string> {
  const path = window.tucano.pathOf?.(file)
  if (path) return importAgents({ path })
  if (file.size > MAX_UPLOAD) return Promise.reject(new Error(L('Arquivo grande demais pra mandar pelo navegador. Importe no app do computador, ou exporte sem os arquivos.', 'File too big to send through the browser. Import it in the desktop app, or export without the files.')))
  return file.arrayBuffer().then((b) => {
    const bytes = new Uint8Array(b)
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return importAgents({ data: btoa(bin) })
  })
}

export const importError = (e: unknown): string => (e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e))

export function downloadExportSkill(): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([exportSkill], { type: 'text/markdown' }))
  a.download = 'SKILL.md'
  a.click()
  URL.revokeObjectURL(a.href)
}

type Source = 'openbot' | 'hermes' | 'grok' | 'other'
const SOURCES = (): { id: Source; name: string; step: string; skill?: boolean }[] => [
  { id: 'openbot', name: 'OpenBot', step: L('Em Configurações do servidor → Transfer → Export from this server, com os arquivos. Solte o .zip aqui.', 'In Server settings → Transfer → Export from this server, with the files. Drop the .zip here.') },
  { id: 'hermes', name: 'Hermes', step: L('Compacte a pasta do agente (a ~/.hermes, com o SOUL.md) num .zip e solte aqui. Chaves e config ficam de fora.', "Zip the agent's folder (~/.hermes, with its SOUL.md) and drop it here. Keys and config stay out.") },
  { id: 'grok', name: 'Grok Bot', step: L('Dê a skill de export a um agente seu lá e peça: "Exporte meus agentes pro Tucano". Solte o .zip que ele devolver.', 'Give the export skill to one of your agents there and ask: "Export my agents to Tucano". Drop the .zip it gives back.'), skill: true },
  { id: 'other', name: L('Outro bot', 'Another bot'), step: L('OpenMaus e outros: a mesma skill de export, se o bot aceita skills. Solte o .zip que ele devolver.', 'OpenMaus and others: the same export skill, if the bot takes skills. Drop the .zip it gives back.'), skill: true }
]

export function BotImport({ onImported }: { onImported?: (summary: string) => void }): ReactNode {
  const [source, setSource] = useState<Source>('openbot')
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null)
  const [over, setOver] = useState(false)
  const s = SOURCES().find((x) => x.id === source)!
  const take = (file?: File): void => {
    if (!file) return
    setNote({ text: L('Lendo o arquivo…', 'Reading the file…'), ok: true })
    importZip(file).then(
      (summary) => (setNote({ text: summary, ok: true }), onImported?.(summary)),
      (e: unknown) => setNote({ text: importError(e), ok: false })
    )
  }
  const drop = (e: DragEvent): void => {
    e.preventDefault()
    setOver(false)
    take(e.dataTransfer.files?.[0])
  }
  return (
    <div className="bot-import">
      <div className="segmented bot-import__sources" role="radiogroup" aria-label={L('De onde vêm os agentes', 'Where the agents come from')}>
        {SOURCES().map((x) => (
          <button key={x.id} role="radio" aria-checked={source === x.id} className={source === x.id ? 'is-active' : ''} onClick={() => (setSource(x.id), setNote(null))}>
            {x.name}
          </button>
        ))}
      </div>
      <p className="bot-import__step">{s.step}</p>
      {s.skill && (
        <button className="link bot-import__skill" onClick={downloadExportSkill}>
          <Icon name="down" size={13} /> {L('Baixar a skill de export (SKILL.md)', 'Download the export skill (SKILL.md)')}
        </button>
      )}
      <label className={`bot-import__drop ${over ? 'is-over' : ''}`} onDragOver={(e) => (e.preventDefault(), setOver(true))} onDragLeave={() => setOver(false)} onDrop={drop}>
        <Icon name="folder" size={16} />
        <span>
          <b>{L('Solte o .zip aqui', 'Drop the .zip here')}</b> {L('ou clique pra escolher', 'or click to choose')}
        </span>
        <input type="file" accept=".zip,application/zip" hidden onChange={(e) => (take(e.target.files?.[0]), (e.target.value = ''))} />
      </label>
      {note && (
        <p className={`bot-import__note ${note.ok ? '' : 'is-bad'}`} role="status">
          {note.text}
        </p>
      )}
    </div>
  )
}
