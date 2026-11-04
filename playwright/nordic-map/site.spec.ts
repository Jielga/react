import { readdirSync } from "node:fs";
import { expect, test } from "../support/test";

/** Every docs page of the package, by file name. Getting started is the front page. */
const pages = readdirSync(new URL("../../packages/nordic-map/docs/", import.meta.url))
  .filter((file) => file.endsWith(".md"))
  .map((file) => file.replace(/\.md$/, ""));

test("the front page renders under the shared header", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Switch package" })).toContainText("Nordic Map");
  await expect(page.getByRole("heading", { level: 1, name: "Nordic Map" })).toBeVisible();
});

for (const id of pages) {
  test(`the ${id} page renders and its maps load`, async ({ page }) => {
    await page.goto(id === "getting-started" ? "/" : `/docs/${id}`);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    // Every map on the page leaves its loader, without a load error
    await expect(page.getByRole("status", { name: "Loading map" })).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator("[data-nordic-map]").getByRole("alert")).toHaveCount(0);
  });
}

test("the playground renders", async ({ page }) => {
  await page.goto("/playground");
  await expect(page.getByRole("application", { name: "Map of Sweden" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Loading map" })).toHaveCount(0, { timeout: 15_000 });
});

test("the old demo links lead to the playground", async ({ page }) => {
  await page.goto("/#nordic-map");
  await expect(page).toHaveURL(/\/playground$/);
});
