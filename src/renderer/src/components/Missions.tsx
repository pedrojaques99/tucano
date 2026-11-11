// Missões: what's worth trying after the first message, each one checking itself off when it
// happens (as "Primeiros passos" did). On a new install each also brings a part of the sidebar,
// which starts short; a part with something in it shows anyway, and "Mostrar tudo de uma vez" ends it.
import { L } from '../../../shared/lang'
import { freshParts, MISSIONS, missionsDone, partShows, shortSidebar, type MissionFacts, type MissionId, type SidebarPart } from '../../../shared/onboarding'
import type { ReactNode } from 'react'
import { getState, isTeam, navigate, openTuca, updateSettings, useStore, type State, type View } from '../store'
import { Icon, TucaMark } from './ui'

// Whether one of the team's agents (not the Tuca) finished a reply, and whether an agent's question
// was answered: read once per change of the messages.
const talked = new WeakMap<State['messages'], { replied: boolean; answered: boolean }>()
function conversationFacts(s: State): { replied: boolean; answered: boolean } {
  const had = talked.get(s.messages)
  if (had) return had
  const team = new Set(s.agents.filter(isTeam).map((a) => a.id))
  const out = { replied: false, answered: false }
  for (const list of Object.values(s.messages))
    for (const m of list) {
      if (m.author.kind !== 'agent' || !m.run) continue
      if (m.run.status === 'done' && team.has(m.author.id)) out.replied = true
      if (m.run.question && m.run.status !== 'waiting_input') out.answered = true
    }
  talked.set(s.messages, out)
  return out
}

// What the missions look at, as values: the sidebar redraws only when one changes.
export const missionFacts = (s: State): MissionFacts => {
  const c = conversationFacts(s)
  return {
    replied: c.replied,
    decided: c.answered || s.approvals.some((a) => a.state !== 'pending'),
    connectors: s.connectors.length,
    agents: s.agents.filter(isTeam).length,
    routines: s.routines.length,
    memories: s.memories.filter((m) => m.state === 'active').length
  }
}

export function useMissions(): { facts: MissionFacts; done: Set<MissionId> } {
  // A plain object of values: the store keeps it while it's the same, so nothing redraws for nothing.
  const facts = useStore(missionFacts)
  return { facts, done: missionsDone(facts) }
}

// Which parts of the sidebar show, and which a mission just brought (tagged new until opened).
export function useSidebarParts(): { shows: (p: SidebarPart) => boolean; fresh: (p: SidebarPart) => boolean; seen: (p: SidebarPart) => void } {
  const onboarding = useStore((s) => s.settings.onboarding)
  const has = useStore((s) => `${s.memories.length > 0}|${s.routines.length > 0}|${s.skills.length > 0}|${s.connectors.length > 0}|${s.conversations.filter((c) => c.kind === 'channel').length > 1}`)
  const { done } = useMissions()
  const [memory, routines, skills, connectors, channels] = has.split('|').map((x) => x === 'true')
  const content: Partial<Record<SidebarPart, boolean>> = { memory, routines, skills, connectors, channels }
  const newOnes = freshParts(onboarding, done)
  return {
    shows: (p) => partShows(p, onboarding, done, content),
    fresh: (p) => newOnes.includes(p),
    seen: (p) => {
      const o = getState().settings.onboarding
      if (o && shortSidebar(o) && !(o.seen ?? []).includes(p)) updateSettings({ onboarding: { ...o, seen: [...(o.seen ?? []), p] } })
    }
  }
}

const agentName = (s: State): string => s.agents.find(isTeam)?.name ?? L('seu agente', 'your agent')

const go = (id: MissionId): View | 'tuca' => {
  const s = getState()
  const channel = s.conversations.find((c) => c.id === s.settings.onboarding?.channel) ?? s.conversations.find((c) => c.kind === 'channel')
  if (id === 'talk') return channel ? { kind: 'conversation', id: channel.id } : 'tuca'
  if (id === 'approve') return { kind: 'approvals' }
  if (id === 'connect') return { kind: 'connectors' }
  if (id === 'second') return 'tuca'
  if (id === 'auto') return { kind: 'routines' }
  return { kind: 'memory' }
}
const doIt = (id: MissionId): void => {
  const to = go(id)
  if (to === 'tuca') openTuca()
  else navigate(to)
}

// "Fale com a Lia" as the rest of a sentence: only its first letter goes down (names keep theirs).
const lower = (t: string): string => t.charAt(0).toLowerCase() + t.slice(1)

