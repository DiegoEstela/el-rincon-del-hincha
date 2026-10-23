import { expect, test, type Page } from "@playwright/test";

const KEY = "rincon-del-hincha:fan";
const DATE = "1990-05-20";
const DATE_SPELLINGS = ["1990-05-20", "20/05/1990", "19900520", "1990%2D05%2D20"];
const SCREENS = "test-results/screens";
const NO_COMPLETE = /cobertura completa|historial completo/i;

async function seed(page: Page, clubId: string, date = DATE) {
  await page.addInitScript(
    ([key, id, startDate]) =>
      window.localStorage.setItem(
        key,
        JSON.stringify({ v: 1, clubId: id, startDate, startMode: "birth" }),
      ),
    [KEY, clubId, date] as const,
  );
}

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;
const shot = (page: Page, project: string, name: string, fullPage = false) =>
  page.screenshot({ path: `${SCREENS}/${project}-rivalry-${name}.png`, fullPage });
const h1 = (page: Page, name: string) => page.getByRole("heading", { level: 1, name });
const bodyText = (page: Page) => page.locator("body").innerText();
/** React keeps a hidden route in the DOM (Activity), so ask for what is visible. */
const visibleText = (page: Page, text: RegExp) => page.getByText(text).locator("visible=true");

test.describe("from the list and back", () => {
  test("opens a rival, comes back with the filter still on, and browser back does the same", async ({
    page,
  }) => {
    await seed(page, "river-plate");
    await page.goto("/rivales");
    await expect(h1(page, "River vs. todos")).toBeVisible();
    await page.getByLabel("Liga", { exact: true }).check({ force: true });
    await expect(visibleText(page, /^Contamos:/)).toHaveText("Contamos: Primera División.");

    await page.getByRole("link", { name: "Boca, ver el mano a mano" }).first().click();
    await expect(page).toHaveURL(/\/rivales\/boca-juniors$/);
    await expect(h1(page, "River vs. Boca")).toBeVisible();

    await page.getByRole("link", { name: "Volver a Rivales" }).click();
    await expect(page).toHaveURL(/\/rivales$/);
    await expect(page.getByLabel("Liga", { exact: true })).toBeChecked();
    await expect(visibleText(page, /^Contamos:/)).toHaveText("Contamos: Primera División.");

    await page.getByRole("link", { name: "Boca, ver el mano a mano" }).first().click();
    await expect(h1(page, "River vs. Boca")).toBeVisible();
    await page.goBack();
    await expect(page.getByLabel("Liga", { exact: true })).toBeChecked();
  });

  test("reaches the rival link with the keyboard and opens it with Enter", async ({ page }) => {
    test.skip(!isDesktop(page), "the keyboard path is the desktop one");
    await seed(page, "river-plate");
    await page.goto("/rivales");
    const link = page.getByRole("link", { name: "Boca, ver el mano a mano" }).first();
    await link.focus();
    await expect(link).toBeFocused();
    expect(await link.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(h1(page, "River vs. Boca")).toBeVisible();
  });
});

test.describe("ready content", () => {
  test("River v Boca: record, stakes, last match, streak and goleadas", async ({
    page,
  }, testInfo) => {
    await seed(page, "river-plate");
    await page.goto("/rivales/boca-juniors");
    await expect(h1(page, "River vs. Boca")).toBeVisible();

    await expect(page.getByRole("note")).toContainText("Tu historial puede estar incompleto");
    await expect(page.getByText(/^Contamos:/)).toBeVisible();
    await expect(page.getByText(/^Todavía no cargamos Copa Argentina/)).toBeVisible();
    expect(await bodyText(page)).not.toMatch(NO_COMPLETE);
    await expect(page.getByText("Desde mayo de 1990 · 9 partidos")).toBeVisible();

    const record = page.getByRole("region", { name: "El historial" });
    await expect(record.getByRole("definition")).toHaveText(["9", "5", "2", "2", "+3"]);
    await expect(record.getByText("Dominás")).toBeVisible();
    await expect(record.getByText("Goles: 10 a 7")).toBeVisible();

    await expect(
      page.getByText(
        "Tenés colchón: harían falta 2 derrotas más para que esto vuelva a estar parejo.",
      ),
    ).toBeVisible();

    const last = page.getByRole("region", { name: "El último partido" });
    await expect(last).toContainText("19 de octubre de 2025");
    await expect(last.getByText("Boca 2, River 0")).toBeAttached();
    await expect(last.getByText("Perdiste")).toBeVisible();
    await expect(page.getByText("Perdiste el último.")).toBeVisible();

    await expect(page.getByRole("region", { name: "Goleadas" })).toContainText(
      "23 de septiembre de 2018",
    );
    await expect(
      page.getByText(
        "No se cruzaron en ninguna final en tu período. Por ahora, todo se define en el torneo.",
      ),
    ).toBeVisible();

    const headings = await page.getByRole("heading", { level: 2 }).allTextContents();
    expect(headings).toEqual([
      "El historial",
      "Lo que está en juego",
      "El último partido",
      "Rachas",
      "Goleadas",
      "Finales entre ustedes",
    ]);
    await shot(page, testInfo.project.name, "ready");
    await shot(page, testInfo.project.name, "ready-full", true);
  });

  test("Boca v Banfield: the only final, won on penalties", async ({ page }, testInfo) => {
    await seed(page, "boca-juniors");
    await page.goto("/rivales/banfield");
    await expect(h1(page, "Boca vs. Banfield")).toBeVisible();
    const finals = page.getByRole("region", { name: "Finales entre ustedes" });
    await expect(finals).toContainText("Copa Diego Armando Maradona 2020");
    await expect(finals).toContainText("Ganaste la final");
    await expect(finals).toContainText("Ganaste 5 a 3 por penales");
    await shot(page, testInfo.project.name, "final");
  });

  test("Belgrano v Talleres from 2000: three stake lines and a winless run", async ({
    page,
  }, testInfo) => {
    await seed(page, "belgrano", "2000-01-01");
    await page.goto("/rivales/talleres-cordoba");
    await expect(h1(page, "Belgrano vs. Talleres")).toBeVisible();
    const stakes = page.getByRole("region", { name: "Lo que está en juego" });
    await expect(stakes.getByRole("listitem")).toHaveCount(3);
    await expect(stakes).toContainText("Con 3 triunfos más pasás a dominar este historial.");
    await expect(stakes).toContainText("Ojo: con 1 derrota más te pasan a dominar.");
    await expect(stakes).toContainText("Todavía no le ganaste desde que naciste.");
    await expect(page.getByText("Venís de 5 partidos sin ganarle.")).toBeVisible();
    await shot(page, testInfo.project.name, "belgrano");
  });

  test("Aldosivi v Riestra: never met", async ({ page }, testInfo) => {
    await seed(page, "aldosivi");
    await page.goto("/rivales/deportivo-riestra");
    await expect(page.getByRole("heading", { name: "Todavía no se cruzaron" })).toBeVisible();
    await expect(page.getByRole("note")).toBeVisible();
    await expect(page.getByText(/^Todavía no se cruzaron en los torneos/)).toBeVisible();
    await shot(page, testInfo.project.name, "never-met");
  });

  test("uses one column on phones without horizontal scroll, two on desktop", async ({ page }) => {
    await seed(page, "river-plate");
    await page.goto("/rivales/boca-juniors");
    await expect(h1(page, "River vs. Boca")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const record = await page.getByRole("region", { name: "El historial" }).boundingBox();
    const last = await page.getByRole("region", { name: "El último partido" }).boundingBox();
    if (isDesktop(page)) {
      expect(last!.x).toBeGreaterThan(record!.x + record!.width - 1);
    } else {
      expect(last!.y).toBeGreaterThan(record!.y);
      expect(Math.abs(last!.x - record!.x)).toBeLessThan(2);
    }
  });
});

test.describe("states", () => {
  test("shows the empty state without a saved club", async ({ page }) => {
    await page.goto("/rivales/boca-juniors");
    await expect(page.getByRole("heading", { name: "Todavía no elegiste tu club" })).toBeVisible();
    await expect(page.getByText("Cargando el mano a mano…")).toBeHidden();
  });

  test("says it is your club, and requests no data", async ({ page }, testInfo) => {
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await seed(page, "river-plate");
    await page.goto("/rivales/river-plate");
    await expect(h1(page, "Ese es tu club")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver tus rivales" })).toHaveAttribute(
      "href",
      "/rivales",
    );
    expect(requests.filter((url) => url.includes("/api/"))).toEqual([]);
    await shot(page, testInfo.project.name, "same-club");
  });

  test("answers a real 404 for an unknown rival, without echoing it", async ({
    page,
  }, testInfo) => {
    const response = await page.goto("/rivales/not-a-club");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "Ese rival no está en nuestro fixture" }),
    ).toBeVisible();
    expect(await bodyText(page)).not.toContain("not-a-club");
    await expect(page.getByRole("contentinfo")).toContainText("Creada por Diego Estela Lopez");
    await shot(page, testInfo.project.name, "not-found");
  });

  test("shows the skeleton while the rival loads", async ({ page }, testInfo) => {
    await seed(page, "river-plate");
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route("**/api/clubs/boca-juniors", async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto("/rivales/boca-juniors");
    await expect(page.getByText("Cargando el mano a mano…")).toBeAttached();
    await expect(page.locator("[aria-busy='true']")).toBeVisible();
    await shot(page, testInfo.project.name, "loading");
    release();
    await expect(page.getByRole("heading", { level: 2, name: "El historial" })).toBeVisible();
  });

  test("shows the error when the rival fails and recovers with Reintentar", async ({
    page,
  }, testInfo) => {
    await seed(page, "river-plate");
    await page.route("**/api/clubs/boca-juniors", (route) =>
      route.fulfill({ status: 500, body: "x" }),
    );
    await page.goto("/rivales/boca-juniors");
    await expect(page.getByRole("heading", { name: "Se nos cortó la transmisión" })).toBeVisible();
    await shot(page, testInfo.project.name, "error");
    await page.unroute("**/api/clubs/boca-juniors");
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(h1(page, "River vs. Boca")).toBeVisible();
  });

  test("puts the rival and the right pending block in the server HTML", async ({ page }) => {
    await page.route("**/_next/static/**/*.js", (route) => route.abort());
    await page.goto("/rivales/boca-juniors");
    await expect(h1(page, "Tu club vs. Boca")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Todavía no elegiste tu club" })).toBeVisible();
    const saved = await page.context().newPage();
    await seed(saved, "river-plate");
    await saved.route("**/_next/static/**/*.js", (route) => route.abort());
    await saved.goto("/rivales/boca-juniors");
    await expect(h1(saved, "Tu club vs. Boca")).toBeVisible();
    await expect(saved.getByRole("heading", { name: "Todavía no elegiste tu club" })).toBeHidden();
    await expect(saved.locator("[aria-busy='true']")).toBeVisible();
  });
});

test.describe("privacy, metadata and accessibility", () => {
  test("never sends the start date, and requests only the two public club documents", async ({
    page,
  }) => {
    const urls: string[] = [];
    const bodies: string[] = [];
    const messages: string[] = [];
    page.on("request", (request) => {
      urls.push(request.url());
      bodies.push(request.postData() ?? "");
    });
    page.on("console", (message) => messages.push(message.text()));
    page.on("pageerror", (error) => messages.push(error.message));

    await seed(page, "river-plate");
    await page.goto("/rivales/boca-juniors");
    await expect(h1(page, "River vs. Boca")).toBeVisible();

    for (const spelling of DATE_SPELLINGS) {
      expect(urls.some((u) => u.includes(spelling))).toBe(false);
      expect(bodies.some((b) => b.includes(spelling))).toBe(false);
      expect(messages.some((m) => m.includes(spelling))).toBe(false);
      expect(await page.evaluate(() => document.cookie)).not.toContain(spelling);
      expect(await bodyText(page)).not.toContain(spelling);
    }
    const data = urls.filter((u) => u.includes("/api/")).sort();
    expect(data).toEqual([
      expect.stringMatching(/\/api\/clubs\/boca-juniors$/),
      expect.stringMatching(/\/api\/clubs\/river-plate$/),
    ]);
    for (const url of data) expect(new URL(url).search).toBe("");
  });

  test("has the title of the rival and asks not to be indexed", async ({ page }) => {
    await seed(page, "river-plate");
    await page.goto("/rivales/boca-juniors");
    await expect(page).toHaveTitle("Boca Juniors · Rivales · Rincón del Hincha");
    await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", /noindex/);
  });

  test("gives every link and card at least 44 px on a phone", async ({ page }) => {
    test.skip(isDesktop(page), "touch targets matter on phones");
    await seed(page, "river-plate");
    await page.goto("/rivales");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The stretched link covers its card with a pseudo-element, so the card is the target.
    // Measured in one evaluation in the browser, so a re-render cannot detach the element.
    const cards = page.getByRole("list", { name: "Rivales" }).getByRole("listitem");
    await expect(cards.first()).toBeVisible();
    const heights = await cards.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().height),
    );
    expect(heights.length).toBeGreaterThan(10);
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(43.5);

    await page.goto("/rivales/boca-juniors");
    await expect(h1(page, "River vs. Boca")).toBeVisible();
    const backLink = page.getByRole("link", { name: "Volver a Rivales" });
    await expect(backLink).toBeVisible();
    const back = await backLink.evaluate((el) => el.getBoundingClientRect().height);
    expect(back).toBeGreaterThanOrEqual(43.5);
  });

  test("turns the bar animation off with reduced motion and keeps the footer", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page, "river-plate");
    await page.goto("/rivales/boca-juniors");
    await expect(h1(page, "River vs. Boca")).toBeVisible();
    const duration = await page
      .locator("[aria-hidden='true'].origin-left")
      .first()
      .evaluate((el) => getComputedStyle(el).animationDuration);
    expect(parseFloat(duration)).toBeLessThan(0.01);
    await expect(page.getByRole("contentinfo")).toContainText("Creada por Diego Estela Lopez");
    await expect(page.getByTestId("app-version")).toHaveText(/^v\d+\.\d+\.\d+$/);
  });
});
