import { Text } from "@mantine/core";
import { IconBarcode } from "@tabler/icons-react";
import { useCallback, useState } from "react";
import {
  createTMDataGridColumnHelper,
  TMDataGrid,
  TMDataGridNumberEditor,
  TMDataGridSelectEditor,
  TMDataGridStringEditor,
  useTMDataGrid,
  type TMDataGridEditCommitArgs,
  type TMDataGridEditorComponent,
} from "@jielga/tmdatagrid";

type Product = {
  id: number;
  sku: string;
  price: number;
  category: string;
};

const PRODUCTS: Array<Product> = [
  { id: 1, sku: "KB-2041", price: 449, category: "Keyboards" },
  { id: 2, sku: "MS-0817", price: 299, category: "Mice" },
  { id: 3, sku: "HS-3302", price: 1290, category: "Headsets" },
  { id: 4, sku: "MN-2710", price: 3490, category: "Monitors" },
];

// Module scope: a new editor identity per render remounts it mid-edit.
const SkuEditor: TMDataGridEditorComponent = (args) => (
  <TMDataGridStringEditor
    {...args}
    inputProps={{ leftSection: <IconBarcode size={14} /> }}
  />
);

const PriceEditor: TMDataGridEditorComponent = (args) => (
  <TMDataGridNumberEditor
    {...args}
    inputProps={{
      allowNegative: false,
      rightSectionWidth: 36,
      rightSection: (
        <Text size="xs" c="dimmed">
          kr
        </Text>
      ),
    }}
  />
);

const CategoryEditor: TMDataGridEditorComponent = (args) => (
  <TMDataGridSelectEditor
    {...args}
    inputProps={{
      comboboxProps: { shadow: "md" },
      nothingFoundMessage: "No such category",
    }}
  />
);

const columnHelper = createTMDataGridColumnHelper<Product>();

const columns = columnHelper.columns([
  columnHelper.accessor("sku", {
    header: "SKU",
    minSize: 140,
    meta: { edit: { editor: SkuEditor } },
  }),
  columnHelper.accessor("price", {
    header: "Price",
    minSize: 120,
    meta: { type: "number", align: "right", edit: { editor: PriceEditor } },
  }),
  columnHelper.accessor("category", {
    header: "Category",
    minSize: 140,
    meta: {
      type: "select",
      options: ["Keyboards", "Mice", "Headsets", "Monitors", "Cables"],
      edit: { editor: CategoryEditor },
    },
  }),
]);

export function ExtendedEditors() {
  const [products, setProducts] = useState(PRODUCTS);

  const onCommit = useCallback(
    ({ rowId, value }: TMDataGridEditCommitArgs<Product>) => {
      setProducts((previous) =>
        previous.map((product) =>
          String(product.id) === rowId ? value : product,
        ),
      );
    },
    [],
  );

  const grid = useTMDataGrid({
    data: products,
    columns,
    getRowId: (row) => String(row.id),
    editing: { mode: "cell", onCommit },
    selectionMode: "highlight",
  });

  return (
    <TMDataGrid {...grid} style={{ flex: 1, minHeight: 0 }}>
      <TMDataGrid.Table<Product> />
    </TMDataGrid>
  );
}
