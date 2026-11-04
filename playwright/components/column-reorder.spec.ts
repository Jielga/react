import type { Locator } from "@playwright/test";
import { expect, test } from "../support/test";

/** Column ids in the order their headers are rendered, left lane first. */
function headerOrder(root: Locator): Promise<Array<string>> {
  return root
    .locator('[data-dg-part="header"]')
    .evaluateAll((cells) =>
      cells.map((cell) => cell.getAttribute("data-column-id") ?? ""),
    );
}

function headerOf(root: Locator, columnId: string): Locator {
  return root.locator(
    `[data-dg-part="header"][data-column-id="${columnId}"]`,
  );
}

async function leftHalf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("The header is not rendered.");
  return { x: box.width / 4, y: box.height / 2 };
}

test("moves a column by dragging its header onto another", async ({
  mount,
}) => {
  const component = await mount("Grid/Default");
  // The generated checkbox lane leads; it is pinned and never moves.
  await expect.poll(() => headerOrder(component)).toEqual([
    "__select__",
    "id",
    "name",
    "age",
    "city",
  ]);

  const target = headerOf(component, "name");
  await headerOf(component, "city").dragTo(target, {
    targetPosition: await leftHalf(target),
  });

  await expect.poll(() => headerOrder(component)).toEqual([
    "__select__",
    "id",
    "city",
    "name",
    "age",
  ]);
});

test("keeps a move inside its pinning lane", async ({ mount }) => {
  const component = await mount("Grid/Pinned");
  const before = await headerOrder(component);
  expect(before.slice(0, 3)).toEqual(["__select__", "id", "name"]);

  const target = headerOf(component, "id");
  await headerOf(component, "name").dragTo(target, {
    targetPosition: await leftHalf(target),
  });

  // Read once rather than polled: the drop has run by the time `dragTo`
  // resolves, and polling for "unchanged" would pass before it did.
  expect(await headerOrder(component)).toEqual(before);
});
