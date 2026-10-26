# @jielga/tmdatagrid-xlsx

## 2.5.0

## 2.4.0

## 2.3.0

## 2.2.0

## 2.1.4

### Patch Changes

- [#154](https://github.com/Jielga/react/pull/154) [`3b42249`](https://github.com/Jielga/react/commit/3b42249fd9fd6c0b3fb79b49c448aed5a3109444) Thanks [@Psvensso](https://github.com/Psvensso)! - The documentation moved to <https://jielga.github.io/react/tmdatagrid/>. Links to the old address redirect there.

## 2.1.3

## 2.1.2

## 2.1.1

## 2.1.0

## 2.0.1

### Patch Changes

- Updated dependencies [[`465cc39`](https://github.com/Jielga/TMDataGrid/commit/465cc39190441c6931d65ea460386cc87abbd5df)]:
  - @jielga/tmdatagrid@2.0.1

## 2.0.0

### Minor Changes

- [#70](https://github.com/Jielga/TMDataGrid/pull/70) [`007c308`](https://github.com/Jielga/TMDataGrid/commit/007c30871d2000aa4cc35ec083ef518ba86f57df) Thanks [@Psvensso](https://github.com/Psvensso)! - Export.

  - `TMDataGrid.Menu.Export` and `TMDataGrid.Menu.ExportSelected` - menu items downloading every filtered row, or the selected rows in grid order, in the grid's format. Props override the format, file name, headers and label per item.
  - `useTMDataGridExport` - the export as click handlers (`exportAll`, `exportSelected`, `selectedCount`, `canExportSelected`) for a control of your own.
  - `exportGrid`, `buildExportData`, `writeExportFile` - the same export from outside a component.
  - Formats: `csvExcelFormat` (the default, as before), `csvFormat`, `tsvFormat`, `jsonFormat`; `TMDataGridExportFormat` for one of your own.
  - `exportOptions` on `useTMDataGrid` - format, file name, header row and `columns` (`"visible"`, `"all"` or ids) for every export, the cell-range menu included.
  - `columns="custom"` on the menu items opens a column picker: every exportable column, the visible ones ticked and the hidden ones marked, select all with a count, a search box from six columns, Export and Cancel. `ui.state.exportPicker`, `ui.actions.openExportPicker` / `closeExportPicker`, `getExportableColumns`.
  - Column meta `enableExport` and `exportValue`.
  - The text formats prefix a value that a spreadsheet would run as a formula; `escapeFormulas: false` on the format turns it off.
  - `data-dg-part`: `menu-export`, `menu-export-selected`, `export-picker`, `export-picker-hint`, `export-picker-search`, `export-column`, `export-column-all`, `export-picker-count`, `export-picker-confirm`, `export-picker-cancel`.
  - Labels: `exportAll`, `exportSelected(count)`, `exportPickerTitle(format)`, `exportPickerHint(selected)`, `exportPickerConfirm`, `exportPickerCancel`, `exportPickerSelectAll`, `exportPickerCount(checked, total)`, `exportPickerHidden`, `exportCells` (the cell-range item, was `exportCsv`).
  - Deprecated, removed in the next beta: `cellExport` on `TMDataGrid.Table`, `exportGridToCsv`, `TMDataGridCellExportOptions`, `DEFAULT_CELL_EXPORT_OPTIONS`, `buildCellMatrix`, `buildGridCellMatrix`, `TMDataGridCellMatrix`, `toExcelCsv`, `downloadTextFile`, `labels.exportCsv`.
  - New package `@jielga/tmdatagrid-xlsx`: `xlsxFormat()` writes an Excel workbook with typed cells, on exceljs.

### Patch Changes

- Updated dependencies [[`238470c`](https://github.com/Jielga/TMDataGrid/commit/238470cf675000207b0061d760c93b2bee08a27f), [`e36c7c7`](https://github.com/Jielga/TMDataGrid/commit/e36c7c7a39a1f0227ea3b248cdc131f1837bdf05), [`feba241`](https://github.com/Jielga/TMDataGrid/commit/feba241aacb4fc1f5024dd5c5c309e815a337676), [`e71f679`](https://github.com/Jielga/TMDataGrid/commit/e71f6799351ffd82f1138cff84b93e2b11671766), [`1aee8da`](https://github.com/Jielga/TMDataGrid/commit/1aee8da22bfe7683a60f929f274fc4f26b5f3f1e), [`c662c8a`](https://github.com/Jielga/TMDataGrid/commit/c662c8a36e97bea7e47f58dea437555d1690df3f), [`e1f413a`](https://github.com/Jielga/TMDataGrid/commit/e1f413ae0b71cda4bc16b5ddaa96cc071b312294), [`a95b8c3`](https://github.com/Jielga/TMDataGrid/commit/a95b8c3d21c561d78082d0004969dffc7059f4c9), [`f353e0d`](https://github.com/Jielga/TMDataGrid/commit/f353e0d070f92e76e72866784e9541869b2641c0), [`6720246`](https://github.com/Jielga/TMDataGrid/commit/672024616e36496026704c1ea3113e5a1c08aba3), [`de9e8c1`](https://github.com/Jielga/TMDataGrid/commit/de9e8c11339e096170280b69ef9724657622eef7), [`b680b1c`](https://github.com/Jielga/TMDataGrid/commit/b680b1ce1a1682fa96500d13192974b64da966df), [`713d8fa`](https://github.com/Jielga/TMDataGrid/commit/713d8fa075d3c64b171e2b5dcfd9467bf5e68781), [`795b964`](https://github.com/Jielga/TMDataGrid/commit/795b964953f514a4e7d0cfd0fd98bb450479be3a), [`b6e2876`](https://github.com/Jielga/TMDataGrid/commit/b6e287645a1f89e2cb981551e263c9939950ffea), [`dc3aac9`](https://github.com/Jielga/TMDataGrid/commit/dc3aac9816e0f03be4a1ade1062fbc4412faecca), [`8cabb3d`](https://github.com/Jielga/TMDataGrid/commit/8cabb3d526e68343b2438dffa164294288e83f5e), [`d989de1`](https://github.com/Jielga/TMDataGrid/commit/d989de19e32435d2639c54c503a058d6f0ca1348), [`60f8292`](https://github.com/Jielga/TMDataGrid/commit/60f8292f3538594ad667339ed8f815192148a0c9), [`5497b65`](https://github.com/Jielga/TMDataGrid/commit/5497b650196b265e4234568301009c435d367dbc), [`007c308`](https://github.com/Jielga/TMDataGrid/commit/007c30871d2000aa4cc35ec083ef518ba86f57df), [`8f69bef`](https://github.com/Jielga/TMDataGrid/commit/8f69befdb06b3c1c09be9b2150a471d84e00e06e), [`fe68bb6`](https://github.com/Jielga/TMDataGrid/commit/fe68bb67ef28883c8a11880e902882adf068fc25), [`f2d4fae`](https://github.com/Jielga/TMDataGrid/commit/f2d4faea1308b6916dfb484c7b3fb227238cb6b3), [`401dde9`](https://github.com/Jielga/TMDataGrid/commit/401dde9b4a0b83953409b160d3cd6f16f288cd2b), [`19e21e4`](https://github.com/Jielga/TMDataGrid/commit/19e21e4596c693264af0063870e768f94f06b2c6), [`36657fd`](https://github.com/Jielga/TMDataGrid/commit/36657fd69fc95af64938fa39e5a8e52f7d222c4c), [`3f17285`](https://github.com/Jielga/TMDataGrid/commit/3f17285e313333f0b383dec4f5a6e2a49f192e9a), [`3e0c861`](https://github.com/Jielga/TMDataGrid/commit/3e0c8618d5bf428e737f10a2220a3d402b1360e0), [`acc190b`](https://github.com/Jielga/TMDataGrid/commit/acc190b169792f36e673453c3440c62071fe55e9), [`001dd75`](https://github.com/Jielga/TMDataGrid/commit/001dd753a815f023dea65544d2af42f3255e55d9), [`f94f2a6`](https://github.com/Jielga/TMDataGrid/commit/f94f2a613bc28a83e92967b769ee545df2b9efc9), [`acd8b0c`](https://github.com/Jielga/TMDataGrid/commit/acd8b0cdc1adfd8682f16d07a488a5375826a2d0), [`0c5b921`](https://github.com/Jielga/TMDataGrid/commit/0c5b92175e6753b2ede924eb3348a23d0cdfe9ae), [`5717fae`](https://github.com/Jielga/TMDataGrid/commit/5717fae9f5aac22f587f02780f5b77a8535abb61), [`0651ba6`](https://github.com/Jielga/TMDataGrid/commit/0651ba69dc954e2976f300094fc95055e8e61c94), [`2e107ad`](https://github.com/Jielga/TMDataGrid/commit/2e107ad29899c89d3e3d26253b3b262d3345cd07), [`482db6c`](https://github.com/Jielga/TMDataGrid/commit/482db6c9ac93652333df89732d2c9e0232dc6cb3), [`aa3aeac`](https://github.com/Jielga/TMDataGrid/commit/aa3aeac4b84fafed7b95072cccfb4f056741699d), [`1dbfbd1`](https://github.com/Jielga/TMDataGrid/commit/1dbfbd1b8047dd6a5b5d246b4b7bbde1e03417f3), [`2a7c318`](https://github.com/Jielga/TMDataGrid/commit/2a7c3189afd73658bf2442e59bdcc348c79a0268), [`1b375bb`](https://github.com/Jielga/TMDataGrid/commit/1b375bb782b97c32f9d31ab4f666f4cb33e1343c), [`cd5839d`](https://github.com/Jielga/TMDataGrid/commit/cd5839d0eb0e35c704173b29d8d3dc91631c20f2), [`7fbb5d6`](https://github.com/Jielga/TMDataGrid/commit/7fbb5d6d9961e03dd5ea9e0d67c392d84e41b0fb), [`8e20062`](https://github.com/Jielga/TMDataGrid/commit/8e20062936bf86cb8068548189b99e94c2546c70), [`7e472b1`](https://github.com/Jielga/TMDataGrid/commit/7e472b1b72635e416cb849364f35854047fb9db0), [`7b9f309`](https://github.com/Jielga/TMDataGrid/commit/7b9f309276d284d716e47fefbe0c0f543e7b738c), [`77b0819`](https://github.com/Jielga/TMDataGrid/commit/77b0819640f2f99e8a203ea4ad173a46c6459171), [`8932623`](https://github.com/Jielga/TMDataGrid/commit/893262395c89904d3603d73d6c0cafaf699a5ea5), [`d2741a6`](https://github.com/Jielga/TMDataGrid/commit/d2741a64252547cebce069f53299173118cd99f0), [`f2a5c6d`](https://github.com/Jielga/TMDataGrid/commit/f2a5c6d92c39c485def0dd59c39c5611390d1429), [`2e57099`](https://github.com/Jielga/TMDataGrid/commit/2e570991b9922bf84ac89e1090249ae359c4571e), [`9425688`](https://github.com/Jielga/TMDataGrid/commit/9425688b76a34cdf3cca78715062a3e79630876d), [`b2110d4`](https://github.com/Jielga/TMDataGrid/commit/b2110d4a6b30e788b33755d4ce9e64847a920817), [`849bfa3`](https://github.com/Jielga/TMDataGrid/commit/849bfa3f1cdc2bd207e9e307ee9f68cc4b38a776)]:
  - @jielga/tmdatagrid@2.0.0

## 2.0.0-beta.25

### Patch Changes

- Updated dependencies [[`5717fae`](https://github.com/Jielga/TMDataGrid/commit/5717fae9f5aac22f587f02780f5b77a8535abb61)]:
  - @jielga/tmdatagrid@2.0.0-beta.25

## 2.0.0-beta.24

### Patch Changes

- Updated dependencies [[`8e20062`](https://github.com/Jielga/TMDataGrid/commit/8e20062936bf86cb8068548189b99e94c2546c70)]:
  - @jielga/tmdatagrid@2.0.0-beta.24

## 2.0.0-beta.23

### Patch Changes

- Updated dependencies [[`8932623`](https://github.com/Jielga/TMDataGrid/commit/893262395c89904d3603d73d6c0cafaf699a5ea5)]:
  - @jielga/tmdatagrid@2.0.0-beta.23

## 2.0.0-beta.22

### Patch Changes

- Updated dependencies [[`5497b65`](https://github.com/Jielga/TMDataGrid/commit/5497b650196b265e4234568301009c435d367dbc)]:
  - @jielga/tmdatagrid@2.0.0-beta.22

## 2.0.0-beta.21

### Patch Changes

- Updated dependencies [[`713d8fa`](https://github.com/Jielga/TMDataGrid/commit/713d8fa075d3c64b171e2b5dcfd9467bf5e68781)]:
  - @jielga/tmdatagrid@2.0.0-beta.21

## 2.0.0-beta.20

### Patch Changes

- Updated dependencies [[`795b964`](https://github.com/Jielga/TMDataGrid/commit/795b964953f514a4e7d0cfd0fd98bb450479be3a)]:
  - @jielga/tmdatagrid@2.0.0-beta.20

## 2.0.0-beta.19

### Patch Changes

- Updated dependencies [[`2a7c318`](https://github.com/Jielga/TMDataGrid/commit/2a7c3189afd73658bf2442e59bdcc348c79a0268)]:
  - @jielga/tmdatagrid@2.0.0-beta.19

## 2.0.0-beta.18

### Patch Changes

- Updated dependencies [[`f353e0d`](https://github.com/Jielga/TMDataGrid/commit/f353e0d070f92e76e72866784e9541869b2641c0)]:
  - @jielga/tmdatagrid@2.0.0-beta.18

## 2.0.0-beta.17

### Patch Changes

- Updated dependencies [[`f2d4fae`](https://github.com/Jielga/TMDataGrid/commit/f2d4faea1308b6916dfb484c7b3fb227238cb6b3)]:
  - @jielga/tmdatagrid@2.0.0-beta.17

## 2.0.0-beta.16

### Minor Changes

- [#70](https://github.com/Jielga/TMDataGrid/pull/70) [`007c308`](https://github.com/Jielga/TMDataGrid/commit/007c30871d2000aa4cc35ec083ef518ba86f57df) Thanks [@Psvensso](https://github.com/Psvensso)! - Export.

  - `TMDataGrid.Menu.Export` and `TMDataGrid.Menu.ExportSelected` - menu items downloading every filtered row, or the selected rows in grid order, in the grid's format. Props override the format, file name, headers and label per item.
  - `useTMDataGridExport` - the export as click handlers (`exportAll`, `exportSelected`, `selectedCount`, `canExportSelected`) for a control of your own.
  - `exportGrid`, `buildExportData`, `writeExportFile` - the same export from outside a component.
  - Formats: `csvExcelFormat` (the default, as before), `csvFormat`, `tsvFormat`, `jsonFormat`; `TMDataGridExportFormat` for one of your own.
  - `exportOptions` on `useTMDataGrid` - format, file name, header row and `columns` (`"visible"`, `"all"` or ids) for every export, the cell-range menu included.
  - `columns="custom"` on the menu items opens a column picker: every exportable column, the visible ones ticked and the hidden ones marked, select all with a count, a search box from six columns, Export and Cancel. `ui.state.exportPicker`, `ui.actions.openExportPicker` / `closeExportPicker`, `getExportableColumns`.
  - Column meta `enableExport` and `exportValue`.
  - The text formats prefix a value that a spreadsheet would run as a formula; `escapeFormulas: false` on the format turns it off.
  - `data-dg-part`: `menu-export`, `menu-export-selected`, `export-picker`, `export-picker-hint`, `export-picker-search`, `export-column`, `export-column-all`, `export-picker-count`, `export-picker-confirm`, `export-picker-cancel`.
  - Labels: `exportAll`, `exportSelected(count)`, `exportPickerTitle(format)`, `exportPickerHint(selected)`, `exportPickerConfirm`, `exportPickerCancel`, `exportPickerSelectAll`, `exportPickerCount(checked, total)`, `exportPickerHidden`, `exportCells` (the cell-range item, was `exportCsv`).
  - Deprecated, removed in the next beta: `cellExport` on `TMDataGrid.Table`, `exportGridToCsv`, `TMDataGridCellExportOptions`, `DEFAULT_CELL_EXPORT_OPTIONS`, `buildCellMatrix`, `buildGridCellMatrix`, `TMDataGridCellMatrix`, `toExcelCsv`, `downloadTextFile`, `labels.exportCsv`.
  - New package `@jielga/tmdatagrid-xlsx`: `xlsxFormat()` writes an Excel workbook with typed cells, on exceljs.

### Patch Changes

- Updated dependencies [[`a95b8c3`](https://github.com/Jielga/TMDataGrid/commit/a95b8c3d21c561d78082d0004969dffc7059f4c9), [`60f8292`](https://github.com/Jielga/TMDataGrid/commit/60f8292f3538594ad667339ed8f815192148a0c9), [`007c308`](https://github.com/Jielga/TMDataGrid/commit/007c30871d2000aa4cc35ec083ef518ba86f57df), [`2e107ad`](https://github.com/Jielga/TMDataGrid/commit/2e107ad29899c89d3e3d26253b3b262d3345cd07), [`77b0819`](https://github.com/Jielga/TMDataGrid/commit/77b0819640f2f99e8a203ea4ad173a46c6459171)]:
  - @jielga/tmdatagrid@2.0.0-beta.16
