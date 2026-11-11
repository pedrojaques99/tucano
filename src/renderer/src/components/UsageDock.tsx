// What's left of each subscription, always in sight at the foot of the sidebar: a ring around the
// harness's mark (the shortest window's share left), and on hover or focus every window the CLI
// reported, with its share left and when it resets. Only what a CLI tells shows: today that's Claude
// Code (its 5-hour and weekly windows, and any per-model one it adds); a harness that reports nothing
// has no ring rather than a made-up one. A click opens Uso e limites.
import { L } from '../../../shared/lang'
import { ENGINES, type EngineId, type Quota } from '../../../shared/types'
import type { ReactNode } from 'react'
import { navigate, useStore } from '../store'
import { EngineMark, Icon } from './ui'

type Window = { label: string; utilization: number; resetsAt: number }

// The windows of a quota, in the order the popover lists them.
export function windowsOf(q: Quota | undefined): Window[] {
  if (!q) return []
  const out: Window[] = []
  if (q.fiveHour) out.push({ label: L('5 horas', '5 hours'), ...q.fiveHour })
  if (q.sevenDay) out.push({ label: L('Semanal', 'Weekly'), ...q.sevenDay })
  for (const o of q.others ?? []) out.push({ label: windowLabel(o.key), utilization: o.utilization, resetsAt: o.resetsAt })
  return out
}

// A window the CLI names on its own ("seven_day_opus"): its words, readable ("Opus, semanal").
export function windowLabel(key: string): string {
  const m = /^(five_hour|seven_day)_(.+)$/.exec(key)
  const name = (m ? m[2]! : key).split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  if (!m) return name
  return m[1] === 'five_hour' ? L(`${name}, 5 horas`, `${name}, 5 hours`) : L(`${name}, semanal`, `${name}, weekly`)
}

const left = (w: Window): number => Math.min(1, Math.max(0, 1 - w.utilization))
export const tone = (share: number): '' | 'is-warn' | 'is-danger' => (share < 0.1 ? 'is-danger' : share < 0.3 ? 'is-warn' : '')

// "17 min", "3 h 5 min", "3 d 8 h": until the window resets.
export function resetsIn(at: number, now = Date.now()): string {
  const min = Math.max(0, Math.round((at - now) / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return min % 60 ? `${h} h ${min % 60} min` : `${h} h`
  const d = Math.floor(h / 24)
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`
}

function Ring({ engine, share }: { engine: EngineId; share: number }): ReactNode {
  const r = 13
  const c = 2 * Math.PI * r
  return (
    <span className={`usage-dock__ring ${tone(share)}`}>
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r={r} className="usage-dock__track" />
        <circle cx="16" cy="16" r={r} className="usage-dock__fill" strokeDasharray={c} strokeDashoffset={c * (1 - share)} />
      </svg>
      <EngineMark engine={engine} size={16} />
    </span>
  )
}

export function UsageDock(): ReactNode {
  const quota = useStore((s) => s.settings.quota)
  const account = useStore((s) => s.settings.engines.claude.account)
  const reported: { engine: EngineId; account?: string; windows: Window[] }[] = [{ engine: 'claude' as EngineId, account, windows: windowsOf(quota) }].filter((p) => p.windows.length > 0)
  if (!reported.length) return null
  return (
    <div className="usage-dock">
      {reported.map((p) => {
        const share = Math.min(...p.windows.map(left))
        const name = ENGINES[p.engine].label
        return (
          <div key={p.engine} className="usage-dock__item">
            <button className="usage-dock__btn" aria-label={L(`${name}: ${Math.round(share * 100)}% restante. Abrir Uso e limites`, `${name}: ${Math.round(share * 100)}% left. Open Usage and limits`)} aria-describedby={`usage-${p.engine}`} onClick={() => navigate({ kind: 'usage' })}>
              <Ring engine={p.engine} share={share} />
            </button>
            <div id={`usage-${p.engine}`} role="tooltip" className="usage-pop">
              <span className="usage-pop__title">
                <Icon name="chart" size={14} /> {L('Uso', 'Usage')}
              </span>
              <span className="usage-pop__who">
                <EngineMark engine={p.engine} size={16} />
                <b>{name}</b>
                {p.account && <span>· {p.account}</span>}
              </span>
              <dl className="usage-pop__rows">
                {p.windows.map((w) => {
                  const s = left(w)
                  return (
                    <div key={w.label} className={`usage-pop__row ${tone(s)}`}>
                      <dt>{w.label}</dt>
                      <dd className="usage-pop__bar" aria-hidden>
                        <span style={{ width: `${s * 100}%` }} />
                      </dd>
                      <dd className="usage-pop__pct">{L(`${Math.round(s * 100)}% restante`, `${Math.round(s * 100)}% left`)}</dd>
                      <dd className="usage-pop__when">{resetsIn(w.resetsAt)}</dd>
                    </div>
                  )
                })}
              </dl>
            </div>
          </div>
        )
      })}
    </div>
  )
}
