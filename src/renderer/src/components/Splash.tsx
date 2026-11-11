// The opening of the introduction, in a breath: the toucan comes in with its name and the screen
// moves on. About 1.4 s, no sound. A click or any key skips it; with "Reduzir movimento" on, it doesn't play.
import { useEffect, useRef, type ReactNode } from 'react'
import { TucaMark } from './ui'

const LENGTH = 1400 // ms, the same as the CSS's --splash

export function Splash({ onDone }: { onDone: () => void }): ReactNode {
  const done = useRef(false)
  useEffect(() => {
    const finish = (): void => {
      if (done.current) return
      done.current = true
      onDone()
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return finish()
    const t = setTimeout(finish, LENGTH)
    window.addEventListener('keydown', finish)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', finish)
    }
  }, [onDone])

  return (
    <div
      className="splash"
      onClick={() => {
        if (!done.current) (done.current = true), onDone()
      }}
    >
      <div className="splash__drag" />
      <div className="splash__mark">
        <TucaMark size={64} />
        <span className="splash__name">Tucano</span>
      </div>
    </div>
  )
}
