---
"@jielga/tmdatagrid": minor
---

`sortMode: "frozen"` sorts once, when the sort is applied, and holds the order through edits, refetches and filter changes until the user sorts again. It requires `getRowId`.
A ↻ button on the sorted header and a Sort again item in its column menu re-sort on the current values; `sortAgain()` and `sortStale` are on the hook's return value.
New labels `sortAgain` and `sortAgainHint`.
