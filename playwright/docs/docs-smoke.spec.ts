import { expect, test } from "../support/test";

// Every page in turn, in one test: the console-error fixture fails it on any
// runtime error a page logs while it renders.
test("every docs page renders without errors", async ({ page }) => {
  // About 35 pages at under a second each: more than the default 30 s once
  // the other specs share the machine.
  test.setTimeout(120_000);
  await page.goto("/docs");
  const links = page.locator('a[href^="/docs/"]');
  await expect(links.first()).toBeVisible();
  const hrefs = await links.evaluateAll((anchors) => {
    return anchors.map((anchor) => anchor.getAttribute("href") ?? "");
  });
  const routes = ["/", "/playground", ...new Set(hrefs)];

  for (const route of routes) {
    await test.step(route, async () => {
      await page.goto(route);
      await expect(page.locator("main").first()).toBeVisible();
    });
  }
});

test("every heading links to itself", async ({ page }) => {
  await page.goto("/docs/columns");
  const heading = page.getByRole("heading", { level: 2, name: "The column helper" });
  const anchor = heading.getByRole("link", { name: 'Link to "The column helper"' });

  // Out of sight until the heading is hovered.
  await expect(anchor).toHaveCSS("opacity", "0");
  await heading.hover();
  await expect(anchor).toHaveCSS("opacity", "1");

  await anchor.click();
  await expect(page).toHaveURL(/\/docs\/columns#the-column-helper$/);
  await expect(heading).toBeInViewport();
});

test("search finds the section that explains a symbol", async ({ page }) => {
  await page.goto("/docs/sorting");
  await page.getByRole("button", { name: "Search the documentation" }).click();
  await page.getByPlaceholder("Search the documentation…").fill("createTMDataGridColumnHelper");
  await page.getByRole("button", { name: /^The column helper/ }).click();

  await expect(page).toHaveURL(/\/docs\/columns#the-column-helper$/);
  await expect(page.getByRole("heading", { level: 2, name: "The column helper" })).toBeInViewport();
});

test("a search hit on a reference row shows where it landed", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Search the documentation" }).click();
  await page.getByPlaceholder("Search the documentation…").fill("--dg-font-size");
  await page.getByRole("button", { name: /^--dg-font-size/ }).first().click();

  await expect(page).toHaveURL(/\/docs\/styling#ref-dg-font-size$/);
  await expect(page.locator("#ref-dg-font-size")).toBeInViewport();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveText(
    /Size, styling and theming\s*›\s*CSS variables/,
  );
  await expect(page.locator('nav a[aria-current="page"]')).toBeInViewport();
  await expect(
    page.getByRole("list", { name: "On this page" }).getByRole("link", { name: "CSS variables" }),
  ).toHaveAttribute("data-active", "true");
});
