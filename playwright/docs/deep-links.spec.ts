import type { Page } from "@playwright/test";
import { openDemoGrid } from "../support/docsSite";
import { expect, test } from "../support/test";

const target = { route: "/docs/persistence", file: "data/DeepLinks.tsx" };

type LinkPayload = {
  columnFilters?: Array<{ id: string }>;
  globalFilter?: unknown;
};

/** What the demo's `employees` param holds, or `null` without one. */
function linkPayload(page: Page): LinkPayload | null {
  const raw = new URL(page.url()).searchParams.get("employees");
  return raw === null ? null : (JSON.parse(raw) as LinkPayload);
}

const linkedFilterIds = (page: Page) =>
  linkPayload(page)?.columnFilters?.map((filter) => filter.id) ?? null;

test("a deep link opens the grid on the filter it was copied with", async ({
  page,
}) => {
  const grid = await openDemoGrid(page, target);
  await grid.expectRowCount(200);
  expect(linkPayload(page)).toBeNull();

  // Last names cycle through five values, so one of them is 40 of the 200.
  await grid.filterBy({ columnId: "lastName", value: "Holm" });
  await grid.expectRowCount(40);
  await expect.poll(() => linkedFilterIds(page)).toEqual(["lastName"]);

  // A fresh load of the copied address, as a new tab would do.
  const opened = await openDemoGrid(page, { ...target, route: page.url() });
  await opened.expectRowCount(40);
  await opened.part("filter-button").click();
  await expect(
    opened
      .part("filter-row", { columnId: "lastName" })
      .locator('[data-dg-part="filter-value"]'),
  ).toHaveValue("Holm");
});

test("a column opted out with meta.filter.url stays out of the deep link", async ({
  page,
}) => {
  const grid = await openDemoGrid(page, target);
  await grid.filterBy({ columnId: "lastName", value: "Holm" });
  await grid.expectRowCount(40);
  await expect.poll(() => linkedFilterIds(page)).toEqual(["lastName"]);

  // Locations cycle through four values, independently of the last names.
  await grid.filterBy({ columnId: "location", value: "Stockholm" });
  await grid.expectRowCount(10);
  // A search is written to the link too; once it shows up, the write that
  // followed the location filter has happened.
  await grid.search("a");
  await expect.poll(() => linkPayload(page)?.globalFilter).toBe("a");
  expect(linkedFilterIds(page)).toEqual(["lastName"]);
});
