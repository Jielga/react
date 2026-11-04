import { Badge } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  useTMDataGrid,
} from '@jielga/tmdatagrid'
import { useEffect, useMemo, useState } from 'react'
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels'
import { usePopupWindow } from '@jielga/react-popup-window'
import { fetchPeople, ROLES } from './people'
import type { Person } from './people'
import { SameWindowPortals } from './SameWindowPortals'

const columnHelper = createTMDataGridColumnHelper<Person>()

const columns = columnHelper.columns([
  columnHelper.accessor('name', { header: 'Name', minSize: 150, meta: { flex: 1.3 } }),
  columnHelper.accessor('role', { header: 'Role', minSize: 100 }),
  columnHelper.accessor('city', { header: 'City', minSize: 110 }),
  columnHelper.accessor('salary', {
    header: 'Salary',
    minSize: 110,
    meta: { type: 'number', align: 'right' },
    cell: (info) => `${info.getValue().toLocaleString('sv-SE')} kr`,
  }),
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

interface Filters {
  search: string
  role: string
  onlyActive: boolean
}

function FiltersForm({
  filters,
  onChange,
}: {
  filters: Filters
  onChange: (filters: Filters) => void
}) {
  return (
    <form className="filters-form" onSubmit={(e) => e.preventDefault()}>
      <h4>Query</h4>
      <label>
        Search
        <input
          type="text"
          placeholder="name or city…"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          data-testid="filter-search"
        />
      </label>
      <label>
        Role
        <select
          value={filters.role}
          onChange={(e) => onChange({ ...filters, role: e.target.value })}
          data-testid="filter-role"
        >
          <option value="all">All roles</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </label>
      <label className="filters-checkbox">
        <input
          type="checkbox"
          checked={filters.onlyActive}
          onChange={(e) => onChange({ ...filters, onlyActive: e.target.checked })}
          data-testid="filter-active"
        />
        Only active
      </label>
      <p className="muted" style={{ fontSize: '0.78rem' }}>
        These filters run in the main window and pre-filter the grid data. The grid's own column
        filters, sorting and selection apply on top.
      </p>
    </form>
  )
}

function ResultsGrid({ filters }: { filters: Filters }) {
  const { data } = useQuery({ queryKey: ['people', 400], queryFn: () => fetchPeople(400) })

  const rows = useMemo(() => {
    const needle = filters.search.trim().toLowerCase()
    return (data ?? EMPTY).filter(
      (row) =>
        (!needle ||
          row.name.toLowerCase().includes(needle) ||
          row.city.toLowerCase().includes(needle)) &&
        (filters.role === 'all' || row.role === filters.role) &&
        (!filters.onlyActive || row.status === 'active'),
    )
  }, [data, filters])

  // Virtualized (always), sortable, resizable, reorderable and pinnable
  // columns, column filters, checkbox row selection, and a drag-selectable
  // cell range with Ctrl+C / CSV export.
  const grid = useTMDataGrid({
    data: rows,
    columns,
    getRowId: (row) => String(row.id),
    cellSelection: 'range',
    meta: { loading: !data },
  })

  return (
    <SameWindowPortals>
      <TMDataGrid {...grid} size="sm" style={{ flex: 1, minHeight: 0 }}>
        <TMDataGrid.Toolbar>
          <TMDataGrid.SummaryCount />
          <TMDataGrid.Spacer />
          <TMDataGrid.FilterButton />
          <TMDataGrid.Menu>
            <TMDataGrid.Menu.Columns />
          </TMDataGrid.Menu>
        </TMDataGrid.Toolbar>
        <TMDataGrid.Table<Person> />
      </TMDataGrid>
    </SameWindowPortals>
  )
}

export function PanelsExample() {
  const [filters, setFilters] = useState<Filters>({ search: '', role: 'all', onlyActive: false })
  const resultsPanelRef = usePanelRef()

  const { open, close, focus, isOpen, Popup } = usePopupWindow({
    title: 'Search results',
    // An empty page served by this site, so the popup's address bar shows the
    // site's URL instead of about:blank.
    url: `${import.meta.env.BASE_URL}popup.html`,
    features: { width: 860, height: 560 },
  })

  // Collapse the results panel to a narrow control strip while its content
  // lives in the popup; expand it again when the popup closes (via the strip
  // button OR the user closing the window by hand — isOpen tracks both).
  useEffect(() => {
    const panel = resultsPanelRef.current
    if (!panel) return
    if (isOpen) panel.collapse()
    else panel.expand()
  }, [isOpen, resultsPanelRef])

  // One element, two possible homes: inline in the right panel, or in the
  // popup. The filter state lives here in the main window either way.
  const results = <ResultsGrid filters={filters} />

  return (
    <div>
      {/* The Group sizes itself to 100% of its parent — give it a frame. */}
      <div className="panels-frame">
        <Group orientation="horizontal" className="panels-group">
          <Panel defaultSize="30%" minSize="220px" className="panel-side panel-filters">
            <FiltersForm filters={filters} onChange={setFilters} />
          </Panel>
          <Separator className="panel-separator" />
          <Panel
            panelRef={resultsPanelRef}
            collapsible
            collapsedSize="56px"
            minSize="30%"
            className="panel-side panel-results"
          >
            {isOpen ? (
              <div className="panel-strip" data-testid="panel-strip">
                <button title="Focus the window" aria-label="Focus the window" onClick={focus}>
                  ⧉
                </button>
                <button
                  className="secondary"
                  title="Bring the results back"
                  aria-label="Bring the results back"
                  onClick={close}
                  data-testid="panel-bring-back"
                >
                  ✕
                </button>
                <span className="panel-strip-label">Results in separate window</span>
              </div>
            ) : (
              <div className="panel-results-inner" data-testid="results-host">
                <div className="row panel-results-header">
                  <h4>Results</h4>
                  <button className="secondary" onClick={open} data-testid="open-results">
                    Open in new window ↗
                  </button>
                </div>
                {results}
              </div>
            )}
          </Panel>
        </Group>
      </div>
      <Popup>
        <div className="popup-grid-panel">{results}</div>
      </Popup>
    </div>
  )
}
