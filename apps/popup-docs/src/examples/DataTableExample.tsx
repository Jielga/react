import { Badge, Modal } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
} from '@jielga/tmdatagrid'
import type { TMDataGridPersistence } from '@jielga/tmdatagrid'
import { usePopupWindow } from '@jielga/react-popup-window'
import { fetchPeople } from './people'
import type { Person } from './people'
import { SameWindowPortals } from './SameWindowPortals'

const columnHelper = createTMDataGridColumnHelper<Person>()

const columns = columnHelper.columns([
  columnHelper.accessor('name', { header: 'Name', minSize: 150, meta: { flex: 1.3 } }),
  columnHelper.accessor('role', { header: 'Role', minSize: 100 }),
  columnHelper.accessor('city', { header: 'City', minSize: 110 }),
  columnHelper.accessor('status', {
    header: 'Status',
    minSize: 100,
    cell: (info) => (
      <Badge variant="light" size="sm" color={info.getValue() === 'active' ? 'green' : 'gray'}>
        {info.getValue()}
      </Badge>
    ),
  }),
])

const EMPTY: Person[] = []

// Module scope: the object is a dependency of the write subscription, so it
// has to keep its identity across renders. localStorage is per origin, not
// per window, so the layout the user set here is restored when the grid
// remounts in the popup - and again on the next page load.
const persist = {
  dataKey: 'react-popup-window.people.data',
  settingsKey: 'react-popup-window.people.settings',
} satisfies TMDataGridPersistence

function PeopleGrid() {
  // Resolves against the QueryClientProvider mounted in the MAIN window's
  // tree - even while the grid is rendered in the popup. The same goes for
  // the MantineProvider the grid requires.
  const { data, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['people', 12],
    queryFn: () => fetchPeople(12),
  })

  const [detailsOpen, setDetailsOpen] = useState(false)
  // Mantine's focus trap walks up from the focused element until it reaches
  // the global `document.body` - the MAIN window's. In the popup it walks past
  // the popup's own body and throws, so the trap is on only in the opener.
  const [detailsTrapFocus, setDetailsTrapFocus] = useState(true)
  const hostRef = useRef<HTMLDivElement>(null)

  // Mantine's Modal binds its Escape handler on the bare `window` - the MAIN
  // window, since popup content executes in the opener's realm. Bind our own
  // on the window this grid is actually rendered in.
  useEffect(() => {
    if (!detailsOpen) return
    const win = hostRef.current?.ownerDocument.defaultView
    if (!win) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetailsOpen(false)
    }
    win.addEventListener('keydown', onKeyDown)
    return () => win.removeEventListener('keydown', onKeyDown)
  }, [detailsOpen])

  const grid = useTMDataGrid({
    data: data ?? EMPTY,
    columns,
    getRowId: (row) => String(row.id),
    enableRowSelection: false,
    persist,
    meta: { loading: !data },
  })

  return (
    <div className="grid-host" data-testid="people-grid" ref={hostRef}>
      <SameWindowPortals>
        <div className="row grid-query-row">
          <button className="secondary" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Refetching…' : 'Refetch (TanStack Query)'}
          </button>
          <button
            className="secondary"
            onClick={() => {
              setDetailsTrapFocus(hostRef.current?.ownerDocument === document)
              setDetailsOpen(true)
            }}
            data-testid="open-details"
          >
            Dataset details
          </button>
          <span className="muted" style={{ fontSize: '0.8rem' }}>
            {dataUpdatedAt ? `updated ${new Date(dataUpdatedAt).toLocaleTimeString()}` : 'loading…'}
          </span>
        </div>
        <TMDataGrid {...grid} size="sm" style={{ flex: 1, minHeight: 0 }}>
          <TMDataGrid.Toolbar>
            <TMDataGrid.SummaryCount />
            <TMDataGrid.Spacer />
            <TMDataGrid.Menu>
              <TMDataGrid.Menu.Columns />
            </TMDataGrid.Menu>
          </TMDataGrid.Toolbar>
          <TMDataGrid.Table<Person> />
        </TMDataGrid>
        <Modal
          opened={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          trapFocus={detailsTrapFocus}
          title="Dataset details"
        >
          <p data-testid="details-body">
            12 people fetched through TanStack Query and cached under the{' '}
            <code>['people', 12]</code> key. This modal portals like any other Mantine overlay: with
            the <code>SameWindowPortals</code> wrapper it opens in the window the grid is rendered
            in, popup included.
          </p>
        </Modal>
      </SameWindowPortals>
    </div>
  )
}

export function DataTableExample() {
  const { open, close, focus, isOpen, Popup } = usePopupWindow({
    title: 'People — detached grid',
    features: { width: 720, height: 480 },
  })

  const peopleGrid = <PeopleGrid />

  return (
    <div>
      {isOpen ? (
        <div className="popup-note" data-testid="table-detached-note">
          <p>The grid is open in a separate window.</p>
          <div className="row">
            <button onClick={focus}>Focus window</button>
            <button className="secondary" onClick={close} data-testid="bring-back">
              Bring it back
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="row">
            <button onClick={open} data-testid="open-table">
              Open grid in new window
            </button>
          </div>
          {peopleGrid}
        </div>
      )}
      <Popup>
        <div className="popup-grid-panel">{peopleGrid}</div>
      </Popup>
    </div>
  )
}
