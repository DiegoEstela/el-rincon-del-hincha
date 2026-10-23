import { expect, test, type Page } from "@playwright/test";

/**
 * Picks the "Liga" type. The radio is a 1 px sr-only input: on a phone the filters can sit under
 * the fixed bottom bar, so the control is first brought to the middle of the screen.
 */
async function pickLiga(page: Page) {
  const liga = page.getByLabel("Liga", { exact: true });
  await liga.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await liga.check({ force: true });
}

const KEY = "rincon-del-hincha:fan";
const DATE = "1990-05-20";
const DATE_SPELLINGS = ["1990-05-20", "20/05/1990", "19900520", "1990%2D05%2D20"];
const SCREENS = "test-results/screens";

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
  page.screenshot({ path: `${SCREENS}/${project}-rivales-${name}.png`, fullPage });

/** The first visible row of the list of rivals, whichever layout is shown. */
const rows = (page: Page) =>
  isDesktop(page)
    ? page.getByRole("table").locator("tbody tr")
    : page.getByRole("list", { name: "Rivales" }).getByRole("listitem");

const cards = (page: Page) =>
  page.getByRole("link", { name: /^Historial (favorable|igualado|desfavorable)/ });

test.describe("empty, loading and error states", () => {
  test("shows the empty state without a saved club, and no skeleton", async ({
    page,
  }, testInfo) => {
    await page.goto("/rivales");
    await expect(page.getByRole("heading", { name: "Todavía no elegiste tu club" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Elegí tu club" })).toHaveAttribute(
      "href",
      "/#elegi-tu-club",
    );
    await expect(page.getByText("Cargando tu historial…")).toBeHidden();
    await shot(page, testInfo.project.name, "empty");
  });

  test("shows the skeleton while the data loads, then the content", async ({ page }, testInfo) => {
    await seed(page, "river-plate");
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route("**/api/clubs/river-plate", async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto("/rivales");
    await expect(page.getByText("Cargando tu historial…")).toBeAttached();
    await expect(page.locator("[aria-busy='true']")).toBeVisible();
    await shot(page, testInfo.project.name, "loading");
    release();
    await expect(page.getByRole("heading", { level: 1, name: "River vs. todos" })).toBeVisible();
    await expect(page.locator("[aria-busy='true']")).toHaveCount(0);
  });

  test("shows the error state and recovers with Reintentar", async ({ page }, testInfo) => {
    await seed(page, "river-plate");
    await page.route("**/api/clubs/river-plate", (route) =>
      route.fulfill({ status: 500, body: "x" }),
    );
    await page.goto("/rivales");
    await expect(page.getByRole("heading", { name: "Se nos cortó la transmisión" })).toBeVisible();
    await shot(page, testInfo.project.name, "error");
    await page.unroute("**/api/clubs/river-plate");
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "River vs. todos" })).toBeVisible();
  });

  test("chooses skeleton or empty state in the server HTML, before any script runs", async ({
    page,
  }) => {
    await page.route("**/_next/static/**/*.js", (route) => route.abort());
    await page.goto("/rivales");
    await expect(page.getByRole("heading", { name: "Todavía no elegiste tu club" })).toBeVisible();
    await expect(page.getByText("Cargando tu historial…")).toBeHidden();

    const saved = await page.context().newPage();
    await seed(saved, "river-plate");
    await saved.route("**/_next/static/**/*.js", (route) => route.abort());
    await saved.goto("/rivales");
    await expect(saved.getByRole("heading", { name: "Todavía no elegiste tu club" })).toBeHidden();
    await expect(saved.locator("[aria-busy='true']")).toBeVisible();
  });
});