// At the bottom of the sidebar: how many are done, and the next one.
export function MissionsCard(): ReactNode {
  const { done } = useMissions()
  const name = useStore(agentName)
  const onboarding = useStore((s) => s.settings.onboarding)
  const active = useStore((s) => s.view?.kind === 'missions')
  const all = MISSIONS()
  const count = all.filter((m) => done.has(m.id)).length
  const next = all.find((m) => !done.has(m.id))
  const brought = freshParts(onboarding, done)
  const latest = [...all].reverse().find((m) => done.has(m.id) && m.unlocks.some((p) => brought.includes(p)))
  const line = latest ? L(`Você liberou ${latest.unlockName}`, `You unlocked ${latest.unlockName}`) : next ? L(`Próxima: ${lower(next.title(name))}`, `Next: ${lower(next.title(name))}`) : L('Você conhece o Tucano inteiro', 'You know all of Tucano')
  return (
    <button className={`missions-card ${active ? 'is-active' : ''} ${latest ? 'is-new' : ''}`} data-coach="missions" onClick={() => navigate({ kind: 'missions' })}>
      <span className="missions-card__text">
        <span className="missions-card__head">
          <b>{L('Missões', 'Missions')}</b>
          <span className="missions-card__count" aria-hidden>
            {count}/{all.length}
          </span>
        </span>
        <span>{line}</span>
        <span className="missions-card__bar" aria-hidden>
          <span style={{ width: `${(count / all.length) * 100}%` }} />
        </span>
      </span>
      <span className="sr-only">{L(`${count} de ${all.length} feitas`, `${count} of ${all.length} done`)}</span>
    </button>
  )
}

// The missions folded into the sidebar's foot: a ring with how many are done. A click opens or closes
// the card above it (MissionsCard), and the fold is kept like any other (Fold.tsx).
export function MissionsChip({ open, onToggle }: { open: boolean; onToggle: () => void }): ReactNode {
  const { done } = useMissions()
  const all = MISSIONS()
  const count = all.filter((m) => done.has(m.id)).length
  const r = 7
  const c = 2 * Math.PI * r
  return (
    <button className={`missions-chip ${open ? 'is-open' : ''}`} aria-expanded={open} onClick={onToggle} title={open ? L('Recolher as missões', 'Fold the missions') : L('Ver as missões', 'Show the missions')}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <circle cx="9" cy="9" r={r} className="missions-chip__track" />
        <circle cx="9" cy="9" r={r} className="missions-chip__fill" strokeDasharray={c} strokeDashoffset={c * (1 - count / all.length)} />
      </svg>
      <span className="missions-chip__label">{L('Missões', 'Missions')}</span>
      <span className="missions-chip__count">
        {count}/{all.length}
      </span>
      <Icon name="chevron" size={11} />
    </button>
  )
}

export function MissionsPage(): ReactNode {
  const { done } = useMissions()
  const name = useStore(agentName)
  const onboarding = useStore((s) => s.settings.onboarding)
  const all = MISSIONS()
  const next = all.find((m) => !done.has(m.id))
  const short = shortSidebar(onboarding)
  return (
    <div className="missions">
      <div className="missions__head">
        <div>
          <h1>{L('Missões', 'Missions')}</h1>
          <p>{short ? L('Cada uma te mostra uma parte do Tucano, e ela aparece na barra quando você chega lá.', 'Each one shows you a part of Tucano, and it shows up in the sidebar when you get there.') : L('Cada uma te mostra uma parte do Tucano e se marca sozinha quando você usa.', 'Each one shows you a part of Tucano and checks itself off when you use it.')}</p>
        </div>
        {short && (
          <button className="missions-link" onClick={() => updateSettings({ onboarding: { ...onboarding!, showAll: true } })}>
            {L('Mostrar tudo de uma vez', 'Show everything at once')}
          </button>
        )}
      </div>
      <ol className="missions__grid">
        {all.map((m) => {
          const isDone = done.has(m.id)
          const isNext = m === next
          return (
            <li key={m.id} className={`mission ${isDone ? 'is-done' : isNext ? 'is-next' : ''}`}>
              <span className="mission__art" aria-hidden>
                <MissionArt id={m.id} />
                {isDone && (
                  <span className="mission__check">
                    <Icon name="check" size={11} />
                  </span>
                )}
              </span>
              <b>{m.title(name)}</b>
              {isDone ? (
                <span className="mission__state">{m.unlocks.length && short ? L(`Feita · liberou ${m.unlockName}`, `Done · unlocked ${m.unlockName}`) : L('Feita', 'Done')}</span>
              ) : (
                <span className="mission__how">
                  {m.how}
                  {m.unlocks.length > 0 && short && (
                    <>
                      {' '}
                      {L('Libera', 'Unlocks')} <b>{m.unlockName}</b>.
                    </>
                  )}
                </span>
              )}
              {!isDone && (
                <button className={`mission__go ${isNext ? '' : 'is-quiet'}`} onClick={() => doIt(m.id)}>
                  {L('Fazer agora', 'Do it now')}
                  <span className="sr-only">: {m.title(name)}</span>
                </button>
              )}
            </li>
          )
        })}
      </ol>
      <div className="missions__help">
        <TucaMark size={40} />
        <span className="grow">
          {L('Travou em alguma? Me chama no ', 'Stuck on one? Call me at ')}
          <b>Tuca</b>
          {L(', no topo da barra. Eu faço com você.', ', at the top of the sidebar. I’ll do it with you.')}
        </span>
        <button className="missions-link" onClick={openTuca}>
          {L('Chamar o Tuca', 'Call Tuca')}
        </button>
      </div>
      <p className="missions__foot">
        <button className="missions-link missions-link--quiet" onClick={() => (updateSettings({ onboarding: { ...(onboarding ?? { done: true }), checklistHidden: true } }), navigate({ kind: 'approvals' }))}>
          {L('Esconder as missões', 'Hide the missions')}
        </button>{' '}
        <span>{L('Voltam em Configurações.', 'They come back in Settings.')}</span>
      </p>
    </div>
  )
}

