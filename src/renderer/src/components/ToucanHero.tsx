// The first run's opening field: the app icon's toucan at the scale of half a window, on the beak's
// orange, cropped as the icon is. It tells the headline, not just the brand: a team of agents perched on
// the beak (each with the tool of its trade) and one status going through their work in turn, ending on
// the thing Tucano is about, an approval ("Posso enviar?" then approved). The toucan is alive: the eye
// follows the pointer and blinks, the head tilts while the person types their name, and it says hi by
// name. With "Reduzir movimento" on, it all stands still on the approval.
import { L } from '../../../shared/lang'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AgentAvatar, AVATARS, Icon, useLiveEye } from './ui'
import type { AgentColor } from '../store'

// The team on the beak, and what each one is doing when the status reaches it.
const TEAM = (): { color: AgentColor; look: string; name: string; doing: string; ask?: boolean }[] => [
  { color: 'sky', look: 'magnifier', name: 'Iris', doing: L('Pesquisando 12 fontes…', 'Reading 12 sources…') },
  { color: 'rose', look: 'paint-brush', name: 'Nina', doing: L('Rascunho do e-mail pronto', 'Email draft ready') },
  { color: 'teal', look: 'chat', name: 'Duda', doing: L('Posso enviar?', 'Can I send it?'), ask: true }
]
const BEAT = 2400 // ms each status stays

export function ToucanHero({ name }: { name: string }): ReactNode {
  const svg = useRef<SVGSVGElement>(null)
  useLiveEye(svg)
  const first = name.trim().split(/\s+/)[0] ?? ''
  // Typing: the head tilts, as if listening; it settles a moment after the last key.
  const [listening, setListening] = useState(false)
  useEffect(() => {
    if (!first) return
    setListening(true)
    const t = setTimeout(() => setListening(false), 700)
    return () => clearTimeout(t)
  }, [first])
  // The status goes through the team; the last beat is the approval, shown asked and then approved.
  const team = TEAM()
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const [beat, setBeat] = useState(still ? team.length : 0) // team.length = the approval, approved
  useEffect(() => {
    if (still) return
    const t = setInterval(() => setBeat((b) => (b + 1) % (team.length + 1)), BEAT)
    return () => clearInterval(t)
  }, [still, team.length])
  const at = Math.min(beat, team.length - 1)
  const approved = beat === team.length
  const now = team[at]!
  return (
    <div className="tuca-hero" aria-hidden>
      <span className="tuca-hero__word">Tucano</span>
      <svg ref={svg} className={`tuca-hero__art ${listening ? 'is-listening' : ''}`} viewBox="0 0 400 560" preserveAspectRatio="xMidYMax slice">
        <g className="tuca-hero__head">
          <circle cx="27" cy="73" r="48" className="tuca-hero__body" />
          <g className="tuca__eye">
            <circle cx="38" cy="47" r="14" fill="#fff" />
            <circle className="tuca__pupil" cx="43" cy="47" r="5.5" fill="#121212" />
          </g>
          <path d="M53 57 L95 57 Q86 70 53 71 Z" className="tuca-hero__jaw" />
          <path d="M53 24 Q84 25 93 44 L96 57 L53 57 Z" className="tuca-hero__beak" />
          <path d="M83 57 A9 12 0 0 1 97 47 L97 57 Z" className="tuca-hero__body" />
        </g>
        {/* The team, perched on the top of the beak (its flat edge runs from x 252 to ~350 at y 251). */}
        <foreignObject x="248" y="150" width="138" height="112">
          <div className="tuca-hero__team">
            <span key={beat} className={`tuca-hero__status ${now.ask ? 'is-ask' : ''} ${approved ? 'is-approved' : ''}`} style={{ ['--at' as string]: at }}>
              {approved ? (
                <>
                  <Icon name="check" size={11} /> {L('Aprovado', 'Approved')}
                </>
              ) : (
                now.doing
              )}
            </span>
            <span className="tuca-hero__perch">
              {team.map((a, i) => (
                <span key={a.name} className={`tuca-hero__agent ${i === at ? 'is-on' : ''}`}>
                  <AgentAvatar agent={{ name: a.name, color: a.color, avatar: AVATARS.find((x) => x.id === a.look) }} size={38} />
                </span>
              ))}
            </span>
          </div>
        </foreignObject>
      </svg>
      <span className={`tuca-hero__say ${first ? 'is-on' : ''}`}>{first ? L(`Oi, ${first}!`, `Hi, ${first}!`) : ''}</span>
    </div>
  )
}
