import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SiteHeader } from 'docs-shell/SiteHeader.tsx'
import { CounterExample } from './examples/CounterExample'
import { DataTableExample } from './examples/DataTableExample'
import { PanelsExample } from './examples/PanelsExample'

const queryClient = new QueryClient()

const QUICK_START = `import { usePopupWindow } from '@jielga/react-popup-window'

function Dashboard() {
  const { open, close, isOpen, Popup } = usePopupWindow({
    title: 'Detached panel',
    features: { width: 640, height: 480 },
  })

  return (
    <>
      <button onClick={open}>Open in new window</button>
      <Popup>
        {/* Rendered into the popup window while remaining part of this
            component tree: state, context and events keep working. */}
        <MyPanel />
      </Popup>
    </>
  )
}`

const TABLE_SNIPPET = `const { open, close, focus, isOpen, Popup } = usePopupWindow({
  title: 'People — detached grid',
  features: { width: 720, height: 480 },
})

const peopleGrid = <PeopleGrid /> // TMDataGrid + useQuery() inside

return (
  <>
    {isOpen
      ? <DetachedNote onFocus={focus} onBringBack={close} />
      : <><button onClick={open}>Open grid in new window</button>{peopleGrid}</>}
    <Popup>{peopleGrid}</Popup>
  </>
)`

const PORTAL_TARGET_SNIPPET = `// Mantine portals (menus, popovers, modals, tooltips) mount into the MAIN
// window's document.body - wrong window when the trigger lives in the popup.
// Portal reads default props from the nearest Mantine theme, so: detect the
// document we got mounted into and provide its body as the portal target.
export function SameWindowPortals({ children }) {
  const probeRef = useRef(null)
  const [target, setTarget] = useState(null)
  useEffect(() => setTarget(probeRef.current?.ownerDocument.body ?? null), [])

  const theme = useMemo(() => ({
    components: {
      Portal: Portal.extend({ defaultProps: target ? { target } : {} }),
    },
  }), [target])

  return (
    <div ref={probeRef} style={{ display: 'contents' }}>
      <MantineThemeProvider inherit theme={theme}>{children}</MantineThemeProvider>
    </div>
  )
}`

const PANELS_SNIPPET = `const resultsPanelRef = usePanelRef() // react-resizable-panels
const { open, close, focus, isOpen, Popup } = usePopupWindow({
  title: 'Search results',
  url: '/popup.html', // empty page served by the app; the address bar shows it instead of about:blank
})

// Collapse the results panel to a control strip while popped out;
// expand again when the popup closes (button or the user closing it).
useEffect(() => {
  if (isOpen) resultsPanelRef.current?.collapse()
  else resultsPanelRef.current?.expand()
}, [isOpen, resultsPanelRef])

const results = <ResultsGrid filters={filters} /> // filters state stays here

<Panel panelRef={resultsPanelRef} collapsible collapsedSize="56px" minSize="30%">
  {isOpen
    ? <Strip onFocus={focus} onBringBack={close} />
    : <><button onClick={open}>Open in new window ↗</button>{results}</>}
</Panel>
// …
<Popup>{results}</Popup>`

export function App() {
  return (
    <MantineProvider defaultColorScheme="auto">
      <AppInner />
    </MantineProvider>
  )
}