// Each mission's little drawing, in the app icon's own language: flat round shapes in the toucan's ink,
// its beak orange and paper. What it shows is what the mission does, so the list reads at a glance.
const INK = 'var(--art-ink)'
const BEAK = '#FF8C24'
const JAW = '#E5531F'
const PAPER = 'var(--art-paper)'
function MissionArt({ id }: { id: MissionId }): ReactNode {
  const art: Record<MissionId, ReactNode> = {
    // Talk: two bubbles, the reply in the beak's orange.
    talk: (
      <>
        <rect x="5" y="9" width="20" height="14" rx="7" fill={INK} />
        <path d="M9 21 L8 27 L14 22 Z" fill={INK} />
        <rect x="15" y="17" width="20" height="14" rx="7" fill={BEAK} />
        <path d="M31 29 L32 35 L26 30 Z" fill={BEAK} />
        <circle cx="21" cy="24" r="1.6" fill={PAPER} />
        <circle cx="25" cy="24" r="1.6" fill={PAPER} />
        <circle cx="29" cy="24" r="1.6" fill={PAPER} />
      </>
    ),
    // Approve: a request card, and the yes on it.
    approve: (
      <>
        <rect x="6" y="8" width="24" height="26" rx="5" fill={PAPER} stroke={INK} strokeWidth="1" />
        <rect x="10" y="13" width="12" height="2.5" rx="1.25" fill={INK} opacity=".35" />
        <rect x="10" y="18" width="16" height="2.5" rx="1.25" fill={INK} opacity=".35" />
        <circle cx="29" cy="28" r="7" fill={BEAK} />
        <path d="M25.8 28.2 L28 30.4 L32.2 25.8" stroke={PAPER} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    // Connect: two ends meeting, one the app's, one the account's.
    connect: (
      <>
        <rect x="4" y="15" width="15" height="10" rx="5" fill={INK} />
        <rect x="21" y="15" width="15" height="10" rx="5" fill={BEAK} />
        <rect x="16" y="18.5" width="8" height="3" rx="1.5" fill={JAW} />
        <circle cx="10" cy="20" r="2" fill={PAPER} />
        <circle cx="30" cy="20" r="2" fill={PAPER} />
      </>
    ),
    // A second agent: two faces side by side, the agents' own shape.
    second: (
      <>
        <rect x="4" y="10" width="17" height="17" rx="5.5" fill={INK} />
        <rect x="8.5" y="15.5" width="2.6" height="4.6" rx="1.3" fill={PAPER} />
        <rect x="13.9" y="15.5" width="2.6" height="4.6" rx="1.3" fill={PAPER} />
        <rect x="19" y="14" width="17" height="17" rx="5.5" fill={BEAK} />
        <rect x="23.5" y="19.5" width="2.6" height="4.6" rx="1.3" fill={PAPER} />
        <rect x="28.9" y="19.5" width="2.6" height="4.6" rx="1.3" fill={PAPER} />
      </>
    ),
    // On its own: a clock face whose hand is the beak.
    auto: (
      <>
        <circle cx="20" cy="20" r="14" fill={INK} />
        <circle cx="20" cy="20" r="10.5" fill={PAPER} />
        <path d="M20 20 L20 12.5" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        <path d="M20 18 L29 20 L20 22 Z" fill={BEAK} />
        <circle cx="20" cy="20" r="1.8" fill={INK} />
      </>
    ),
    // Keep: pages in a stack, with the beak's tab marking the one that matters.
    remember: (
      <>
        <rect x="9" y="6" width="22" height="26" rx="4" fill={INK} opacity=".25" />
        <rect x="6" y="9" width="22" height="26" rx="4" fill={PAPER} stroke={INK} strokeWidth="1" />
        <path d="M19 9 H25 V19 L22 16.5 L19 19 Z" fill={BEAK} />
        <rect x="10" y="22" width="13" height="2.5" rx="1.25" fill={INK} opacity=".35" />
        <rect x="10" y="27" width="9" height="2.5" rx="1.25" fill={INK} opacity=".35" />
      </>
    )
  }
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      {art[id]}
    </svg>
  )
}
