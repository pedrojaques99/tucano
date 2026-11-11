// A thumb for each first-run goal, in the app icon's language (the same as the missions' drawings):
// flat round shapes in the toucan's ink, its beak orange and paper, each showing the work it hands off.
import type { ReactNode } from 'react'
import type { GoalId } from '../../../shared/onboarding'

const INK = 'var(--art-ink)'
const BEAK = '#FF8C24'
const JAW = '#E5531F'
const PAPER = 'var(--art-paper)'

const ART: Record<GoalId, ReactNode> = {
  // The week: a calendar page, today in the beak's orange.
  week: (
    <>
      <rect x="6" y="9" width="28" height="25" rx="5" fill={PAPER} stroke={INK} strokeWidth="1" />
      <rect x="6" y="9" width="28" height="7" rx="3.5" fill={INK} />
      <rect x="12" y="6" width="2.5" height="6" rx="1.25" fill={INK} />
      <rect x="25.5" y="6" width="2.5" height="6" rx="1.25" fill={INK} />
      {[0, 1, 2, 3].map((c) => [0, 1].map((r) => <rect key={`${c}${r}`} x={10 + c * 5.5} y={20 + r * 6} width="3.6" height="3.6" rx="1" fill={c === 2 && r === 0 ? BEAK : INK} opacity={c === 2 && r === 0 ? 1 : 0.22} />))}
    </>
  ),
  // Research: a lens over lines of text, the glass in orange.
  research: (
    <>
      <rect x="5" y="8" width="20" height="2.6" rx="1.3" fill={INK} opacity=".25" />
      <rect x="5" y="14" width="14" height="2.6" rx="1.3" fill={INK} opacity=".25" />
      <rect x="5" y="20" width="17" height="2.6" rx="1.3" fill={INK} opacity=".25" />
      <circle cx="24" cy="21" r="8.5" fill={BEAK} opacity=".9" />
      <circle cx="24" cy="21" r="5.5" fill={PAPER} opacity=".55" />
      <path d="M30 27.5 L35 32.5" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
    </>
  ),
  // Writing: a page, and a pencil whose tip is the beak.
  write: (
    <>
      <rect x="6" y="6" width="20" height="27" rx="4" fill={PAPER} stroke={INK} strokeWidth="1" />
      <rect x="10" y="12" width="11" height="2.4" rx="1.2" fill={INK} opacity=".3" />
      <rect x="10" y="17" width="8" height="2.4" rx="1.2" fill={INK} opacity=".3" />
      <path d="M33 13 L37 17 L22 32 L17 33 L18 28 Z" fill={INK} />
      <path d="M18 28 L22 32 L17 33 Z" fill={BEAK} />
    </>
  ),
  // Customers: their question in ink, the reply in orange.
  customers: (
    <>
      <rect x="4" y="7" width="22" height="15" rx="7.5" fill={INK} />
      <path d="M8 20 L7 26 L13 21 Z" fill={INK} />
      <circle cx="11" cy="14.5" r="1.6" fill={PAPER} />
      <circle cx="15" cy="14.5" r="1.6" fill={PAPER} />
      <circle cx="19" cy="14.5" r="1.6" fill={PAPER} />
      <rect x="15" y="20" width="21" height="13" rx="6.5" fill={BEAK} />
      <path d="M32 31 L33 36 L27 32 Z" fill={BEAK} />
      <path d="M21 26.5 L24 29 L29.5 23.5" stroke={PAPER} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // Spreadsheets: a grid, and the sum it gets to in orange bars.
  sheets: (
    <>
      <rect x="5" y="7" width="30" height="26" rx="5" fill={PAPER} stroke={INK} strokeWidth="1" />
      <rect x="5" y="7" width="30" height="6" rx="3" fill={INK} opacity=".85" />
      <rect x="11" y="23" width="4" height="7" rx="1" fill={BEAK} />
      <rect x="18" y="19" width="4" height="11" rx="1" fill={JAW} />
      <rect x="25" y="16" width="4" height="14" rx="1" fill={BEAK} />
    </>
  ),
  // Code: a window with its brackets in orange.
  code: (
    <>
      <rect x="4" y="7" width="32" height="26" rx="5" fill={INK} />
      <circle cx="9" cy="12" r="1.4" fill={PAPER} opacity=".5" />
      <circle cx="13" cy="12" r="1.4" fill={PAPER} opacity=".5" />
      <path d="M15 19 L11 23 L15 27" stroke={BEAK} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M25 19 L29 23 L25 27" stroke={BEAK} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21.5 18 L18.5 28" stroke={PAPER} strokeWidth="2" strokeLinecap="round" />
    </>
  )
}

export function GoalArt({ id }: { id: GoalId }): ReactNode {
  return (
    <svg className="goal-art" width="44" height="44" viewBox="0 0 40 40" aria-hidden>
      {ART[id]}
    </svg>
  )
}