test.describe("the screen with data", () => {
  test("shows the title, the notice, the cards and the list, and never claims a complete history", async ({
    page,
  }, testInfo) => {
    await seed(page, "river-plate");
    await page.goto("/rivales");
    await expect(page.getByRole("heading", { level: 1, name: "River vs. todos" })).toBeVisible();

    const note = page.getByRole("note");
    await expect(note).toContainText("Tu historial puede estar incompleto");
    await expect(page.getByText(/^Contamos:/)).toBeVisible();
    await expect(
      page.getByText(
        "De la Copa Argentina y las supercopas cargamos 2023 a 2025. Todavía no cargamos Libertadores, Sudamericana ni otras copas.",
      ),
    ).toBeVisible();
    expect(await page.locator("body").innerText()).not.toMatch(
      /cobertura completa|historial completo/i,
    );

    const counts = await cards(page).evaluateAll((els) =>
      els.map((el) => Number(/(\d+) rival/.exec(el.textContent ?? "")?.[1])),
    );
    expect(counts).toHaveLength(3);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(await rows(page).count());

    if (isDesktop(page)) {
      await expect(page.getByRole("table")).toBeVisible();
      await expect(page.getByRole("list", { name: "Rivales" })).toBeHidden();
    } else {
      await expect(page.getByRole("list", { name: "Rivales" })).toBeVisible();
      await expect(page.getByRole("table")).toBeHidden();
    }
    await shot(page, testInfo.project.name, "ready");
    await shot(page, testInfo.project.name, "ready-full", true);
  });

  test("filters by tournament type and by year, and sorts by name", async ({ page }) => {
    await seed(page, "river-plate");
    await page.goto("/rivales");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await pickLiga(page);
    await expect(page.getByText(/^Contamos:/)).toHaveText("Contamos: Primera División.");
    await expect(page.getByRole("button", { name: "Limpiar filtros" })).toBeVisible();

    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await page.getByRole("combobox", { name: "Desde" }).selectOption("2019");
    await page.getByRole("combobox", { name: "Hasta" }).selectOption("2019");
    // One year of Primera is complete, so the note goes away; the two plain lines stay.
    await expect(page.getByRole("note")).toHaveCount(0);
    await expect(page.getByText(/^Contamos:/)).toBeVisible();
    await expect(page.getByText(/^De la Copa Argentina y las supercopas/)).toBeVisible();
    expect(await page.locator("body").innerText()).not.toMatch(
      /cobertura completa|historial completo/i,
    );

    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await page.getByRole("combobox", { name: "Ordenar por" }).selectOption("name");
    await expect(rows(page).first()).toContainText("Aldosivi");
  });

  test("shows the empty favorable section for San Martín SJ, and the notice", async ({
    page,
  }, testInfo) => {
    await seed(page, "san-martin-san-juan", "2000-01-01");
    await page.goto("/rivales");
    await expect(
      page.getByRole("heading", { level: 1, name: "San Martín SJ vs. todos" }),
    ).toBeVisible();
    await expect(
      page.getByText("Todavía no tenés hijos futboleros. Paciencia, que la tuya se sigue jugando."),
    ).toBeVisible();
    await expect(page.getByRole("note")).toBeVisible();
    await shot(page, testInfo.project.name, "san-martin-sj");
  });

  test("says there is nothing to count when the start is after the last loaded match", async ({
    page,
  }) => {
    await seed(page, "racing-club", "2026-01-01");
    await page.goto("/rivales");
    await expect(page.getByText("Todavía no hay partidos para contar")).toBeVisible();
    await expect(page.getByRole("note")).toBeVisible();
  });

  test("keeps the footer with credits and version", async ({ page }) => {
    await seed(page, "river-plate");
    await page.goto("/rivales");
    await expect(page.getByRole("heading", { level: 1, name: "River vs. todos" })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toContainText("Creada por Diego Estela Lopez");
    await expect(page.getByTestId("app-version")).toHaveText(/^v\d+\.\d+\.\d+$/);
  });
});

test.describe("privacy", () => {
  test("never sends the start date: not in a URL, a body, a cookie or the console", async ({
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
    await page.goto("/rivales");
    await expect(page.getByRole("heading", { level: 1, name: "River vs. todos" })).toBeVisible();
    await pickLiga(page);
    await page.getByRole("combobox", { name: "Ordenar por" }).selectOption("played");

    for (const spelling of DATE_SPELLINGS) {
      expect(
        urls.some((u) => u.includes(spelling)),
        `url ${spelling}`,
      ).toBe(false);
      expect(
        bodies.some((b) => b.includes(spelling)),
        `body ${spelling}`,
      ).toBe(false);
      expect(
        messages.some((m) => m.includes(spelling)),
        `console ${spelling}`,
      ).toBe(false);
      expect(await page.evaluate(() => document.cookie)).not.toContain(spelling);
    }
    const dataRequests = urls.filter((u) => u.includes("/api/"));
    expect(dataRequests).toEqual([expect.stringMatching(/\/api\/clubs\/river-plate$/)]);
    expect(new URL(dataRequests[0]).search).toBe("");
  });

  test("answers 400 without echoing an unknown club", async ({ request }) => {
    const response = await request.get("/api/clubs/not-a-club");
    expect(response.status()).toBe(400);
    expect(await response.text()).toBe('{"error":"unknown_club"}');
  });
});

test.describe("accessibility", () => {
  test("gives every control at least 44 x 44 px on a phone", async ({ page }) => {
    test.skip(isDesktop(page), "touch targets matter on phones");
    await seed(page, "river-plate");
    await page.goto("/rivales");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await pickLiga(page);
    const targets = [
      ...(await page.getByRole("combobox").all()),
      ...(await page.locator("label:has(input[type=radio])").all()),
      ...(await cards(page).all()),
      page.getByRole("button", { name: "Limpiar filtros" }),
    ];
    for (const target of targets) {
      const box = await target.boundingBox();
      expect(box, "control has a box").not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(43.5);
      expect(box!.width).toBeGreaterThanOrEqual(43.5);
    }
  });

  test("shows a focus outline on the filters and the summary cards from the keyboard", async ({
    page,
  }) => {
    await seed(page, "river-plate");
    await page.goto("/rivales");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const targets = [
      page.getByRole("combobox", { name: "Desde" }),
      page.getByRole("combobox", { name: "Ordenar por" }),
      cards(page).first(),
    ];
    for (const target of targets) {
      await target.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(target).toBeFocused();
      expect(await target.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
    }
  });

  test("turns the bar and the skeleton animations off with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seed(page, "river-plate");
    await page.goto("/rivales");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const duration = await page
      .locator("[aria-hidden='true'].origin-left")
      .first()
      .evaluate((el) => getComputedStyle(el).animationDuration);
    expect(parseFloat(duration)).toBeLessThan(0.01);
  });
});
