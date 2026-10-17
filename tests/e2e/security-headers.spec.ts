import { expect, test, type Page } from "@playwright/test";
import { securityHeaders } from "../../src/lib/security-headers";

const KEY = "rincon-del-hincha:fan";
const DATE = "1990-05-20";
const ROUTES = [
  "/",
  "/vitrina",
  "/rivales",
  "/comparar",
  "/acerca",
  "/privacidad",
  "/changelog",
  "/no-existe",
];
const EXPECTED = securityHeaders({ dev: false, vercelPreview: false });

type Violation = { effectiveDirective: string; blockedURI: string };
declare global {
  interface Window {
    __cspViolations: Violation[];
  }
}

async function recordViolations(page: Page) {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__cspViolations.push({
        effectiveDirective: event.effectiveDirective,
        blockedURI: event.blockedURI,
      });
    });
  });
}

const violations = (page: Page) => page.evaluate(() => window.__cspViolations);

test.describe("headers on every route", () => {
  for (const route of ROUTES) {
    test(`${route} carries the five headers and has no violations`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      await recordViolations(page);
      const response = await page.goto(route);
      const headers = response!.headers();
      for (const { key, value } of EXPECTED) expect(headers[key.toLowerCase()], key).toBe(value);
      expect(headers["x-powered-by"]).toBeUndefined();
      await page.waitForLoadState("networkidle");
      expect(await violations(page)).toEqual([]);
      expect(consoleErrors.filter((text) => /content security policy/i.test(text))).toEqual([]);
    });
  }

  test("the page still hydrates under the policy", async ({ page }) => {
    await recordViolations(page);
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Buscá tu club" }).fill("velez");
    await expect(
      page.getByRole("radiogroup", { name: "Elegí tu club" }).getByRole("radio"),
    ).toHaveCount(1);
    expect(await violations(page)).toEqual([]);
  });
});

test.describe("boot script, inline style and guards", () => {
  test("themes before hydration with the inline script and style allowed", async ({ page }) => {
    await recordViolations(page);
    await page.addInitScript(
      ([key, date]) =>
        window.localStorage.setItem(
          key,
          JSON.stringify({ v: 1, clubId: "river-plate", startDate: date, startMode: "birth" }),
        ),
      [KEY, DATE] as const,
    );
    await page.route("**/_next/static/chunks/**", (route) => route.abort());
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-club", "river-plate");
    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
    );
    expect(accent).toBe("#ff6f64");
    expect(await violations(page)).toEqual([]);
  });

  test("keeps the lime without a saved club", async ({ page }) => {
    await page.goto("/");
    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
    );
    expect(accent).toBe("#c6ff3d");
  });

  test("blocks requests and images to other origins", async ({ page }) => {
    await recordViolations(page);
    await page.goto("/");
    const fetched = await page.evaluate(() =>
      fetch("https://csp-check.invalid/x").then(
        () => "allowed",
        () => "blocked",
      ),
    );
    expect(fetched).toBe("blocked");
    await page.evaluate(() => {
      const image = new Image();
      image.src = "https://csp-check.invalid/pixel.png";
    });
    await expect
      .poll(async () => (await violations(page)).map((v) => v.effectiveDirective))
      .toEqual(expect.arrayContaining(["connect-src", "img-src"]));
  });

  test("cannot be framed by another page", async ({ page }) => {
    // Chromium reports the blocked frame as an empty or error document; the header is the contract.
    await page.goto("about:blank");
    await page.setContent('<iframe id="f" src="http://localhost:3000/"></iframe>');
    await page.waitForTimeout(1500);
    const framed = page.frames().find((frame) => frame.url().startsWith("http://localhost:3000"));
    const reached = framed ? await framed.locator("#contenido").count() : 0;
    expect(reached).toBe(0);
  });
});

test.describe("referrer policy", () => {
  test("sends nothing to other sites and never the date", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("radio", { name: /River/ }).check({ force: true });
    await page.getByLabel(/Tu fecha de nacimiento/).fill(DATE);
    await page.getByRole("button", { name: "Ver mi historia" }).click();
    await expect(page).toHaveURL(/\/vitrina$/);

    const seen: Record<string, string>[] = [];
    await page.route("https://referrer-check.invalid/**", (route) => {
      seen.push(route.request().headers());
      return route.fulfill({ status: 200, contentType: "text/html", body: "ok" });
    });
    await page.evaluate(() => {
      const link = document.createElement("a");
      link.href = "https://referrer-check.invalid/x";
      document.body.append(link);
      link.click();
    });
    await expect.poll(() => seen.length).toBe(1);
    expect(seen[0]["referer"]).toBeUndefined();
    for (const value of Object.values(seen[0])) {
      expect(value).not.toMatch(/1990|20\/05|19900520/);
    }
  });

  test("keeps the full referrer inside the site", async ({ page }) => {
    await page.goto("/");
    const requests: Record<string, string>[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/rivales")) requests.push(request.headers());
    });
    await page.evaluate(() => {
      const link = document.createElement("a");
      link.href = "/rivales";
      document.body.append(link);
      link.click();
    });
    await expect(page).toHaveURL(/\/rivales$/);
    const navigation = requests.find((headers) => headers["sec-fetch-dest"] === "document");
    if (navigation) expect(navigation["referer"]).toBe("http://localhost:3000/");
  });
});