function AppInner() {
  return (
    <QueryClientProvider client={queryClient}>
      <SiteHeader site="react-popup-window" />
      <div className="container">
        <div className="intro">
          <h1>@jielga/react-popup-window</h1>
          <p className="tagline">
            A React hook for rendering part of a component tree in a separate browser window.
            Content is rendered through a portal, so state, context and event handlers work across
            windows.
          </p>
        </div>

        <section>
          <h2>Install</h2>
          <pre>
            <code>npm install @jielga/react-popup-window</code>
          </pre>
          <p className="muted">Requires React 19.2+.</p>
        </section>

        <section>
          <h2>Quick start</h2>
          <pre>
            <code>{QUICK_START}</code>
          </pre>
        </section>

        <section>
          <h2>Examples</h2>
          <p className="muted">
            All examples run live on this page. Switching the colour scheme in the header while a
            popup is open demonstrates stylesheet and root-attribute synchronization.
          </p>

          <div className="card">
            <h3>Detached data grid (TMDataGrid + TanStack Query)</h3>
            <p>
              A <a href="https://github.com/Jielga/react/tree/main/packages/tmdatagrid">@jielga/tmdatagrid</a> grid backed by{' '}
              <code>useQuery</code>. The <code>QueryClientProvider</code> and the{' '}
              <code>MantineProvider</code> the grid requires are mounted once, in the main window's
              tree; the popup content reaches them through React context. While detached, the main
              window hides the grid. The Dataset details button opens a Mantine Modal that follows
              the grid: detached, it opens inside the popup window. The grid persists its state to{' '}
              <code>localStorage</code>, which is shared by both windows - hide, resize or reorder a
              column here, and the layout is still there after popping the grid out or reloading
              the page.
            </p>
            <div className="demo">
              <DataTableExample />
            </div>
            <pre>
              <code>{TABLE_SNIPPET}</code>
            </pre>
          </div>

          <div className="card">
            <h3>Resizable panels with a pop-out results grid</h3>
            <p>
              Built with{' '}
              <a href="https://github.com/bvaughn/react-resizable-panels">react-resizable-panels</a>{' '}
              and <a href="https://github.com/Jielga/react/tree/main/packages/tmdatagrid">@jielga/tmdatagrid</a>. The left
              panel holds the query form; the right panel holds a grid with 400 virtualized rows,
              sortable, resizable, reorderable and pinnable columns, column filters, row selection,
              and a drag-selectable cell range. Opening the results in a new window collapses the
              panel to a control strip with focus and close actions. The popup loads an empty page
              from this site, so its address bar shows the site's URL instead of about:blank. The
              filter state lives in the main window, so editing filters updates the popped-out grid.
            </p>
            <div className="demo">
              <PanelsExample />
            </div>
            <pre>
              <code>{PANELS_SNIPPET}</code>
            </pre>
          </div>

          <div className="card">
            <h3>Menus, modals and tooltips opening in the wrong window</h3>
            <p>
              Component libraries render menus, popovers, modals and tooltips through portals into{' '}
              <code>document.body</code>, which is the main window's body even for components
              rendered inside the popup. Mantine reads portal defaults from its theme, so a small
              wrapper can redirect portals to the document its children are rendered in. The grids
              on this page use this wrapper; a column menu or the Dataset details modal opened in a
              popped-out grid stays in the popup window. Handlers a component binds on the bare{' '}
              <code>window</code> still attach to the main window - Mantine's Modal listens for
              Escape there - so the grid example adds its own Escape listener on the window it is
              rendered in. Code that compares against the global <code>document</code> fails the
              same way: Mantine's focus trap walks up to <code>document.body</code>, which is the
              main window's, so the example turns the modal's <code>trapFocus</code> off when it
              opens in the popup.
            </p>
            <pre>
              <code>{PORTAL_TARGET_SNIPPET}</code>
            </pre>
          </div>

          <div className="card">
            <h3>Shared state and events</h3>
            <p>
              A counter whose state is owned by a component in the main window. The button rendered
              in the popup updates that state directly, without messaging or synchronization.
            </p>
            <div className="demo">
              <CounterExample />
            </div>
          </div>

          <div className="card">
            <h3>Communication</h3>
            <p>
              The library provides no message channel. Popup content remains part of the calling
              component tree and executes in the opener's JavaScript realm, so props, state and
              context are the communication mechanism. For non-React scripts hosted in the popup
              document itself, the <code>popupWindow</code> handle supports standard{' '}
              <code>postMessage</code> interoperation.
            </p>
          </div>
        </section>

        <section>
          <h2>API</h2>
          <p>
            <code>usePopupWindow(options?)</code> returns:
          </p>
          <table className="api-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>Popup</code>
                </td>
                <td>
                  Portal component (stable identity). Renders children into the popup window while
                  open, nothing otherwise.
                </td>
              </tr>
              <tr>
                <td>
                  <code>open()</code>
                </td>
                <td>
                  Opens the popup, or focuses it if already open. Must be called from a user
                  gesture. Returns the <code>Window</code>, or <code>null</code> when blocked.
                </td>
              </tr>
              <tr>
                <td>
                  <code>close()</code> / <code>toggle()</code> / <code>focus()</code>
                </td>
                <td>Window controls.</td>
              </tr>
              <tr>
                <td>
                  <code>isOpen</code> / <code>isBlocked</code> / <code>popupWindow</code>
                </td>
                <td>
                  Reactive state: open flag, popup-blocked flag, and the raw <code>Window</code>{' '}
                  while open.
                </td>
              </tr>
            </tbody>
          </table>
          <p style={{ marginTop: '0.9rem' }}>
            Options: <code>title</code>, <code>name</code>, <code>url</code>, <code>features</code> (width/height/…,
            default <code>{'{ popup: true, width: 640, height: 480 }'}</code>), <code>center</code>,{' '}
            <code>copyStyles</code>, <code>onOpen</code>, <code>onClose</code>,{' '}
            <code>onBlocked</code>. Full reference in the{' '}
            <a href="https://github.com/Jielga/react/blob/main/packages/react-popup-window/README.md#api">README</a>.
          </p>
        </section>

        <section>
          <h2>Limitations</h2>
          <ul>
            <li>
              Browsers do not allow hiding the address bar entirely. <code>popup: true</code> (the
              default) requests the minimal window chrome the platform provides.
            </li>
            <li>
              <code>open()</code> must be called from a user gesture; otherwise the popup blocker
              intervenes and <code>isBlocked</code> is set.
            </li>
            <li>
              The popup closes when the component that owns the hook unmounts and when the main
              window unloads.
            </li>
            <li>
              Popup content unmounts and remounts when it moves between windows. State that should
              survive detaching belongs in the owning component or an external store.
            </li>
          </ul>
        </section>

        <footer className="site-footer">
          MIT © jielga —{' '}
          <a href="https://github.com/Jielga/react/tree/main/packages/react-popup-window">
            github.com/Jielga/react
          </a>
        </footer>
      </div>
    </QueryClientProvider>
  )
}
