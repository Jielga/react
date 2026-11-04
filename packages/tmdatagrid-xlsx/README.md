# @jielga/tmdatagrid-xlsx

Excel (xlsx) export format for [@jielga/tmdatagrid](https://www.npmjs.com/package/@jielga/tmdatagrid), on [exceljs](https://www.npmjs.com/package/exceljs).

- Documentation: <https://jielga.github.io/react/tmdatagrid/docs/xlsx>
- Source, issues and the contributor guide: <https://github.com/Jielga/react>

```sh
bun add @jielga/tmdatagrid-xlsx
```

```sh
npm install @jielga/tmdatagrid-xlsx
```

`xlsxFormat()` is a `TMDataGridExportFormat`, so it goes wherever the grid takes one:

```tsx
import { useTMDataGrid } from "@jielga/tmdatagrid";
import { xlsxFormat } from "@jielga/tmdatagrid-xlsx";

const grid = useTMDataGrid({
  data,
  columns,
  exportOptions: { format: xlsxFormat() },
});
```

Numbers, dates and booleans arrive as typed cells, so nothing depends on the reader's locale.

See [docs/xlsx.md](docs/xlsx.md) for the options and the cell typing.
