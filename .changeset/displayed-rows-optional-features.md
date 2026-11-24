---
"@jielga/tmdatagrid": minor
---

`getDisplayedRows` and `isPagingActive` take `features` as an optional second argument. Without it they use the flags the grid last rendered with, so a cell can call `getDisplayedRows(row.table)`.
