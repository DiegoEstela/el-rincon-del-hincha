import { expect, test } from "@playwright/test";

test.describe("desktop info links", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("Acerca and Privacidad live in the sidebar", async ({ page }) => {
    await page.goto("/acerca");
    const nav = page.getByRole("navigation", { name: "Información" });
    await expect(nav).toHaveCount(1);
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Acerca" })).toHaveAttribute("href", "/acerca");
    await expect(nav.getByRole("link", { name: "Privacidad" })).toHaveAttribute(
      "href",
      "/privacidad",
    );
    await expect(nav.getByRole("link", { name: "Acerca" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("button", { name: "Más información" })).toBeHidden();
  });
});

test.describe("mobile info sheet", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
  });

  test("button meets the touch target size", async ({ page }) => {
    const box = (await page.getByRole("button", { name: "Más información" }).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test("keyboard: open, trap focus, Escape returns focus", async ({ page }, testInfo) => {
    const button = page.getByRole("button", { name: "Más información" });
    await page.keyboard.press("Tab"); // skip link
    await page.keyboard.press("Tab"); // logo
    await page.keyboard.press("Tab"); // info button
    await expect(button).toBeFocused();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Más info" });
    await expect(dialog).toBeVisible();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(button).toHaveAttribute("aria-controls", "info-sheet");
    await page.screenshot({ path: `test-results/screens/${testInfo.project.name}-info-sheet.png` });

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });

  test("a link navigates and closes the sheet", async ({ page }) => {
    await page.getByRole("button", { name: "Más información" }).click();
    await page
      .getByRole("dialog", { name: "Más info" })
      .getByRole("link", { name: "Acerca" })
      .click();
    await expect(page).toHaveURL(/\/acerca$/);
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("closes from the backdrop and from Cerrar", async ({ page }) => {
    const button = page.getByRole("button", { name: "Más información" });
    await button.click();
    await page.mouse.click(10, 10);
    await expect(page.getByRole("dialog")).toBeHidden();

    await button.click();
    await page.getByRole("button", { name: "Cerrar" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(button).toBeFocused();
  });

  test("keeps a single footer while open and closes when the viewport widens", async ({ page }) => {
    await page.getByRole("button", { name: "Más información" }).click();
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("reduced motion removes the sheet transition", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "Más información" }).click();
    const duration = await page
      .getByRole("dialog")
      .evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration));
    expect(duration).toBeLessThan(0.01);
  });
});

test("1023px shows the info button and 1024px hides it", async ({ page }) => {
  await page.setViewportSize({ width: 1023, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Más información" })).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(page.getByRole("button", { name: "Más información" })).toBeHidden();
});
