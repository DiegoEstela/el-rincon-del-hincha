import { expect, test, type Page } from "@playwright/test";
import { riverDocument, riverDocumentWithoutTitles } from "./helpers/vitrina-doc";

const KEY = "rincon-del-hincha:fan";
const DATE = "2020-01-01";
const DATE_SPELLINGS = ["2020-01-01", "01/01/2020", "20200101", "2020%2D01%2D01"];
const SCREENS = "test-results/screens";
// "incompleta" is the honest word; claiming a complete history is not.
const CLAIMS_COMPLETE = /(?<!in)complet[ao]\b|toda la historia/i;

async function seed(page: Page, clubId: string, date = DATE, startMode = "birth") {
  await page.addInitScript(
    ([key, id, startDate, mode]) =>
      window.localStorage.setItem(
        key,
        JSON.stringify({ v: 1, clubId: id, startDate, startMode: mode }),
      ),
    [KEY, clubId, date, startMode] as const,
  );
}

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;
const shot = (page: Page, project: string, name: string, fullPage = false) =>
  page.screenshot({ path: `${SCREENS}/${project}-vitrina-${name}.png`, fullPage });
const h1 = (page: Page, name: string) => page.getByRole("heading", { level: 1, name });
const bodyText = (page: Page) => page.locator("body").innerText();

/** Serves the synthetic document for River; the rest of the app is the real one. */
async function serve(page: Page, document: unknown = riverDocument()) {
  await page.route("**/api/clubs/river-plate", (route) => route.fulfill({ json: document }));
}

test.describe("ready content (synthetic document)", () => {
  test("shows the counters, the shelves, the notice, the checklist and the disputed block", async ({
    page,
  }, testInfo) => {
    await seed(page, "river-plate");
    await serve(page);
    await page.goto("/vitrina");
    await expect(h1(page, "Mi vitrina")).toBeVisible();
    await expect(page.getByText("River · desde enero de 2020")).toBeVisible();

    await expect(page.getByText("Trofeos ganados desde que naciste")).toBeVisible();
    await expect(page.getByText("Trofeo que te falta")).toBeVisible();
    await expect(page.getByText("En los torneos y temporadas que tenemos cargados.")).toBeVisible();
    const counters = page.getByRole("region", { name: "Tus trofeos" });
    await expect(counters.locator("p.font-display")).toHaveText(["5", "1"]);

    const note = page.getByRole("note");
    await expect(note).toContainText("Tu vitrina puede estar incompleta");
    await expect(page.getByText(/^Contamos títulos de:/)).toBeVisible();
    await expect(page.getByText(/^Todavía no cargamos Copa Argentina/)).toBeVisible();
    expect(await bodyText(page)).not.toMatch(CLAIMS_COMPLETE);

    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Internacionales",
      "Locales",
      "Otros",
      "Tu checklist",
      "Títulos discutidos",
    ]);
    await expect(page.getByText("Te falta", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Todavía no cargamos supercopas ni otros trofeos.")).toBeVisible();
    await shot(page, testInfo.project.name, "ready");
    await shot(page, testInfo.project.name, "ready-full", true);
  });

  test("uses one column on phones without horizontal scroll, and columns on desktop", async ({
    page,
  }) => {
    await seed(page, "river-plate");
    await serve(page);
    await page.goto("/vitrina");
    await expect(h1(page, "Mi vitrina")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const shelves = await page.getByRole("heading", { name: "Locales" }).boundingBox();
    const checklist = await page.getByRole("heading", { name: "Tu checklist" }).boundingBox();
    if (isDesktop(page)) {
      expect(checklist!.x).toBeGreaterThan(shelves!.x + 200);
    } else {
      expect(Math.abs(checklist!.x - shelves!.x)).toBeLessThan(2);
    }
  });

  test("words the counter by start mode, and keeps the titles before the start apart", async ({
    page,
  }) => {
    await seed(page, "river-plate", "2022-06-01", "other");
    await serve(page);
    await page.goto("/vitrina");
    await expect(page.getByText(/^Trofeos? ganados? desde que sos hincha$/)).toBeVisible();
    const before = page.getByText(/^Antes de que llegaras \(\d+\)$/);
    await expect(before).toBeVisible();
    await expect(page.locator("details[open]")).toHaveCount(0);
  });
});

test.describe("trophy detail", () => {
  test("opens with the final, the penalties and the criterion; Escape closes and returns the focus", async ({
    page,
  }, testInfo) => {
    await seed(page, "river-plate");
    await serve(page);
    await page.goto("/vitrina");
    await expect(h1(page, "Mi vitrina")).toBeVisible();
    const trophy = page.getByRole("button", { name: /Ver detalle/ }).first();
    await trophy.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/^Campeón el /)).toBeVisible();
    await expect(dialog.getByRole("heading", { level: 3 })).toHaveText(/La final|La última fecha/);
    await expect(dialog.getByText(/Contamos solo títulos reconocidos por la AFA/)).toBeVisible();
    await shot(page, testInfo.project.name, "detail");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trophy).toBeFocused();
  });

  test("shows the penalties and the co-champion of a final won on a shoot-out", async ({
    page,
  }) => {
    await seed(page, "river-plate");
    await serve(page);
    await page.goto("/vitrina");
    await page.getByRole("button", { name: /campeón el 1 de junio de 2020/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { level: 3, name: "La final" })).toBeVisible();
    await expect(dialog.getByText(/por penales/)).toBeVisible();
    await dialog.getByRole("button", { name: "Cerrar" }).click();
    await page.getByRole("button", { name: /campeón el 15 de diciembre de 2021/ }).click();
    await expect(page.getByRole("dialog").getByText(/^Compartido con/)).toBeVisible();
  });
});

