import { describe, expect, expectTypeOf, it } from "vitest";
import type { Row } from "@tanstack/react-table";
import {
  createTMDataGridColumnHelper,
  type TMDataGridFeatures,
} from "./useTMDataGrid";

/**
 * Compile-time contracts for the row-typed meta callbacks. `tsc` is the
 * assertion: an `@ts-expect-error` with nothing to swallow fails the build.
 */

type Person = { id: number; name: string; country: string; locked: boolean };

const helper = createTMDataGridColumnHelper<Person>();

const columns = helper.columns([
  helper.accessor("name", {
    header: "Name",
    meta: {
      edit: {
        enabled: (row) => {
          expectTypeOf(row).toEqualTypeOf<Row<TMDataGridFeatures, Person>>();
          return !row.original.locked;
        },
      },
    },
  }),
  helper.accessor("country", {
    header: "Country",
    meta: {
      type: "select",
      options: ({ row }) => {
        expectTypeOf(row?.original).toEqualTypeOf<Person | undefined>();
        return row ? [row.original.country] : [];
      },
    },
  }),
  helper.accessor((row) => row.id * 2, {
    id: "double",
    meta: {
      // @ts-expect-error - Person has no `missing` field.
      edit: { enabled: (row) => row.original.missing === 1 },
    },
  }),
  helper.display({
    id: "actions",
    meta: { edit: { enabled: (row) => row.original.id > 0 } },
  }),
]);

describe("createTMDataGridColumnHelper", () => {
  it("builds the same column definitions as TanStack's helper", () => {
    expect(columns.map((column) => column.id ?? column.header)).toEqual([
      "Name",
      "Country",
      "double",
      "actions",
    ]);
  });
});
