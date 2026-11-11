// An agent's row in the sidebar is its DM too (one list, "Agentes"): its role after the name (grey, cut
// with an ellipsis, in full on hover, and with a team, whose agent it is), and its DM's unread count.
import { parseHTML } from 'linkedom'
import { act } from 'react'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Agent, Conversation, Person } from '../src/shared/types'
import type { State } from '../src/renderer/src/store'

const { window, document } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>')
Object.assign(globalThis, { window, document, HTMLElement: window.HTMLElement, Node: window.Node, IS_REACT_ACT_ENVIRONMENT: true, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) })
Object.assign(window, { tucano: {} })
vi.mock('open-bot-avatar/dom', () => ({ mountAvatar: () => new Proxy({}, { get: () => () => {} }) }))

let fake: State
vi.mock('../src/renderer/src/store', async (original) => {
  const real = await original<typeof import('../src/renderer/src/store')>()
  return { ...real, useStore: <T,>(select: (s: State) => T): T => select(fake) }
})
const { getState } = await import('../src/renderer/src/store')
const { createRoot } = await import('react-dom/client')
const { Sidebar } = await import('../src/renderer/src/components/Sidebar')

const ana: Person = { id: 'ana', name: 'Ana', role: 'owner', about: '' }
const bia: Person = { id: 'bia', name: 'Bia', role: 'member', about: '' }
const agent = (p: Partial<Agent>): Agent => ({ id: 'a1', name: 'Lia', handle: 'lia', role: 'Pesquisadora', color: 'sky', instructions: '', modelId: 'sonnet', effort: 'low', limit: 1_000_000, used: 0, grants: {}, memory: 'auto', computer: false, archived: false, ...p })
const dm = (p: Partial<Conversation>): Conversation => ({ id: 'd1', kind: 'dm', name: 'a1', members: ['a1'], ...p })

let root: Root
const render = async (s: Partial<State>): Promise<void> => {
  const base = getState()
  fake = { ...base, ready: true, people: [ana], you: 'ana', ...s, settings: { ...base.settings, sidebarParts: undefined } } as State
  await act(async () => root.render(<Sidebar />))
}
const sectionRow = (section: string): Element => {
  const head = [...document.querySelectorAll('.section')].find((x) => x.textContent?.includes(section))!
  return head.querySelector('.nav-item')!
}
const dmRow = (): Element => sectionRow('Agentes')

beforeEach(() => (root = createRoot(document.getElementById('root')!)))
afterEach(async () => {
  await act(async () => root.unmount())
  vi.clearAllMocks()
})

describe("an agent's row in the sidebar, which is its DM", () => {
  it("shows the agent's role after its name; there is no separate DM list", async () => {
    await render({ agents: [agent({})], conversations: [dm({}), { id: 'c1', kind: 'channel', name: 'geral', members: ['a1'] }] })
    expect(sectionRow('Canais').textContent).toContain('geral')
    expect(sectionRow('Canais').querySelector('.nav-item__role')).toBeNull()
    expect([...document.querySelectorAll('.section')].some((x) => x.textContent?.includes('ensagens diretas'))).toBe(false)
    const role = dmRow().querySelector('.nav-item__label + .nav-item__meta.nav-item__role')!
    expect(role.textContent).toBe('Pesquisadora')
    expect(role.getAttribute('title')).toBe('Pesquisadora')
  })

  it("keeps its DM's unread count after the role", async () => {
    await render({ agents: [agent({})], conversations: [dm({ unread: 3 })] })
    const parts = [...dmRow().children].map((x) => x.className)
    expect(parts.findIndex((c) => c.includes('nav-item__hit'))).toBeLessThan(parts.findIndex((c) => c.includes('badge')))
    expect(dmRow().querySelector('.badge')!.textContent).toBe('3')
  })

  it('an agent with no role shows just its name', async () => {
    await render({ agents: [agent({ role: '' })], conversations: [dm({})] })
    expect(dmRow().querySelector('.nav-item__role')!.textContent).toBe('')
    expect(dmRow().querySelector('.nav-item__label')!.textContent).toBe('Lia')
  })

  it("with a team, someone else's agent says whose it is on hover; mine doesn't", async () => {
    const team = { people: [ana, bia], you: 'bia' }
    await render({ ...team, agents: [agent({ owner: 'ana' })], conversations: [dm({ owner: 'bia' })] })
    expect(dmRow().querySelector('.nav-item__role')!.getAttribute('title')).toBe('Pesquisadora · de Ana')
    await render({ ...team, agents: [agent({ owner: 'bia' })], conversations: [dm({ owner: 'bia' })] })
    expect(dmRow().querySelector('.nav-item__role')!.getAttribute('title')).toBe('Pesquisadora')
  })
})