test.describe("states", () => {
  test("shows the empty state without a saved club, and no skeleton", async ({ page }) => {
    await page.goto("/vitrina");
    await expect(page.getByRole("heading", { name: "Todavía no elegiste tu club" })).toBeVisible();
    await expect(page.getByText("Cargando tu vitrina…")).toBeHidden();
    await expect(page.getByRole("link", { name: "Elegir mi club" })).toHaveAttribute(
      "href",
      "/#elegi-tu-club",
    );
  });

  test("shows the skeleton while the document loads", async ({ page }, testInfo) => {
    await seed(page, "river-plate");
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route("**/api/clubs/river-plate", async (route) => {
      await gate;
      await route.fulfill({ json: riverDocument() });
    });
    await page.goto("/vitrina");
    await expect(page.getByText("Cargando tu vitrina…")).toBeAttached();
    await expect(page.locator("[aria-busy='true']")).toBeVisible();
    await shot(page, testInfo.project.name, "loading");
    release();
    await expect(page.getByRole("heading", { level: 2, name: "Locales" })).toBeVisible();
  });

  test("shows the error and recovers with Reintentar", async ({ page }, testInfo) => {
    await seed(page, "river-plate");
    await page.route("**/api/clubs/river-plate", (route) =>
      route.fulfill({ status: 500, body: "x" }),
    );
    await page.goto("/vitrina");
    await expect(page.getByRole("heading", { name: "No pudimos abrir tu vitrina" })).toBeVisible();
    await shot(page, testInfo.project.name, "error");
    await page.unroute("**/api/clubs/river-plate");
    await serve(page);
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(h1(page, "Mi vitrina")).toBeVisible();
  });

  test("says the titles are not loaded when the document has none", async ({ page }, testInfo) => {
    await seed(page, "river-plate");
    await serve(page, riverDocumentWithoutTitles());
    await page.goto("/vitrina");
    await expect(
      page.getByRole("heading", { name: "Todavía no cargamos los títulos" }),
    ).toBeVisible();
    await expect(page.getByText("Trofeos que te faltan")).toBeHidden();
    await expect(page.getByRole("note")).toBeVisible();
    await shot(page, testInfo.project.name, "no-titles");
  });

  test("puts the h1 and the right pending block in the server HTML", async ({ page }) => {
    await page.route("**/_next/static/**/*.js", (route) => route.abort());
    await page.goto("/vitrina");
    await expect(h1(page, "Todavía no elegiste tu club")).toBeVisible();
    const saved = await page.context().newPage();
    await seed(saved, "river-plate");
    await saved.route("**/_next/static/**/*.js", (route) => route.abort());
    await saved.goto("/vitrina");
    await expect(h1(saved, "Mi vitrina")).toBeVisible();
    await expect(saved.locator("[aria-busy='true']")).toBeVisible();
  });
});

