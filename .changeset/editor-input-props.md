---
"@jielga/tmdatagrid": minor
---

The six built-in editors take `inputProps`, passed to their Mantine control, so a `meta.edit.editor` can extend a built-in (a `leftSection`, a unit, `comboboxProps`) instead of copying it.
Their props types are exported: `TMDataGridStringEditorProps`, `TMDataGridNumberEditorProps`, `TMDataGridBooleanEditorProps`, `TMDataGridDateEditorProps`, `TMDataGridSelectEditorProps`, `TMDataGridMultiSelectEditorProps`.
