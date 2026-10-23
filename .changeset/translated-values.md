---
"@jielga/tmdatagrid": minor
---

- Filter pills and group rows write values in the configured language: a boolean as `labels.booleanTrue` / `booleanFalse` instead of `true` / `false`, and a value with an option as the option's label instead of its value.
- A group row of a `Date` column shows the date instead of an English timestamp, and a group of `null` values shows `labels.blankGroupValue` instead of "null".
- `formatFilterLabel` takes `options` and `labels`, and `formatGroupValue` takes a third argument `{ type, options, labels }`, for the same text.
- The header filter cell of a column that cannot filter, the generated lanes included, is no longer named "Filter on …".
