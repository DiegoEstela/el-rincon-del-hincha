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
const NAV_ROUTES: Record<string, string> = {
  "/": "Inicio",
  "/vitrina": "Vitrina",
  "/rivales": "Rivales",
  "/comparar": "Comparar",
};

for (const route of PUBLIC_ROUTES) {
  test(`app shell on ${route}`, async ({ page }) => {
    await page.goto(route);
    const desktop = (page.viewportSize()?.width ?? 0) >= 1024;

    await expect(page.getByTestId("sidebar")).toBeVisible({ visible: desktop });
    await expect(page.getByTestId("bottom-nav")).toBeVisible({ visible: !desktop });

    // Only the rendered navigation is in the accessibility tree.
    await expect(page.getByRole("navigation", { name: "Principal" })).toHaveCount(1);

    const activeLabel = NAV_ROUTES[route];
    const current = page.locator("a[aria-current=page]:visible");
    if (activeLabel) {
      await expect(current).toHaveCount(1);
      await expect(current).toHaveText(activeLabel);
    } else {
      await expect(current).toHaveCount(0);
    }
  });
}

test.describe("breakpoint edges", () => {
  test("1024px shows the sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto("/");
    await expect(page.getByTestId("sidebar")).toBeVisible();
    await expect(page.getByTestId("bottom-nav")).toBeHidden();
  });

  test("1023px shows the bottom nav", async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 800 });
    await page.goto("/");
    await expect(page.getByTestId("sidebar")).toBeHidden();
    await expect(page.getByTestId("bottom-nav")).toBeVisible();
  });

  test("footer does not cover the sidebar nav on a short desktop screen", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 640 });
    await page.goto("/");
    const nav = await page.getByRole("navigation", { name: "Principal" }).boundingBox();
    const footer = await page.getByRole("contentinfo").boundingBox();
    expect(nav).not.toBeNull();
    expect(footer).not.toBeNull();
    expect(nav!.y + nav!.height).toBeLessThanOrEqual(footer!.y);
  });

  test("desktop content area is wide", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const box = await page.locator("#contenido > div").boundingBox();
    expect(box!.width).toBeGreaterThan(900);
  });

  test("mobile shows the active pill indicator, desktop does not", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/vitrina");
    await expect(page.getByTestId("active-indicator")).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByTestId("active-indicator")).toBeHidden();
  });
});

test("on a very short desktop screen the footer has its own background over the sidebar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 400 });
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  const bg = await footer.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe("rgba(0, 0, 0, 0)");
  const sidebar = page.getByTestId("sidebar");
  await sidebar.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  const nav = await page.getByRole("navigation", { name: "Principal" }).boundingBox();
  const box = await footer.boundingBox();
  expect(nav!.y + nav!.height).toBeLessThanOrEqual(box!.y);
});
