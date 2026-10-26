---
"@jielga/tmdatagrid": minor
---

- New `meta.edit.mapCommitValue`: maps each field the user changed once, as its row commits, instead of on every keystroke like `mapValue`. It runs before the submit validators and writes the result back into the form, so the draft store, `changes` and `onCommit` hold the mapped value. Use it to trim a string the user was free to type spaces into.
- New types `TMDataGridEditCommitMap` and `TMDataGridEditCommitMapArgs`.