test.describe("real data", () => {
  test("River from 1990: two league titles lit, the Copa de la Liga still missing", async ({
    page,
  }, testInfo) => {
    await seed(page, "river-plate", "1990-05-20");
    await page.goto("/vitrina");
    await expect(h1(page, "Mi vitrina")).toBeVisible();
    const counters = page.getByRole("region", { name: "Tus trofeos" });
    await expect(counters.locator("p.font-display")).toHaveText(["2", "1"]);
    await expect(
      page.getByRole("button", { name: /^2021 Liga Profesional 2021, campeón el/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^2023 Liga Profesional 2023, campeón el/ }),
    ).toBeVisible();
    await page.getByText("Ver qué cargamos").click();
    await expect(page.getByText(/^Primera División: tenemos los campeones de/)).toBeVisible();
    expect(await bodyText(page)).not.toMatch(CLAIMS_COMPLETE);
    await shot(page, testInfo.project.name, "river");
  });

  test("Banfield with no title: the clean-shelf line", async ({ page }, testInfo) => {
    await seed(page, "banfield", "2000-01-01");
    await page.goto("/vitrina");
    await expect(
      page.getByText(
        "Todavía no levantaste ninguna copa desde que naciste. La vitrina está limpita y con lugar de sobra.",
      ),
    ).toBeVisible();
    await shot(page, testInfo.project.name, "zero");
  });

  test("Boca from 1990: the Copa Diego Armando Maradona 2020 is lit", async ({ page }) => {
    await seed(page, "boca-juniors", "1990-05-20");
    await page.goto("/vitrina");
    await expect(
      page.getByRole("button", {
        name: /^2021 Copa Diego Armando Maradona 2020, campeón el 17 de enero de 2021/,
      }),
    ).toBeVisible();
  });
});

test.describe("privacy, accessibility and footer", () => {
  test("never sends the start date, and requests only the club document", async ({ page }) => {
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
    await serve(page);
    await page.goto("/vitrina");
    await expect(h1(page, "Mi vitrina")).toBeVisible();
    for (const spelling of DATE_SPELLINGS) {
      expect(urls.some((u) => u.includes(spelling))).toBe(false);
      expect(bodies.some((b) => b.includes(spelling))).toBe(false);
      expect(messages.some((m) => m.includes(spelling))).toBe(false);
      expect(await page.evaluate(() => document.cookie)).not.toContain(spelling);
      expect(await bodyText(page)).not.toContain(spelling);
    }
    const data = urls.filter((u) => u.includes("/api/"));
    expect(data).toEqual([expect.stringMatching(/\/api\/clubs\/river-plate$/)]);
    expect(new URL(data[0]).search).toBe("");
  });

  test("gives every trophy button at least 44 px on a phone", async ({ page }) => {
    test.skip(isDesktop(page), "touch targets matter on phones");
    await seed(page, "river-plate");
    await serve(page);
    await page.goto("/vitrina");
    await expect(h1(page, "Mi vitrina")).toBeVisible();
    const buttons = page.getByRole("button", { name: /Ver detalle/ });
    await expect(buttons.first()).toBeVisible();
    const heights = await buttons.evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).offsetHeight),
    );
    expect(heights.length).toBeGreaterThan(3);
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(43.5);
  });

  test("turns the skeleton animation off with reduced motion and keeps the footer", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page, "river-plate");
    await serve(page);
    await page.goto("/vitrina");
    await expect(h1(page, "Mi vitrina")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toContainText("Creada por Diego Estela Lopez");
    await expect(page.getByTestId("app-version")).toHaveText(/^v\d+\.\d+\.\d+$/);
  });
});
