---
"@jielga/tmdatagrid": minor
---

`meta.colSpan` makes a column's cell cover the columns to its right, as one cell. A number, or a function of `{ row, table }` to decide per row - for example a title across an open row: `colSpan: ({ row }) => (row.getIsExpanded() ? Infinity : 1)`. A span stops at the last user column and at the pinned block's edge, and group rows ignore it. `TMDataGridColSpanArgs` is exported.
