import { expect, test, type Page } from "@playwright/test";

const KEY = "rincon-del-hincha:fan";
const DATE = "1990-05-20";
const SCREENS = "test-results/screens";

const search = (page: Page) => page.getByRole("searchbox", { name: "Buscá tu club" });
const radios = (page: Page) =>
  page.getByRole("radiogroup", { name: "Elegí tu club" }).getByRole("radio");
const cta = (page: Page) => page.getByRole("button", { name: "Ver mi historia" });
const dateInput = (page: Page) => page.getByLabel(/Tu fecha de nacimiento|¿Desde qué fecha\?/);

async function seed(page: Page, clubId: string) {
  await page.addInitScript(
    ([key, id, date]) =>
      window.localStorage.setItem(
        key,
        JSON.stringify({ v: 1, clubId: id, startDate: date, startMode: "birth" }),
      ),
    [KEY, clubId, DATE] as const,
  );
}

test.describe("grid, search and keyboard flow (T19)", () => {
  test("shows the grid, filters it and shows the empty state", async ({ page }, testInfo) => {
    await page.goto("/");
    await expect(radios(page)).toHaveCount(34);
    await expect(search(page)).toBeVisible();
    await page.locator("#elegi-tu-club").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SCREENS}/${testInfo.project.name}-onboarding-grid.png` });

    await search(page).fill("velez");
    await expect(radios(page)).toHaveCount(1);
    // Former Primera clubs can be picked too (plan 0012).
    await search(page).fill("arsenal");
    await expect(radios(page)).toHaveCount(1);
    await search(page).fill("rivadavia");
    await expect(radios(page)).toHaveCount(1);
    await search(page).fill("san martin");
    await expect(radios(page)).toHaveCount(2);
    await search(page).fill("zzz");
    await expect(page.getByText("No encontramos ese club")).toBeVisible();
    await expect(
      page.getByText("Por ahora están los clubes que jugaron en Primera desde 2018."),
    ).toBeVisible();
    await page.screenshot({
      path: `${SCREENS}/${testInfo.project.name}-onboarding-search-empty.png`,
    });
    await page.getByRole("button", { name: "Ver todos los clubes" }).click();
    await expect(radios(page)).toHaveCount(34);
    await expect(search(page)).toBeFocused();
  });

  test("shows the date errors", async ({ page }, testInfo) => {
    await page.goto("/");
    await radios(page).first().check({ force: true });
    await dateInput(page).focus();
    await dateInput(page).fill("2999-01-01");
    await page.getByText("Paso 2 de 2").click();
    await expect(page.getByText(/Eso todavía no se jugó/)).toBeVisible();
    await dateInput(page).focus();
    await dateInput(page).fill("1879-12-31");
    await page.getByText("Paso 2 de 2").click();
    await expect(page.getByText(/Tan atrás no llegamos/)).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await dateInput(page).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${SCREENS}/${testInfo.project.name}-onboarding-step2-error.png`,
    });
  });

  test("completes the flow with the keyboard only", async ({ page }) => {
    test.skip(page.viewportSize()!.width < 600, "keyboard flow runs on the desktop project");
    await page.goto("/");
    await page.getByRole("link", { name: "Empezá: elegí tu club" }).focus();
    await page.keyboard.press("Enter");
    await search(page).focus();
    await page.keyboard.type("racing");
    await page.keyboard.press("Tab");
    await expect(radios(page)).toHaveCount(1);
    await expect(radios(page).first()).toBeFocused();
    await page.keyboard.press("Space");
    await expect(radios(page).first()).toBeChecked();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("radio", { name: /Desde que nací/ })).toBeFocused();
    await page.keyboard.press("Tab");
    await dateInput(page).focus();
    await dateInput(page).fill(DATE);
    for (const el of [search(page), dateInput(page), cta(page)]) {
      await el.focus();
      const outline = await el.evaluate((node) => getComputedStyle(node).outlineStyle);
      expect(outline).not.toBe("none");
    }
    await cta(page).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/vitrina$/);
    expect(new URL(page.url()).search).toBe("");
    const stored = await page.evaluate((key) => window.localStorage.getItem(key), KEY);
    expect(JSON.parse(stored!)).toEqual({
      v: 1,
      clubId: "racing-club",
      startDate: DATE,
      startMode: "birth",
    });
  });
});

