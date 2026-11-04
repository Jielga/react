import { MantineThemeProvider, Portal } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Keep Mantine portals (menus, popovers, modals, tooltips) in the window
 * their trigger is rendered in.
 *
 * Mantine's `Portal` mounts into the global `document.body` - the MAIN
 * window's body - even when the component sits in a popup document, because
 * popup content executes in the opener's realm. A column menu or a `Modal`
 * opened from a grid inside the popup would appear in the main window.
 *
 * The fix: `Portal` reads its default props from the nearest Mantine theme,
 * so this wrapper detects which document it got mounted into (via a ref) and
 * provides that document's body as the default portal target. Rendered
 * inline it resolves to the main body (the default behaviour); rendered
 * through `<Popup>` it resolves to the popup body. `MantineThemeProvider`
 * with `inherit` only overrides theme context - no duplicate CSS variables.
 *
 * The target resolves in an effect, so an overlay that opens during the very
 * first render still lands in the main body; user-triggered overlays open
 * after mount and are unaffected. Window-level behaviour a component binds
 * itself (Mantine's Modal listens for Escape on the opener `window`) is not
 * redirected by this wrapper - see the popup-content skill.
 */
export function SameWindowPortals({ children }: { children: ReactNode }) {
  const probeRef = useRef<HTMLDivElement>(null)
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setTarget(probeRef.current?.ownerDocument.body ?? null)
  }, [])

  const theme = useMemo(
    () => ({
      components: {
        Portal: Portal.extend({ defaultProps: target ? { target } : {} }),
      },
    }),
    [target],
  )

  return (
    <div ref={probeRef} style={{ display: 'contents' }}>
      <MantineThemeProvider inherit theme={theme}>
        {children}
      </MantineThemeProvider>
    </div>
  )
}
