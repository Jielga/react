import { readFileSync } from "node:fs";
import { expect, test } from "../support/test";

const { sites } = JSON.parse(
  readFileSync(
    new URL("../../apps/docs-shell/sites.json", import.meta.url),
    "utf8",
  ),
) as { sites: Array<{ slug: string; title: string; packages: Array<string> }> };

test("the index page links every package site", async ({ page }) => {
  await page.goto("/");
  for (const site of sites) {
    await expect(
      page.getByRole("main").getByRole("link", { name: site.title, exact: true }),
    ).toHaveAttribute("href", `https://jielga.github.io/react/${site.slug}/`);
  }
});

test("the package menu reaches every site", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Switch package" }).click();
  const menu = page.getByRole("menu");
  for (const site of sites) {
    await expect(
      menu.getByRole("menuitem", { name: new RegExp(site.title) }),
    ).toHaveAttribute("href", `https://jielga.github.io/react/${site.slug}/`);
  }
});