test.describe("privacy and resilience (T20)", () => {
  async function flow(page: Page) {
    await page.goto("/");
    await page.getByRole("radio", { name: /River/ }).check({ force: true });
    await dateInput(page).fill(DATE);
    await cta(page).click();
    await expect(page).toHaveURL(/\/vitrina$/);
  }

  test("the date never reaches a URL, a request body or a cookie", async ({ page }) => {
    const leaks: string[] = [];
    const forbidden = [DATE, "20/05/1990", "19900520", "1990%2D05%2D20"];
    const check = (value: string | null | undefined, where: string) => {
      if (value && forbidden.some((f) => value.includes(f))) leaks.push(where);
    };
    page.on("request", (request) => {
      check(request.url(), `url ${request.url()}`);
      check(request.postData(), "body");
    });
    page.on("framenavigated", (frame) => check(frame.url(), "navigation"));
    await flow(page);
    check(await page.evaluate(() => document.cookie), "cookie");
    expect(leaks).toEqual([]);
  });

  test("works when localStorage is blocked", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("blocked", "SecurityError");
        },
      });
    });
    await flow(page);
    expect(errors).toEqual([]);
  });

  test("works when saving throws", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("quota", "QuotaExceededError");
      };
    });
    await flow(page);
    expect(errors).toEqual([]);
  });
});

test.describe("theme, returning visitor and touch targets (T21)", () => {
  const accentOf = (page: Page) =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
    );

  test("themes the page before hydration", async ({ page }, testInfo) => {
    await seed(page, "river-plate");
    await page.route("**/_next/static/chunks/**", (route) => route.abort());
    for (const path of ["/", "/rivales"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-club", "river-plate");
      expect(await accentOf(page)).toBe("#ff6f64");
    }
    await page.screenshot({ path: `${SCREENS}/${testInfo.project.name}-themed-river.png` });
  });

  test("keeps the lime without a saved club", async ({ page }) => {
    await page.goto("/");
    expect(await accentOf(page)).toBe("#c6ff3d");
  });

  test("themes Boca with a light blue", async ({ page }, testInfo) => {
    await seed(page, "boca-juniors");
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-club", "boca-juniors");
    expect(await accentOf(page)).toBe("#83a0d8");
    await page.screenshot({ path: `${SCREENS}/${testInfo.project.name}-themed-boca.png` });
  });

  test("welcomes a returning visitor", async ({ page }, testInfo) => {
    await seed(page, "river-plate");
    await page.goto("/");
    await expect(page.getByText("¡Volviste!")).toBeVisible();
    await expect(page.getByText(/Sos de River Plate/)).toBeVisible();
    await page.screenshot({ path: `${SCREENS}/${testInfo.project.name}-returning.png` });
    await page.getByRole("button", { name: "Cambiar club o fecha" }).click();
    await expect(search(page)).toBeFocused();
  });

  test("keeps the footer on / with a saved club", async ({ page }) => {
    await seed(page, "river-plate");
    await page.goto("/");
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
    await expect(page.getByTestId("app-version")).toHaveCount(1);
  });

  test("touch targets are at least 44 x 44", async ({ page }) => {
    await page.goto("/");
    const targets = [
      radios(page).first().locator("xpath=.."),
      page.getByRole("radio", { name: /Desde que nací/ }).locator("xpath=.."),
      dateInput(page),
      cta(page),
    ];
    for (const target of targets) {
      await target.scrollIntoViewIfNeeded();
      const box = await target.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("respects reduced motion on the tiles", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const duration = await radios(page)
      .first()
      .locator("xpath=..")
      .evaluate((node) => parseFloat(getComputedStyle(node).transitionDuration));
    expect(duration).toBeLessThan(0.01);
  });
});
