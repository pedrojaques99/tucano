import { describe, expect, it } from 'vitest'
import { resetsIn, tone, windowLabel, windowsOf } from '../src/renderer/src/components/UsageDock'

describe('the usage dock', () => {
  it('says when a window resets, in the shortest words', () => {
    const now = 0
    expect(resetsIn(17 * 60_000, now)).toBe('17 min')
    expect(resetsIn(3 * 3_600_000 + 5 * 60_000, now)).toBe('3 h 5 min')
    expect(resetsIn(2 * 3_600_000, now)).toBe('2 h')
    expect(resetsIn((3 * 24 + 8) * 3_600_000, now)).toBe('3 d 8 h')
    expect(resetsIn(-1, now)).toBe('0 min')
  })
  it('lists only the windows the CLI reported, its own ones by their words', () => {
    expect(windowsOf(undefined)).toEqual([])
    const w = windowsOf({ fiveHour: { utilization: 0.18, resetsAt: 1 }, others: [{ key: 'seven_day_opus', utilization: 1, resetsAt: 2 }], at: 0 })
    expect(w.map((x) => x.label)).toEqual(['5 horas', 'Opus, semanal'])
    expect(windowLabel('something_new')).toBe('Something New')
  })
  it('warns under 30% left and alarms under 10%', () => {
    expect(tone(0.82)).toBe('')
    expect(tone(0.2)).toBe('is-warn')
    expect(tone(0)).toBe('is-danger')
  })
})
