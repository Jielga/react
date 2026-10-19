---
"@jielga/tmdatagrid": minor
---

- A body row takes the hover tint only when the row itself answers a click or a right-click: `selectionMode: "row"` or a highlight mode, `onRowClick`, or `renderRowContextMenu`. Group rows never do. Before, every row took it.
- `highlightOnHover` on the Table forces the tint on or off for every row.
- Rows carry `data-highlight-on-hover="true"` while the tint applies.
