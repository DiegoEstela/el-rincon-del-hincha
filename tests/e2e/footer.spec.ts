import { expect, test } from "@playwright/test";

const PUBLIC_ROUTES = [
  "/",
  "/vitrina",
  "/rivales",
  "/comparar",
  "/acerca",
  "/privacidad",
  "/changelog",
];

for (const route of PUBLIC_ROUTES) {
  test(`footer shows credits and version on ${route}`, async ({ page }, testInfo) => {
    await page.goto(route);
    const footer = page.getByRole("contentinfo");
    await expect(footer).toHaveCount(1);
    await expect(footer).toBeVisible();
    await expect(page.getByTestId("app-version")).toHaveCount(1);

    await expect(footer).toContainText("Creada por Diego Estela Lopez");
    await expect(footer).toContainText("Idea original de Juan Farre");
    await expect(page.getByTestId("app-version")).toHaveText(/^v\d+\.\d+\.\d+ · \S+$/);
    await expect(page.getByTestId("app-version")).toHaveAttribute("href", "/changelog");

    const name = route === "/" ? "home" : route.slice(1);
    const base = `test-results/screens/${testInfo.project.name}-${name}`;
    await page.screenshot({ path: `${base}-top.png` });
    await footer.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.screenshot({ path: `${base}-bottom.png` });
  });
}
