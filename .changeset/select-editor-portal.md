---
"@jielga/tmdatagrid": patch
---

The select and multi-select editors render their dropdown in a portal, so a short grid or a low row no longer clips it. Their `inputProps.comboboxProps` accepts `withinPortal` again.
