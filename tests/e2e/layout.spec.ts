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
const INFO_ROUTES = ["/acerca", "/privacidad"];
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
    } else if (desktop && INFO_ROUTES.includes(route)) {
      // The desktop sidebar marks the info link; on mobile the sheet is closed (hidden).
      await expect(current).toHaveCount(1);
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

for (const height of [640, 400]) {
  test(`short desktop screen (1024x${height}): nothing ends under the footer`, async ({ page }) => {
    await page.setViewportSize({ width: 1024, height });
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    const bg = await footer.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    await page.getByTestId("sidebar").evaluate((el) => el.scrollTo(0, el.scrollHeight));
    const info = await page.getByRole("navigation", { name: "Información" }).boundingBox();
    const box = await footer.boundingBox();
    expect(info!.y + info!.height).toBeLessThanOrEqual(box!.y);
  });
}

test.describe("floating desktop panel", () => {
  for (const width of [1280, 1024]) {
    test(`sidebar floats with margin, radius and shadow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      const sidebar = page.getByTestId("sidebar");
      const box = (await sidebar.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(8);
      expect(box.y).toBeGreaterThanOrEqual(8);
      expect(800 - (box.y + box.height)).toBeGreaterThanOrEqual(8);
      const style = await sidebar.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { radius: parseFloat(cs.borderTopLeftRadius), shadow: cs.boxShadow };
      });
      expect(style.radius).toBeGreaterThanOrEqual(16);
      expect(style.shadow).not.toBe("none");

      // The single footer sits in the bottom box of the panel.
      const footer = (await page.getByRole("contentinfo").boundingBox())!;
      expect(footer.x).toBeGreaterThanOrEqual(box.x - 1);
      expect(footer.x + footer.width).toBeLessThanOrEqual(box.x + box.width + 1);
      expect(Math.abs(footer.y + footer.height - (box.y + box.height))).toBeLessThanOrEqual(1);

      const content = (await page.locator("#contenido > div").boundingBox())!;
      expect(content.x - (box.x + box.width)).toBeGreaterThanOrEqual(24);
    });
  }

  test("the footer reserve is at least the footer height plus 16px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const reserve = await page
      .getByTestId("sidebar")
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
    const footer = (await page.getByRole("contentinfo").boundingBox())!;
    expect(reserve).toBeGreaterThanOrEqual(footer.height + 16);
  });

  test("the active sidebar item shows the lime bar", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/vitrina");
    const width = await page
      .locator("a[aria-current=page]:visible")
      .evaluate((el) => parseFloat(getComputedStyle(el, "::before").width));
    expect(width).toBeGreaterThan(0);
  });
});

test.describe("opaque bottom bar", () => {
  test("is solid, unblurred and stays on top of scrolled content", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const bar = page.getByTestId("bottom-nav");
    const style = await bar.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, blur: cs.backdropFilter, shadow: cs.boxShadow };
    });
    expect(style.bg).toBe("rgb(13, 35, 24)");
    expect(style.blur).toBe("none");
    expect(style.shadow).not.toBe("none");

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const onTop = await bar.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return el.contains(hit);
    });
    expect(onTop).toBe(true);
    await page.screenshot({
      path: `test-results/screens/${testInfo.project.name}-scrolled-under-bar.png`,
    });
  });
});
